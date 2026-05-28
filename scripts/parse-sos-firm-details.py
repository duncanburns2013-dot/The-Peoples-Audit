#!/usr/bin/env python3
# parse-sos-firm-details.py
#
# Reads a raw scrape dump produced by the Tampermonkey userscript
#   userscripts/sos-lobbyist-detail-scraper.user.js
# and flattens each Summary.aspx page into a clean per-firm record:
#
#   {
#     name, address, year, type, sysvalue, url,
#     totalSalariesPaid, totalSalariesReceived,
#     lobbyists: [{ name, sysvalue, amount, employedDate, terminatedDate }, ...],
#     clients:   [{ name, sysvalue, amount, employedDate, terminatedDate, purpose }, ...],
#     expenditures: [{ description, amount }, ...] | "No expense has been disclosed.",
#     registrationDate,
#     disclosureReports: [ ... ] | "No Disclosure Report has been concluded for ..."
#   }
#
# Output: public/data/ma-lobbying-firm-details-{year}.json
#
# Usage:
#   python scripts/parse-sos-firm-details.py [path/to/scrape.json] [path/to/scrape2.json] ...
#
# If no args, processes every *.json in .cache/sos-firm-scrapes/.
#
# Notes:
#   - Mid-year-only scrapes of the current registration year will show $0 for
#     every amount; that's not a bug, it's that MA SOS disclosure reports are
#     filed twice a year and the current year may have none filed yet.
#   - Records from older years that DO have disclosure reports will carry the
#     actual fee amounts.

import json
import re
import sys
import pathlib
from datetime import datetime, timezone

REPO = pathlib.Path(__file__).resolve().parent.parent
CACHE_DIR = REPO / ".cache" / "sos-firm-scrapes"
OUT_DIR = REPO / "public" / "data"


def money(text):
    """'$1,234.56' -> 1234.56 | '$0.00' -> 0 | '' -> None"""
    if not text:
        return None
    m = re.search(r"-?\$?([\d,]+(?:\.\d+)?)", text)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


def find_sysvalue(href):
    m = re.search(r"sysvalue=([^&]+)", href or "")
    return m.group(1) if m else None


def parse_record(rec):
    spans = rec.get("spans", {})
    links = rec.get("links", [])

    def s(key):
        return spans.get(key, "").strip() or None

    name = s("ContentPlaceHolder1_lblRegistrantName") or rec.get("name")
    year = s("ContentPlaceHolder1_lblYear") or rec.get("year")
    reg_type = s("ContentPlaceHolder1_lblRegType") or rec.get("accountType")
    address = s("ContentPlaceHolder1_lblRegistrantAddress")

    # --- Lobbyists: walk N=0,1,2,... while RptLobbyistInfo_lblAmount_N exists
    lobbyists = []
    by_id = {l.get("id"): l for l in links if l.get("id")}
    n = 0
    while True:
        amt_key = f"ContentPlaceHolder1_RptLobbyistInfo_lblAmount_{n}"
        if amt_key not in spans:
            break
        link = by_id.get(
            f"ContentPlaceHolder1_RptLobbyistInfo_hlnkClientInformation_{n}"
        )
        emp_key = (
            f"ContentPlaceHolder1_RptLobbyistInfo_RptLobbyistEmploymentInfo_{n}"
            f"_lblEmploymentDate_0"
        )
        term_key = (
            f"ContentPlaceHolder1_RptLobbyistInfo_RptLobbyistEmploymentInfo_{n}"
            f"_lblTerminationDate_0"
        )
        lobbyists.append(
            {
                "name": (link or {}).get("text") or None,
                "sysvalue": find_sysvalue((link or {}).get("href")),
                "amount": money(spans[amt_key]),
                "employedDate": spans.get(emp_key, "").strip() or None,
                "terminatedDate": spans.get(term_key, "").strip() or None,
            }
        )
        n += 1

    # --- Clients: same pattern with RptClient_*
    clients = []
    n = 0
    while True:
        amt_key = f"ContentPlaceHolder1_RptClient_lblAmount_{n}"
        if amt_key not in spans:
            break
        link = by_id.get(f"ContentPlaceHolder1_RptClient_hlnkClientInformation_{n}")
        emp_key = (
            f"ContentPlaceHolder1_RptClient_RptClientEmploymentInfo_{n}"
            f"_lblEmploymentDate_0"
        )
        term_key = (
            f"ContentPlaceHolder1_RptClient_RptClientEmploymentInfo_{n}"
            f"_lblTerminationDate_0"
        )
        purpose_key = (
            f"ContentPlaceHolder1_RptClient_RptClientEmploymentInfo_{n}"
            f"_lblPurposeOfEmp_0"
        )
        clients.append(
            {
                "name": (link or {}).get("text") or None,
                "sysvalue": find_sysvalue((link or {}).get("href")),
                "amount": money(spans[amt_key]),
                "employedDate": spans.get(emp_key, "").strip() or None,
                "terminatedDate": spans.get(term_key, "").strip() or None,
                "purpose": spans.get(purpose_key, "").strip() or None,
            }
        )
        n += 1

    total_paid = money(s("ContentPlaceHolder1_RptLobbyistInfo_lblTotalExpense"))
    total_received = money(s("ContentPlaceHolder1_RptClient_lblTotalReceived"))

    # --- Expenditures: small inline section. Often just a "no expense" notice.
    # Look for any expenditure rows in spans.
    expenditures = []
    n = 0
    while True:
        desc_key = f"ContentPlaceHolder1_RptExpense_lblDescription_{n}"
        amt_key = f"ContentPlaceHolder1_RptExpense_lblAmount_{n}"
        if desc_key not in spans and amt_key not in spans:
            break
        expenditures.append(
            {
                "description": spans.get(desc_key, "").strip() or None,
                "amount": money(spans.get(amt_key)),
            }
        )
        n += 1

    # --- Registration date
    reg_date = s("ContentPlaceHolder1_lblRegistrationDate")
    if not reg_date:
        # fallback: regex over the page's concatenated text content.
        # Older userscript dumps (v1.0/v1.1) stored a `tables` field; v1.2+
        # stores a single `text` blob. Handle both for backward compat.
        haystack = rec.get("text") or ""
        if not haystack:
            for t in rec.get("tables", []) or []:
                for row in t.get("rows", []) or []:
                    haystack += " " + " ".join(row)
        m = re.search(r"Initial registration\s+(\d{2}-\d{2}-\d{4})", haystack)
        if m:
            reg_date = m.group(1)

    return {
        "name": name,
        "year": year,
        "type": reg_type,
        "address": address,
        "sysvalue": rec.get("sysvalue"),
        "url": rec.get("url"),
        "totalSalariesPaid": total_paid,
        "totalSalariesReceived": total_received,
        "lobbyistCount": len(lobbyists),
        "clientCount": len(clients),
        "lobbyists": lobbyists,
        "clients": clients,
        "expenditures": expenditures,
        "registrationDate": reg_date,
        "scrapedAt": rec.get("scrapedAt"),
    }


