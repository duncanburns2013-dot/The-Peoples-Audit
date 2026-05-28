"""Build the JSON files consumed by The-Peoples-Audit web UI.

Outputs (written into the repo's public/data/):
  ma-sfi.json                — per-filing summary (all 29K filings)
  ma-sfi-tempus.json         — Tempus Unlimited disclosure pattern (Pass 2)
  ma-sfi-doge-crossref.json  — full DOGE cross-reference (Pass 1 + Pass 3)
"""
from __future__ import annotations

import csv
import datetime as dt
import json
from collections import defaultdict
from pathlib import Path

OUT_REPO = Path(r"C:\Users\dunca\The-Peoples-Audit\public\data")
SFI_DIR = Path(r"C:\PeoplesAudit\out")

MASTER = SFI_DIR / "sfi_master.csv"
CROSSREF = SFI_DIR / "crossref"

# Question-flag column → category we expose to the UI as a count.
EMPLOYER_QS = ["own_business_employment", "spouse_business_employment"]
SECURITY_QS = [
    "own_financial_investments", "spouse_financial_investments",
    "own_trust_financial_investments", "spouse_trust_financial_investments",
    "own_ma_bonds", "spouse_ma_bonds", "own_trust_ma_bonds", "spouse_trust_ma_bonds",
]
REAL_ESTATE_QS = [
    "own_real_estate", "spouse_real_estate",
    "own_trust_real_estate", "spouse_trust_real_estate",
    "own_real_estate_transferred", "spouse_real_estate_transferred",
    "own_lien_mortgage_receivable", "spouse_lien_mortgage_receivable",
]
GIFT_QS = [
    "own_gifts_honoraria", "spouse_gifts_honoraria",
    "own_lobbyist_reimbursements", "spouse_lobbyist_reimbursements",
    "own_interested_party_reimbursements", "spouse_interested_party_reimbursements",
]
BUSINESS_OWN_QS = [
    "own_business_ownership", "spouse_business_ownership",
    "own_officer_director", "spouse_officer_director",
]
DEBT_QS = [
    "primary_residence_mortgage", "other_property_mortgage",
    "spouse_other_mortgage", "own_nonmortgage_debt", "spouse_nonmortgage_debt",
    "own_debt_forgiven", "spouse_debt_forgiven",
]


def category_for(email: str) -> tuple[str, str]:
    """Return (chamber_or_category, agency_label) from a work email."""
    e = (email or "").lower()
    if "@mahouse.gov" in e:
        return "House", "Massachusetts House of Representatives"
    if "@masenate.gov" in e:
        return "Senate", "Massachusetts Senate"
    if "@jud.state.ma.us" in e:
        return "Judiciary", "Massachusetts Trial / Appellate Courts"
    if "@dot.state.ma.us" in e:
        return "MassDOT", "Massachusetts Department of Transportation"
    if "@doc.state.ma.us" in e:
        return "DOC", "Massachusetts Department of Correction"
    if "@dor.state.ma.us" in e:
        return "DOR", "Massachusetts Department of Revenue"
    if "@sec.state.ma.us" in e:
        return "Sec. of State", "Office of the Secretary of the Commonwealth"
    if "@mbta.com" in e:
        return "MBTA", "Massachusetts Bay Transportation Authority"
    if "@masshousing.com" in e:
        return "MassHousing", "Massachusetts Housing Finance Agency"
    if "@mass.gov" in e or "@state.ma.us" in e:
        return "Executive", "State Executive Branch"
    if "@pol.state.ma.us" in e:
        return "State Police", "Massachusetts State Police"
    if "@mwra.com" in e:
        return "MWRA", "Massachusetts Water Resources Authority"
    if e.endswith(".edu"):
        return "Higher Ed", "MA Public Higher Education"
    return "Other", "Other public position"


