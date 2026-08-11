"""Re-extract every SFI filing from the published bulk zips using sfi_parse.

Replaces the entity fields in public/data/ma-sfi.json, which are wrong for
essentially every filing: 95.2% of non-empty `ownTopEmployer` values are the
literal column header "Income", and most of the rest are street-address
fragments. See docs/superpowers/specs/2026-08-11-sfi-entity-extraction-design.md.

Reads each year's `sfi-<YYYY>.zip` release asset — the members are STORED, so
extraction is a byte copy — and needs no local corpus.

Outputs:
  data/sfi/sfi_entities.csv    (year, slug, question, index, value)
  public/data/ma-sfi.json      entity fields replaced in place

The entities CSV is the durable artifact. Downstream work (vote-conflict
screening) consumes it rather than re-deriving entities from summary fields.

Usage:
    python 18_reextract_sfi.py                     # every year
    python 18_reextract_sfi.py --years 2025        # one year
    python 18_reextract_sfi.py --legislators-only  # House/Senate filers only
    python 18_reextract_sfi.py --limit 50          # smoke test
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sfi_parse as P  # noqa: E402

REPO = os.environ.get("SFI_REPO", "duncanburns2013-dot/The-Peoples-Audit")
TOKEN = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""
ROOT = Path(__file__).resolve().parents[2]
SITE_JSON = ROOT / "public" / "data" / "ma-sfi.json"
ENTITIES_CSV = ROOT / "data" / "sfi" / "sfi_entities.csv"
WORK = Path(os.environ.get("SFI_WORKDIR", ".work/zips"))

YEARS = ["2019", "2020", "2021", "2022", "2023", "2024", "2025"]

# Questions whose answers name an entity worth keeping for downstream matching.
ENTITY_QUESTIONS = {
    "5": "own_employer",
    "7": "spouse_employer",
    "8": "own_business_ownership",
    "9": "spouse_business_ownership",
    "11": "own_officer_director",
    "12": "spouse_officer_director",
    "13": "own_real_estate",
    "14": "spouse_real_estate",
    "21": "own_ma_bonds",
    "25": "own_financial_investments",
    "26": "spouse_financial_investments",
    "29": "primary_residence_mortgage",
    "30": "other_property_mortgage",
    "32": "own_nonmortgage_debt",
    "38": "own_gifts_honoraria",
    "39": "spouse_gifts_honoraria",
}

# "123 Main Street, Salem, MA, 01970, US" -> Salem
_TOWN_RE = re.compile(r",\s*([A-Za-z][A-Za-z .'-]{1,28}?),\s*MA,\s*\d{5}")


def first_ma_town(section: str) -> str:
    """The municipality from a real-estate answer, which is an address table."""
    if not section or P.is_none(section):
        return ""
    for line in P.answer_lines(section) or section.splitlines():
        m = _TOWN_RE.search(line)
        if m:
            town = m.group(1).strip()
            if town.lower() not in P.FORBIDDEN_VALUES and not town.isdigit():
                return town
    m = _TOWN_RE.search(section)
    return m.group(1).strip() if m else ""


def download_zip(year: str) -> Path:
    WORK.mkdir(parents=True, exist_ok=True)
    dest = WORK / f"sfi-{year}.zip"
    if dest.exists():
        return dest
    headers = {"Accept": "application/octet-stream"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    rel = json.load(
        urllib.request.urlopen(
            urllib.request.Request(
                f"https://api.github.com/repos/{REPO}/releases/tags/sfi-{year}",
                headers={"Authorization": f"Bearer {TOKEN}"} if TOKEN else {},
            )
        )
    )
    asset = next(a for a in rel["assets"] if a["name"] == f"sfi-{year}.zip")
    tmp = dest.with_suffix(".part")
    with urllib.request.urlopen(
        urllib.request.Request(asset["url"], headers=headers)
    ) as r, tmp.open("wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    tmp.replace(dest)
    return dest


def extract_one(blob: bytes) -> dict | None:
    """Parse one filing's PDF bytes into its entity fields."""
    try:
        import pypdf

        reader = pypdf.PdfReader(io.BytesIO(blob))
        text = "\n".join(p.extract_text() or "" for p in reader.pages)
    except Exception:
        return None
    if not text.strip():
        return None
    s = P.split_sections(text)
    return {
        "sections_found": len(s),
        "ownTopEmployer": P.first_entity(s.get("5", "")),
        "spouseTopEmployer": P.first_entity(s.get("7", "")),
        "ownRealEstate": first_ma_town(s.get("13", "")),
        "spouseRealEstate": first_ma_town(s.get("14", "")),
        "topMortgageCreditor": (
            P.first_entity(s.get("29", "")) or P.first_entity(s.get("30", ""))
        ),
        "entities": {q: P.entities(s.get(q, ""), limit=12) for q in ENTITY_QUESTIONS},
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", nargs="*", default=YEARS)
    ap.add_argument("--legislators-only", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--keep-zips", action="store_true")
    args = ap.parse_args()

    data = json.loads(SITE_JSON.read_text(encoding="utf-8"))
    by_rel = {f["relPath"].replace("\\", "/"): f for f in data["filings"]}
    want_leg = {
        r for r, f in by_rel.items() if f["chamber"] in ("House", "Senate")
    }

    ENTITIES_CSV.parent.mkdir(parents=True, exist_ok=True)
    new_csv = not ENTITIES_CSV.exists()
    csv_fh = ENTITIES_CSV.open("a" if not new_csv else "w", newline="", encoding="utf-8")
    writer = csv.writer(csv_fh)
    if new_csv:
        writer.writerow(["year", "slug", "question", "slug_name", "index", "value"])

    stats = {"parsed": 0, "failed": 0, "updated": 0, "no_sections": 0}
    for year in args.years:
        zpath = download_zip(year)
        print(f"== {year}: {zpath.stat().st_size/1e9:.2f} GB ==", flush=True)
        with zipfile.ZipFile(zpath) as zf:
            members = [n for n in zf.namelist() if n.lower().endswith(".pdf")]
            for i, member in enumerate(members):
                rel = f"{year}/{member.split('/')[-1]}"
                if rel not in by_rel:
                    continue
                if args.legislators_only and rel not in want_leg:
                    continue
                if args.limit and stats["parsed"] >= args.limit:
                    break
                rec = extract_one(zf.read(member))
                if rec is None:
                    stats["failed"] += 1
                    continue
                stats["parsed"] += 1
                if rec["sections_found"] < 30:
                    stats["no_sections"] += 1
                f = by_rel[rel]
                for k in (
                    "ownTopEmployer",
                    "spouseTopEmployer",
                    "ownRealEstate",
                    "spouseRealEstate",
                    "topMortgageCreditor",
                ):
                    f[k] = rec[k]
                stats["updated"] += 1
                slug = Path(rel).stem
                for q, vals in rec["entities"].items():
                    for j, v in enumerate(vals):
                        writer.writerow([year, slug, q, ENTITY_QUESTIONS[q], j, v])
                if stats["parsed"] % 500 == 0:
                    print(f"  {stats['parsed']:,} parsed", flush=True)
                    csv_fh.flush()
        if not args.keep_zips:
            zpath.unlink(missing_ok=True)

    csv_fh.close()
    data["entityExtractionVersion"] = "sfi_parse-v1"
    SITE_JSON.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(f"\n{stats}")
    print(f"wrote {ENTITIES_CSV}")
    print(f"wrote {SITE_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