def process_dump(dump_path):
    raw = json.loads(pathlib.Path(dump_path).read_text(encoding="utf-8"))
    by_year = {}
    for rec in raw.get("records", []):
        parsed = parse_record(rec)
        yr = parsed["year"] or rec.get("year") or "unknown"
        by_year.setdefault(yr, []).append(parsed)
    return by_year, raw.get("scrapedAt")


def main():
    args = sys.argv[1:]
    if args:
        dumps = [pathlib.Path(a) for a in args]
    else:
        dumps = sorted(CACHE_DIR.glob("sos-lobbyist-detail-*.json"))
        if not dumps:
            print(f"No dumps found in {CACHE_DIR}")
            sys.exit(1)

    # Merge across multiple dump files (so the user can run several scrapes).
    combined = {}
    scraped_ats = []
    for d in dumps:
        print(f"reading {d.name}")
        by_year, scraped_at = process_dump(d)
        if scraped_at:
            scraped_ats.append(scraped_at)
        for year, recs in by_year.items():
            bucket = combined.setdefault(year, {})
            for r in recs:
                key = r["sysvalue"] or r["name"]
                if key:
                    bucket[key] = r

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for year in sorted(combined):
        firms = sorted(
            combined[year].values(),
            key=lambda f: (-(f.get("totalSalariesReceived") or 0), (f.get("name") or "").lower()),
        )
        total_received = sum(f.get("totalSalariesReceived") or 0 for f in firms)
        total_paid = sum(f.get("totalSalariesPaid") or 0 for f in firms)
        payload = {
            "year": year,
            "scrapedAt": max(scraped_ats) if scraped_ats else datetime.now(timezone.utc).isoformat(),
            "source": "MA Secretary of State - Lobbyist Public Search (Summary.aspx)",
            "sourceUrl": "https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx",
            "note": (
                "Per-firm detail extracted from MA SOS Summary.aspx pages "
                "via the in-browser scraper userscript. Mid-year scrapes of "
                "the current registration year will show $0 amounts because "
                "MA disclosure reports are filed mid-year and end-of-year; "
                "the lobbyist roster, client roster, and purpose-of-engagement "
                "text are populated as soon as the firm registers."
            ),
            "firmCount": len(firms),
            "totalSalariesReceived": total_received,
            "totalSalariesPaid": total_paid,
            "firms": firms,
        }
        out_path = OUT_DIR / f"ma-lobbying-firm-details-{year}.json"
        out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        size = out_path.stat().st_size
        print(
            f"  -> {out_path.name:42} {len(firms):>4} firms  "
            f"{size:>9,} bytes  $received={total_received:,.0f}"
        )


if __name__ == "__main__":
    main()