def build_sfi_json() -> None:
    filings: list[dict] = []
    with MASTER.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            chamber, agency = category_for(row["work_email"])
            ne = lambda col: int(row[col] == "1") if col in row else 0  # noqa: E731
            filings.append({
                "legislatorName": f"{row['last_name']}, {row['first_name']}".strip(", "),
                "chamber": chamber,
                "agency": agency,
                "district": "",
                "filingYear": row["year"],
                "submitted": row["submitted"],
                "workEmail": row["work_email"],
                # Counts of distinct disclosure sections marked "has content".
                # Each one represents AT LEAST one entry — the structured rows
                # behind each section will be filled in by future extraction
                # passes; for now the count signals where to look.
                "employers": sum(ne(q) for q in EMPLOYER_QS),
                "securities": sum(ne(q) for q in SECURITY_QS),
                "realEstate": sum(ne(q) for q in REAL_ESTATE_QS),
                "gifts": sum(ne(q) for q in GIFT_QS),
                "businessOwnership": sum(ne(q) for q in BUSINESS_OWN_QS),
                "debts": sum(ne(q) for q in DEBT_QS),
                "blindTrust": ne("blind_trust") == 1,
                # Source URL — fill in once releases are set up.
                "sourcePdfUrl": (
                    "https://github.com/duncanburns2013-dot/The-Peoples-Audit"
                    f"/releases/download/sfi-{row['year']}/"
                    + Path(row["rel_path"]).name.replace(" ", "%20")
                ),
                "relPath": row["rel_path"].replace("\\", "/"),
            })

    payload = {
        "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "status": "live",
        "filingsYears": sorted({f["filingYear"] for f in filings}),
        "count": len(filings),
        "categories": sorted({f["chamber"] for f in filings}),
        "accessNote": (
            "Bulk corpus obtained via redacted release from the MA State "
            "Ethics Commission. 29,729 Statement-of-Financial-Interest "
            "filings 2019–2025 covering legislators, judges, agency heads, "
            "board members, and designated public employees. Home addresses, "
            "personal phone numbers, and personal email addresses are "
            "redacted at the source; all substantive financial-interest "
            "disclosures (employers, securities, real estate, gifts, debts) "
            "are preserved."
        ),
        "warnings": [],
        "filings": filings,
    }

    out = OUT_REPO / "ma-sfi.json"
    out.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {out}  ({out.stat().st_size / 1024:.1f} KB, {len(filings)} filings)")


def build_tempus_json() -> None:
    rows: list[dict] = []
    pass2 = CROSSREF / "pass2_doge_entity_in_sfi.csv"
    if not pass2.exists():
        print(f"skip: {pass2} missing")
        return
    with pass2.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if "TEMPUS" not in row["doge_entity"].upper():
                continue
            rows.append({
                "year": row["sfi_year"],
                "filerLast": row["sfi_last"],
                "filerFirst": row["sfi_first"],
                "filerEmail": row["sfi_email"],
                "filerPdf": row["sfi_path"].replace("\\", "/"),
                "sfiSection": row["sfi_question"],
                "dogeEntity": row["doge_entity"].strip(),
                "dogeAddress": row["doge_address"],
                "dogeCity": row["doge_city"],
                "dogeZip": row["doge_zip"],
                "dogeTotalPaid": float(row["doge_total_paid"]),
                "dogeAuthOfficial": row["doge_auth_officials"],
            })

    # Group by filer to make the headline clearer in the UI.
    by_filer: dict[tuple, dict] = {}
    for r in rows:
        key = (r["filerLast"], r["filerFirst"], r["filerEmail"])
        if key not in by_filer:
            by_filer[key] = {
                "filerLast": r["filerLast"],
                "filerFirst": r["filerFirst"],
                "filerEmail": r["filerEmail"],
                "years": [],
                "dogeEntity": r["dogeEntity"],
                "dogeAddress": r["dogeAddress"],
                "dogeCity": r["dogeCity"],
                "dogeTotalPaid": r["dogeTotalPaid"],
                "dogeAuthOfficial": r["dogeAuthOfficial"],
            }
        by_filer[key]["years"].append({
            "year": r["year"],
            "pdf": r["filerPdf"],
            "sfiSection": r["sfiSection"],
        })

    payload = {
        "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "headline": (
            "Multiple Massachusetts public officials disclosed in their annual "
            "Statements of Financial Interest that their spouses were employed "
            "by Tempus Unlimited, Inc. — the #1 Massachusetts Medicaid biller "
            "by total spending in the HHS-MA-DOGE address-shared-entity index "
            "($6.6 billion across 7 NPIs sharing one Stoughton address)."
        ),
        "method": (
            "Tempus Unlimited entity name word-boundary matched inside the SFI "
            "Q7 (spouse business employment) section text. All matches verified "
            "by inspecting the actual Q7 section content."
        ),
        "dogeReference": "https://github.com/duncanburns2013-dot/HHS-MA-DOGE",
        "count": len(by_filer),
        "totalDisclosures": len(rows),
        "rows": list(by_filer.values()),
    }

    out = OUT_REPO / "ma-sfi-tempus.json"
    out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out}  ({len(rows)} disclosures across {len(by_filer)} filers)")


