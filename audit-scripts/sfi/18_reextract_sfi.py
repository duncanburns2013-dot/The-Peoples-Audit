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
GIFTS_JSON = ROOT / "public" / "data" / "ma-sfi-gifts.json"
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
    "36": "own_lobbyist_reimbursements",
    "36.a": "own_interested_party_reimbursements",
    "37": "spouse_lobbyist_reimbursements",
    "37.a": "spouse_interested_party_reimbursements",
    "38": "own_gifts_honoraria",
    "39": "spouse_gifts_honoraria",
}

# The highest-signal sections: a public official telling the Ethics Commission
# that a lobbyist, or someone with a direct interest in a matter before their
# body, gave them or their spouse something worth more than $100.
GIFT_QS = {
    "36": ("own", "lobbyist_reimbursement"),
    "36.a": ("own", "interested_party_reimbursement"),
    "37": ("spouse", "lobbyist_reimbursement"),
    "37.a": ("spouse", "interested_party_reimbursement"),
    "38": ("own", "gift_honorarium"),
    "39": ("spouse", "gift_honorarium"),
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


def extract_one(blob: bytes) -> dict:
    """Parse one filing's PDF bytes into its entity fields.

    Returns {"unreadable": reason} rather than None when nothing can be read,
    so the caller can record *why*. A filing that is a scanned image is not the
    same as a filer who disclosed nothing, and until this was recorded the two
    were indistinguishable on the site — a blank row implying a nil return when
    the truth was "this document cannot be read".
    """
    try:
        import pypdf

        reader = pypdf.PdfReader(io.BytesIO(blob))
        text = "\n".join(p.extract_text() or "" for p in reader.pages)
    except Exception as e:
        return {"unreadable": "parse_error", "detail": f"{type(e).__name__}: {e}"[:120]}
    if not text.strip():
        # No text layer at all: the pages are page images. Confirmed on
        # Abboud__Margaret_M.pdf — 42 pages, an /Image XObject of 1280x1664,
        # no /Font resource, zero extractable characters. Only OCR would help.
        return {"unreadable": "no_text_layer"}
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
        # A gift section counts only when the filer actually disclosed
        # something. The old pipeline reported gifts for filers whose PDFs say
        # "Filer reported none", because the broken splitter handed it a
        # section sliced from elsewhere in the document.
        "gifts": [
            {
                "section": q,
                "subject": subject,
                "kind": kind,
                "source": P.first_entity(s.get(q, "")),
                "body": P.answer_text(s.get(q, ""))[:400],
            }
            for q, (subject, kind) in GIFT_QS.items()
            if s.get(q) and not P.is_none(s[q]) and P.answer_lines(s.get(q, ""))
        ],
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

    stats = {"parsed": 0, "failed": 0, "updated": 0, "no_sections": 0,
             "scanned_image_only": 0}
    gift_rows: list[dict] = []
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
                f = by_rel[rel]
                if rec.get("unreadable"):
                    stats["failed"] += 1
                    if rec["unreadable"] == "no_text_layer":
                        stats["scanned_image_only"] += 1
                    # Record it on the filing so a blank row can be told apart
                    # from a nil return.
                    f["machineReadable"] = False
                    f["unreadableReason"] = rec["unreadable"]
                    continue
                f["machineReadable"] = True
                f.pop("unreadableReason", None)
                stats["parsed"] += 1
                if rec["sections_found"] < 30:
                    stats["no_sections"] += 1
                for k in (
                    "ownTopEmployer",
                    "spouseTopEmployer",
                    "ownRealEstate",
                    "spouseRealEstate",
                    "topMortgageCreditor",
                ):
                    f[k] = rec[k]
                stats["updated"] += 1
                if rec["gifts"]:
                    last, _, first = f["legislatorName"].partition(",")
                    gift_rows.append(
                        {
                            "year": year,
                            "lastName": last.strip(),
                            "firstName": first.strip(),
                            "workEmail": f.get("workEmail", ""),
                            "pdfPath": rel,
                            "sections": rec["gifts"],
                        }
                    )
                f["hasLobbyistGifts"] = any(
                    g["kind"].endswith("reimbursement") or g["kind"] == "gift_honorarium"
                    for g in rec["gifts"]
                )
                f["hasInterestedPartyGifts"] = any(
                    g["kind"] == "interested_party_reimbursement" for g in rec["gifts"]
                )
                f["gifts"] = len(rec["gifts"])
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
    data["scannedImageOnlyFilings"] = stats["scanned_image_only"]
    data["unreadableFilings"] = stats["failed"]
    data["lobbyistGiftFilingsCount"] = len(gift_rows)
    SITE_JSON.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )

    # Only rewrite the gifts file on a full run. A partial run would silently
    # delete every filing it did not look at.
    full_run = set(args.years) == set(YEARS) and not args.legislators_only and not args.limit
    if full_run:
        prior = 0
        if GIFTS_JSON.exists():
            try:
                prior = len(json.loads(GIFTS_JSON.read_text(encoding="utf-8"))["rows"])
            except Exception:
                pass
        GIFTS_JSON.write_text(
            json.dumps(
                {
                    "fetchedAt": data.get("fetchedAt", ""),
                    "count": len(gift_rows),
                    "totalSectionRows": sum(len(r["sections"]) for r in gift_rows),
                    "note": (
                        "Rebuilt with sfi_parse. The previous extraction reported "
                        "gifts for filers whose PDFs state 'Filer reported none', "
                        "because sections were sliced from the wrong part of the "
                        "document."
                    ),
                    "rows": gift_rows,
                },
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            encoding="utf-8",
        )
        print(f"\ngifts: {prior:,} rows before -> {len(gift_rows):,} after")
        print(f"wrote {GIFTS_JSON}")
    else:
        print(f"\ngifts: {len(gift_rows):,} rows found (partial run — file not rewritten)")

    print(f"\n{stats}")
    print(f"wrote {ENTITIES_CSV}")
    print(f"wrote {SITE_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
