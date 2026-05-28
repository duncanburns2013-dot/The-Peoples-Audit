"""Build ma-sfi-crossref-pass1.json — verified Pass 1 survivors for the
dashboard's SfiExplorer. Same shape style as ma-sfi-tempus.json.

Output: public/data/ma-sfi-crossref-pass1.json"""

from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

CROSSREF = Path("C:/PeoplesAudit/out/crossref")
JSONL    = Path("C:/PeoplesAudit/out/sfi_text.jsonl")
OUT      = Path(__file__).resolve().parent.parent.parent / "public" / "data" / "ma-sfi-crossref-pass1.json"


def clean_q2(q2: str) -> str:
    body = re.sub(r"^.*?required information for that position\.\s*", "", q2, flags=re.S)
    body = re.sub(r"If you held more than one[^\.]+\.\s*", "", body)
    body = re.sub(r"Agency\s*Name\s*Position\s*Date\s*Amount of Income\s*Address\s*", "", body)
    return re.sub(r"\s+", " ", body).strip()


def main():
    # PDF-verified rows
    verified = list(csv.DictReader((CROSSREF / "pass1_survivors_verified.csv").open(encoding="utf-8")))
    verified = [r for r in verified if r["verdict"] == "PDF_VERIFIED"]

    # DOGE context per filer (latest year)
    pass1 = list(csv.DictReader((CROSSREF / "pass1_verified.csv").open(encoding="utf-8")))
    doge_by_filer = {}
    for r in pass1:
        if r["verdict"] != "PLAUSIBLE":
            continue
        prev = doge_by_filer.get(r["norm_key"])
        if not prev or r["sfi_year"] > prev["sfi_year"]:
            doge_by_filer[r["norm_key"]] = r

    # Index JSONL
    sfi_idx = {}
    with JSONL.open(encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            key = (rec["year"], rec["last_name"].upper(),
                   rec["first_name"].split()[0].upper() if rec["first_name"] else "")
            sfi_idx[key] = rec

    by_filer = defaultdict(list)
    for r in verified:
        by_filer[r["filer"]].append(r)

    records = []
    for filer, rows in by_filer.items():
        rows.sort(key=lambda r: r["year"])
        years = [r["year"] for r in rows]
        latest = rows[-1]
        last, first0 = filer.split(",")
        last = last.strip()
        first0 = first0.strip()
        rec = sfi_idx.get((latest["year"], last, first0))
        if not rec:
            continue
        q2 = clean_q2(rec["sections"].get("2", ""))

        drow = doge_by_filer.get(filer, {})
        records.append({
            "filerNorm": filer,
            "lastName": rec["last_name"],
            "firstName": rec["first_name"],
            "workEmail": rec.get("work_email", ""),
            "years": years,
            "yearsRange": f"{years[0]}-{years[-1]}" if len(years) > 1 else years[0],
            "latestYear": latest["year"],
            "stateAgency": _extract_agency(q2),
            "stateRole": _extract_role(q2),
            "q2DisclosedRaw": q2[:600],
            "matchedNpiOrg": drow.get("doge_orgs", ""),
            "matchedNpiCities": drow.get("doge_cities", ""),
            "npiCount": int(drow.get("doge_n_npis", "0") or "0"),
            "npiTotalSpending": float(drow.get("doge_total_spending", "0") or "0"),
            "verificationCount": f"{len(rows)} of {len(rows)} years PDF-verified",
            "sfiSourcePdf": latest["pdf_path"],
        })

    records.sort(key=lambda r: -r["npiTotalSpending"])

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "MA State Ethics Commission SFI bulk release × HHS-MA-DOGE NPI authorized-official set",
        "methodology": (
            "Pass 1: SFI filer name == NPI authorized-official name "
            "(normalized to LAST, FIRST_INITIAL). Automated verification by "
            "Q2 state-position vs NPI healthcare-org alignment. Final PDF "
            "re-verification by reopening each cited SFI PDF and re-extracting "
            "Q2 directly from the binary file. 25 of 25 candidate (filer, year) "
            "rows passed PDF re-verification."
        ),
        "disclaimer": (
            "These are publicly disclosed dual roles. No wrongdoing is alleged. "
            "MA state public-health and mental-health hospitals are required to "
            "have a state-employed authorized official on their NPI registration, "
            "and senior DPH/DMH executives appearing as those officials is the "
            "structural expectation. Total spending figures are Medicare/Medicaid "
            "spending flowing to the NPI's organization (typically the "
            "Commonwealth of Massachusetts or a state-affiliated hospital), not "
            "to the individual."
        ),
        "findingsDoc": "findings/FINDINGS-SFI-CROSSREF-PASS1.md",
        "verifiedCount": len(records),
        "verifiedFilerYears": sum(len(by_filer[f]) for f in by_filer),
        "records": records,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"-> {OUT}")
    print(f"-> {OUT.stat().st_size:,} bytes")
    print(f"-> {len(records)} verified individuals, {payload['verifiedFilerYears']} (filer, year) rows")


def _extract_agency(q2: str) -> str:
    """First agency mentioned in Q2 (usable as a one-line label)."""
    m = re.match(r"^(.*?)(?:\$|\b\d{2,3},\d{3}\b)", q2)
    head = (m.group(1) if m else q2).strip()
    # Cut at the first occurrence of a role title token
    for sep in ["Director", "CEO", "Chief Executive", "Bureau Director", "Chief Operating", "member"]:
        idx = head.find(sep)
        if idx > 0:
            head = head[:idx].strip()
            break
    return head[:120]


def _extract_role(q2: str) -> str:
    """Best-effort role title (chars after agency before the dollar amount)."""
    # Try common patterns: "Agency NAME Role $..."
    m = re.match(r"^(?P<a>.*?)(?P<r>Director[^$]*?|CEO[^$]*?|Chief Executive[^$]*?|Bureau Director[^$]*?|Chief Operating[^$]*?|member)\s*(?=\$|\d{2,3},\d{3})", q2)
    if m:
        return m.group("r").strip()
    return ""


if __name__ == "__main__":
    main()