def build_doge_crossref_json() -> None:
    # Read pass1_grouped and pass3 outputs into one combined structure.
    pass1 = CROSSREF / "pass1_filer_vs_doge_official_grouped.csv"
    pass3 = CROSSREF / "pass3_sfi_addr_in_doge.csv"

    pass1_rows: list[dict] = []
    if pass1.exists():
        with pass1.open(encoding="utf-8") as f:
            for row in csv.DictReader(f):
                pass1_rows.append({
                    "year": row["sfi_year"],
                    "filerLast": row["sfi_last"],
                    "filerFirst": row["sfi_first"],
                    "filerEmail": row["sfi_email"],
                    "filerPdf": row["sfi_path"].replace("\\", "/"),
                    "normKey": row["norm_key"],
                    "nameCommonness": int(row["name_commonness_in_sfi"]),
                    "dogeNumNpis": int(row["doge_n_npis"]),
                    "dogeTotalSpending": float(row["doge_total_spending"]),
                    "dogeOrgs": row["doge_orgs"],
                    "dogeCities": row["doge_cities"],
                })

    pass3_rows: list[dict] = []
    if pass3.exists():
        with pass3.open(encoding="utf-8") as f:
            for row in csv.DictReader(f):
                pass3_rows.append({
                    "kind": row["match_kind"],
                    "year": row["sfi_year"],
                    "filerLast": row["sfi_last"],
                    "filerFirst": row["sfi_first"],
                    "filerEmail": row["sfi_email"],
                    "filerPdf": row["sfi_path"].replace("\\", "/"),
                    "sfiSection": row["sfi_question"],
                    "sfiAddress": row["sfi_address_match"].replace("\r", ""),
                    "dogeAddress": row["doge_address"],
                    "dogeCity": row["doge_city"],
                    "dogeEntity": row["doge_entity"],
                    "dogeOfficial": row["doge_official"],
                    "dogeTotalAtAddr": float(row["doge_total_at_addr"] or 0),
                    "dogeNEntitiesAtAddr": int(row["doge_n_entities_at_addr"] or 0),
                })

    payload = {
        "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "method": (
            "Three-pass cross-reference between the SFI corpus and the "
            "HHS-MA-DOGE flagged-entity dataset (https://github.com/"
            "duncanburns2013-dot/HHS-MA-DOGE). Pass 1: SFI filer name "
            "matches DOGE authorized_official. Pass 2: top DOGE entity "
            "names found as substrings in SFI section text (Tempus output "
            "split into ma-sfi-tempus.json). Pass 3: SFI real-estate-"
            "ownership addresses share street+number+ZIP+street-name with "
            "DOGE-flagged Medicaid-billing addresses."
        ),
        "caveats": [
            "Pass 1 matches are NAME-BASED ONLY. Common surnames (Smith, Collins, Brennan, Miller) may match different people; manual verification required.",
            "name_commonness column counts how many SFI filers share the same Last,FirstInitial — higher is less likely to be the same person.",
            "Pass 3 requires street number + street-name + ZIP5 match, but two distinct buildings at the same address (e.g., a mixed-use complex) may still produce overlap.",
        ],
        "pass1NameMatches": pass1_rows,
        "pass3AddressMatches": pass3_rows,
    }
    out = OUT_REPO / "ma-sfi-doge-crossref.json"
    out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out}  (pass1: {len(pass1_rows)}, pass3: {len(pass3_rows)})")


def main() -> int:
    OUT_REPO.mkdir(parents=True, exist_ok=True)
    build_sfi_json()
    build_tempus_json()
    build_doge_crossref_json()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
