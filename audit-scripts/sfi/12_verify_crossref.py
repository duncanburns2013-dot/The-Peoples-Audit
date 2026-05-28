"""Verify Pass 1 and Pass 3 cross-ref candidates to the same standard as the
Tempus verification:
  * Re-extract each candidate from the SFI PDF / JSONL.
  * Compare the filer's actual MA public position (Q2) and work_email
    against the DOGE NPI/address context.
  * Classify each candidate as PLAUSIBLE / LIKELY_COLLISION / NEEDS_REVIEW.

Outputs (in C:/PeoplesAudit/out/crossref/):
  - pass1_verified.csv  — one row per (filer-name, year) with classification + evidence
  - pass3_verified.csv  — one row per address-hit filer with classification + evidence
  - VERIFY_SUMMARY.md   — human-readable summary of survivors / collisions / open

Run after 04_crossref.py."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

SFI_DIR = Path(r"C:\PeoplesAudit\out")
CROSSREF = SFI_DIR / "crossref"
SFI_JSONL = SFI_DIR / "sfi_text.jsonl"

# Cache filer text by (year, last, first) for fast lookup.
def load_sfi_index():
    idx = {}
    with SFI_JSONL.open(encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            key = (rec["year"], rec["last_name"].upper(), rec["first_name"].split()[0].upper() if rec["first_name"] else "")
            idx[key] = rec
    return idx


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def extract_position_signal(rec):
    """Pull the filer's MA public position(s) from Q2 / Q3. Return:
       { 'agency': 'MassDOT/MBTA', 'position': 'AGM, Capital ...', 'raw_q2': '...' }
    Q2 layout (post text-extract): line-broken header followed by a single row
    with Agency Name / Position / Date / Amount of Income / Address.  Just
    pull the bulk text after the header for human-readable evidence."""
    q2 = rec["sections"].get("2", "") or ""
    q3 = rec["sections"].get("3", "") or ""
    # Strip the instruction sentence and the "Filer reported none" marker.
    body2 = re.sub(r"^.*?required information for that position\.\s*", "", q2, flags=re.S)
    body2 = re.sub(r"If you held more than one[^\.]+\.\s*", "", body2)
    body2 = re.sub(r"^\s*Agency\s*Name\s*Position\s*Date\s*Amount of Income\s*Address\s*", "", body2)
    body2 = clean(body2)
    if "Filer reported none" in body2:
        body2 = "(Q2 empty)"
    body3 = clean(q3)
    return {
        "agency_position": body2[:300],
        "q3_other": (body3[:200] if "Filer reported none" not in body3 else ""),
        "work_email": rec.get("work_email", ""),
    }


def classify_pass1(filer_info, doge_orgs, doge_cities, n_npis, n_commonness):
    """Return (verdict, reason).
    Verdicts: PLAUSIBLE, LIKELY_COLLISION, NEEDS_REVIEW."""
    agency_pos = (filer_info["agency_position"] or "").upper()
    email = (filer_info["work_email"] or "").lower()
    orgs = (doge_orgs or "").upper()

    # Common name + small SFI history => high collision risk.
    legislative_signals = [
        "STATE SENATOR", "REPRESENTATIVE", "LEGISLATURE", "SENATE", "HOUSE OF REPRESENTATIVES",
        "DISTRICT COURT", "SUPERIOR COURT", "PROBATE", "TRIAL COURT", "APPEALS COURT",
        "BOARD MEMBER", "COMMISSIONER",
    ]
    healthcare_signals = [
        "PUBLIC HEALTH", "EOHHS", "HEALTH AND HUMAN", "MASSHEALTH", "DEPT OF HEALTH",
        "DPH", "DDS", "DMH", "VETERAN", "TEWKSBURY", "WESTERN MASSACHUSETTS HOSPITAL",
        "SHATTUCK", "LEMUEL", "SOLDIERS HOME", "WORCESTER STATE HOSPITAL",
        "DALY GAJANO", "BRIDGEWATER STATE HOSPITAL", "MED EXAMINER",
    ]
    transport_signals = ["MBTA", "MASSDOT", "REGISTRY OF MOTOR", "RMV"]
    education_signals = ["UMASS", "UNIVERSITY OF MASSACHUSETTS", "STATE COLLEGE", "PUBLIC SCHOOLS"]

    is_healthcare_filer = any(s in agency_pos for s in healthcare_signals)
    is_transport_filer  = any(s in agency_pos for s in transport_signals)
    is_education_filer  = any(s in agency_pos for s in education_signals)
    is_legislative      = any(s in agency_pos for s in legislative_signals)

    is_state_npi = "COMMONWEALTH OF MASSACHUSETTS" in orgs

    if is_healthcare_filer and is_state_npi:
        return "PLAUSIBLE", f"Filer holds healthcare role at MA agency; NPI org = Commonwealth of MA"
    if is_healthcare_filer and any(h in orgs for h in ["HOSPITAL", "HEALTH", "MEDICAL", "CLINIC"]):
        return "PLAUSIBLE", f"Filer holds healthcare-adjacent role; NPI is healthcare org"
    if is_legislative:
        return "LIKELY_COLLISION", f"Filer is in legislative/judicial role; NPI authorized officials are usually clinicians, not legislators"
    if is_transport_filer or is_education_filer:
        return "LIKELY_COLLISION", f"Filer is in transport/education role; NPI is a healthcare org — unrelated jobs"
    if n_commonness >= 12:
        return "LIKELY_COLLISION", f"Name appears {n_commonness}x in SFI filings — multiple distinct filers share this name"
    if not agency_pos or agency_pos == "(Q2 empty)":
        return "NEEDS_REVIEW", f"Filer's Q2 was empty — cannot identify their state role"
    return "NEEDS_REVIEW", f"Filer role unclear vs NPI org"


def main():
    print("Loading SFI text index...")
    idx = load_sfi_index()
    print(f"  loaded {len(idx)} filer records")

    # -------- Pass 1 verification --------
    pass1_in = CROSSREF / "pass1_filer_vs_doge_official_grouped.csv"
    pass1_out = CROSSREF / "pass1_verified.csv"
    with pass1_in.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    verified = []
    for r in rows:
        last = (r["sfi_last"] or "").upper()
        first0 = re.sub(r"[^A-Za-z\-]", "", (r["sfi_first"] or "").split()[0]).upper() if r["sfi_first"] else ""
        rec = idx.get((r["sfi_year"], last, first0))
        if not rec:
            r_out = dict(r)
            r_out["verdict"] = "NEEDS_REVIEW"
            r_out["reason"] = "could not locate SFI text record"
            r_out["filer_agency_position"] = ""
            r_out["filer_q3_other"] = ""
            verified.append(r_out)
            continue
        info = extract_position_signal(rec)
        verdict, reason = classify_pass1(
            info,
            r.get("doge_orgs", ""),
            r.get("doge_cities", ""),
            int(r.get("doge_n_npis", 0) or 0),
            int(r.get("name_commonness_in_sfi", 0) or 0),
        )
        r_out = dict(r)
        r_out["verdict"] = verdict
        r_out["reason"] = reason
        r_out["filer_agency_position"] = info["agency_position"]
        r_out["filer_q3_other"] = info["q3_other"]
        verified.append(r_out)

    with pass1_out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(verified[0].keys()))
        w.writeheader()
        w.writerows(verified)
    print(f"Pass 1 verified: {pass1_out}")

    # -------- Pass 3 verification --------
    pass3_in = CROSSREF / "pass3_sfi_addr_in_doge.csv"
    pass3_out = CROSSREF / "pass3_verified.csv"
    if pass3_in.exists():
        with pass3_in.open(encoding="utf-8") as f:
            rows3 = list(csv.DictReader(f))
        verified3 = []
        for r in rows3:
            last = (r.get("sfi_last") or "").upper()
            first0 = re.sub(r"[^A-Za-z\-]", "", (r.get("sfi_first") or "").split()[0]).upper() if r.get("sfi_first") else ""
            rec = idx.get((r.get("sfi_year"), last, first0))
            r_out = dict(r)
            if rec:
                info = extract_position_signal(rec)
                r_out["filer_work_email"] = info["work_email"]
                r_out["filer_agency_position"] = info["agency_position"][:200]
            else:
                r_out["filer_work_email"] = ""
                r_out["filer_agency_position"] = ""
            # Address overlap is harder to verify automatically; flag everything
            # NEEDS_REVIEW unless an obvious tell.
            sfi_q = r.get("sfi_question", "")
            doge_addr = (r.get("doge_address") or "").upper()
            kind = r.get("kind", "")
            if any(x in doge_addr for x in ["MEDICAL CENTER", "HOSPITAL", "PLAZA", "BUILDING", "SUITE", "FLOOR"]):
                r_out["verdict"] = "LIKELY_COLLISION"
                r_out["reason"] = "DOGE address is a multi-tenant medical building — address overlap proves nothing alone"
            elif kind == "ownership":
                r_out["verdict"] = "NEEDS_REVIEW"
                r_out["reason"] = "Filer ownership at same street/num/zip — verify by reading the SFI section in context"
            else:
                r_out["verdict"] = "NEEDS_REVIEW"
                r_out["reason"] = "Address-only match — verify by reading the SFI section in context"
            verified3.append(r_out)
        with pass3_out.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(verified3[0].keys()))
            w.writeheader()
            w.writerows(verified3)
        print(f"Pass 3 verified: {pass3_out}")

    # -------- Summary --------
    from collections import Counter
    p1_verdicts = Counter(r["verdict"] for r in verified)
    p3_verdicts = Counter(r["verdict"] for r in verified3) if pass3_in.exists() else Counter()

    summary = CROSSREF / "VERIFY_SUMMARY.md"
    with summary.open("w", encoding="utf-8") as f:
        f.write("# SFI Cross-Reference Verification Summary\n\n")
        f.write("Pass 1 (SFI filer name == DOGE NPI authorized official):\n\n")
        f.write(f"- Total candidates: {len(verified)}\n")
        for v in ("PLAUSIBLE", "LIKELY_COLLISION", "NEEDS_REVIEW"):
            f.write(f"- {v}: {p1_verdicts.get(v, 0)}\n")
        f.write("\nPass 3 (SFI address == DOGE flagged address):\n\n")
        f.write(f"- Total candidates: {sum(p3_verdicts.values())}\n")
        for v in ("PLAUSIBLE", "LIKELY_COLLISION", "NEEDS_REVIEW"):
            f.write(f"- {v}: {p3_verdicts.get(v, 0)}\n")
        # List the PLAUSIBLE ones with context
        f.write("\n## Pass 1 — PLAUSIBLE survivors\n\n")
        for r in verified:
            if r["verdict"] == "PLAUSIBLE":
                f.write(f"- **{r['norm_key']}** ({r['sfi_year']})  \n")
                f.write(f"  Role: {r['filer_agency_position']}  \n")
                f.write(f"  NPI orgs: {r['doge_orgs']}  \n")
                f.write(f"  NPI cities: {r['doge_cities']}  \n")
                f.write(f"  NPI spending: ${float(r['doge_total_spending'] or 0):,.0f}\n\n")
        f.write("\n## Pass 1 — LIKELY_COLLISION (excluded)\n\n")
        seen_names = set()
        for r in verified:
            if r["verdict"] == "LIKELY_COLLISION" and r["norm_key"] not in seen_names:
                seen_names.add(r["norm_key"])
                f.write(f"- {r['norm_key']}: {r['reason']}; role = {r['filer_agency_position'][:120]}\n")
    print(f"Summary: {summary}")
    print()
    print(f"Pass 1: {dict(p1_verdicts)}")
    print(f"Pass 3: {dict(p3_verdicts)}")


if __name__ == "__main__":
    main()
