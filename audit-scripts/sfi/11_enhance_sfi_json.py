"""Enhance ma-sfi.json with per-filing entity names + key flags.

For each filing, pull from the JSONL:
- spouseTopEmployer       first business name in Q7
- ownTopEmployer          first business name in Q5
- ownTopRealEstate        first MA address in Q13
- spouseTopRealEstate     first MA address in Q14
- topMortgageCreditor     first creditor name in Q29 or Q30
- hasTempusDisclosure     bool: Tempus appears anywhere in Q5/Q7/Q8/Q9 text
- hasLobbyistGifts        bool: any of Q36/Q36.a/Q37/Q37.a/Q38/Q39 non-empty
- hasInterestedPartyGifts bool: any of Q36.a/Q37.a non-empty
- hasBlindTrust           bool: Q40 non-empty
- disclosureScore         sum of question-flag categories, used for default sort
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import re
from pathlib import Path

OUT = Path(r"C:\Users\dunca\The-Peoples-Audit\public\data\ma-sfi.json")
SFI_DIR = Path(r"C:\PeoplesAudit\out")
MASTER = SFI_DIR / "sfi_master.csv"
JSONL = SFI_DIR / "sfi_text.jsonl"

# Stuff to strip from raw section text before extracting names — the question
# prompt prose precedes the actual table contents.
def clean_body(text: str) -> str:
    # Drop the leading prompt up through "Self-employed" or first newline blob.
    text = re.sub(r"^.*?(Business Name|Property Address|Creditor Name).*?\n", "", text, count=1, flags=re.S)
    text = re.sub(r"Original\s+Page\s+\d+\s+of\s+\d+", "", text)
    return text


def first_business_name(text: str) -> str:
    """Best-effort: first non-trivial line that looks like an entity name."""
    if not text or "Filer reported none" in text:
        return ""
    body = clean_body(text)
    # Take first non-empty line that isn't a column header or "Employee" etc.
    SKIP = {"Employee", "Employer", "N/A", "Self-employed", "Position", "Address",
            "Business Name", "Property Address", "Owner", "Independent Contractor",
            "$100,001 or more", "$1 to $1,000", "$1,001 to $5,000",
            "$5,001 to $10,000", "$10,001 to $20,000", "$20,001 to $40,000",
            "$40,001 to $60,000", "$60,001 to $80,000", "$80,001 to $100,000",
            "Mortgage Term", "Interest Rate (%)", "Termination Year",
            "Amount of Income", "Original Amount", "Outstanding Amount",
            "Obligor", "Creditor Name", "Creditor Address"}
    for line in body.splitlines():
        s = line.strip()
        if not s or s in SKIP:
            continue
        if re.match(r"^\$\d", s) or re.match(r"^\d", s):
            continue
        if len(s) < 3 or len(s) > 90:
            continue
        if s.startswith("Redacted"):
            continue
        return s
    return ""


def first_ma_town(text: str) -> str:
    """Pull the first city from a `City, MA, ZIP, US` pattern."""
    if not text or "Filer reported none" in text:
        return ""
    m = re.search(r"([A-Z][A-Za-z .\-']{2,30}),\s+MA,?\s+\d{5}", text)
    return m.group(1).strip() if m else ""


def category_for(email: str) -> str:
    e = (email or "").lower()
    if "@mahouse.gov" in e: return "House"
    if "@masenate.gov" in e: return "Senate"
    if "@jud.state.ma.us" in e: return "Judiciary"
    if "@dot.state.ma.us" in e: return "MassDOT"
    if "@doc.state.ma.us" in e: return "DOC"
    if "@dor.state.ma.us" in e: return "DOR"
    if "@sec.state.ma.us" in e: return "Sec. of State"
    if "@mbta.com" in e: return "MBTA"
    if "@masshousing.com" in e: return "MassHousing"
    if "@mwra.com" in e: return "MWRA"
    if "@pol.state.ma.us" in e: return "State Police"
    if "@mass.gov" in e or "@state.ma.us" in e: return "Executive"
    if e.endswith(".edu"): return "Higher Ed"
    return "Other"


GIFT_QS = {"36", "36.a", "37", "37.a", "38", "39"}
EMPLOYMENT_QS = {"5", "7"}
BUSINESS_OWN_QS = {"8", "9", "11", "12"}
REAL_ESTATE_QS = {"13", "14", "15", "16", "17", "18", "19", "20"}
INVESTMENT_QS = {"21", "22", "23", "24", "25", "26", "27", "28"}
DEBT_QS = {"29", "30", "31", "32", "33", "34", "35"}


def section_has_content(sections: dict, qs: set) -> bool:
    for q in qs:
        body = sections.get(q, "")
        if body and "Filer reported none" not in body:
            return True
    return False


def main() -> int:
    filings: list[dict] = []
    n_tempus = 0
    n_lobbyist_gifts = 0

    with JSONL.open(encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            sections = rec["sections"]
            q5 = sections.get("5", "")
            q7 = sections.get("7", "")
            q13 = sections.get("13", "")
            q14 = sections.get("14", "")
            q29 = sections.get("29", "")
            q30 = sections.get("30", "")

            full_employment_text = (q5 + " " + q7).upper()
            full_ownership_text = (sections.get("8", "") + " " + sections.get("9", "")).upper()
            has_tempus = "TEMPUS" in full_employment_text or "TEMPUS" in full_ownership_text
            if has_tempus:
                n_tempus += 1

            gifts_present = section_has_content(sections, GIFT_QS)
            if gifts_present:
                n_lobbyist_gifts += 1
            interested_party = (
                (sections.get("36.a", "") and "Filer reported none" not in sections["36.a"]) or
                (sections.get("37.a", "") and "Filer reported none" not in sections["37.a"])
            )
            has_blind_trust = section_has_content(sections, {"40"})

            score = 0
            score += 3 if has_tempus else 0
            score += 2 if interested_party else 0
            score += 1 if gifts_present else 0
            score += 1 if section_has_content(sections, EMPLOYMENT_QS) else 0
            score += 1 if section_has_content(sections, BUSINESS_OWN_QS) else 0
            score += 1 if section_has_content(sections, REAL_ESTATE_QS) else 0
            score += 1 if section_has_content(sections, INVESTMENT_QS) else 0
            score += 1 if section_has_content(sections, DEBT_QS) else 0
            score += 1 if has_blind_trust else 0

            filings.append({
                "legislatorName": f"{rec['last_name']}, {rec['first_name']}".strip(", "),
                "chamber": category_for(rec["work_email"]),
                "filingYear": rec["year"],
                "workEmail": rec["work_email"],
                "submitted": rec["submitted"],
                "score": score,
                # Headline flags surfaced as table chips
                "hasTempus": has_tempus,
                "hasInterestedPartyGifts": bool(interested_party),
                "hasLobbyistGifts": gifts_present,
                "hasBlindTrust": has_blind_trust,
                # First entity names per section — what to show in the table.
                "ownTopEmployer": first_business_name(q5),
                "spouseTopEmployer": first_business_name(q7),
                "ownRealEstate": first_ma_town(q13),
                "spouseRealEstate": first_ma_town(q14),
                "topMortgageCreditor": first_business_name(q29) or first_business_name(q30),
                # Aggregate counts kept for compatibility.
                "employers": (1 if section_has_content(sections, {"5"}) else 0) + (1 if section_has_content(sections, {"7"}) else 0),
                "businessOwnership": sum(1 for q in BUSINESS_OWN_QS if section_has_content(sections, {q})),
                "realEstate": sum(1 for q in REAL_ESTATE_QS if section_has_content(sections, {q})),
                "investments": sum(1 for q in INVESTMENT_QS if section_has_content(sections, {q})),
                "debts": sum(1 for q in DEBT_QS if section_has_content(sections, {q})),
                "gifts": sum(1 for q in GIFT_QS if section_has_content(sections, {q})),
                # NO sourcePdfUrl here on purpose. It used to be built by string
                # concatenation against sfi-<YYYY>, which produced 29,729 dead
                # links: GitHub caps a release at 1000 assets, so each year's
                # PDFs are spread over several releases and a filing's shard
                # depends on upload order. It also silently renames filenames
                # with special characters. Neither is knowable from the filing.
                #
                # 16_write_sfi_pdf_urls.py asks the releases where each PDF
                # actually is and writes sourcePdfUrl back. Run it after
                # 15_publish_release_pdfs.py. Filings with no published asset
                # keep no sourcePdfUrl, and SfiExplorer then renders no button
                # rather than a broken one.
                "relPath": rec["rel_path"].replace("\\", "/"),
            })

    # Sort by score DESC, then last_name ASC. Table default render is interesting filings first.
    filings.sort(key=lambda f: (-f["score"], f["legislatorName"].lower()))

    payload = {
        "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "status": "live",
        "version": "v2-enhanced",
        "filingsYears": sorted({f["filingYear"] for f in filings}),
        "count": len(filings),
        "tempusFilingsCount": n_tempus,
        "lobbyistGiftFilingsCount": n_lobbyist_gifts,
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

    OUT.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
    size_mb = OUT.stat().st_size / 1024 / 1024
    print(f"wrote {OUT}  ({size_mb:.1f} MB, {len(filings)} filings)")
    print(f"  with Tempus in employment text:  {n_tempus}")
    print(f"  with any lobbyist/gift section:  {n_lobbyist_gifts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
