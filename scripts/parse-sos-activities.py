#!/usr/bin/env python3
# parse-sos-activities.py
#
# Reads bill-activity dumps produced by the Tampermonkey userscript
#   userscripts/sos-lobbyist-detail-scraper.user.js  ("Download activities")
# i.e. sos-lobbyist-activities-<stamp>.json, one record per registrant:
#
#   { sysvalue, year, accountType, name, url, scrapedAt,
#     reports: [ { url, period,
#                  blocks: [ { table, format, client, clientTotalPaid, lobbyist,
#                              rows: [[chamber, billNumber, bill, title, position,
#                                      amount, directBusinessAssociation, isTotal]] } ] } ] }
#
# and writes public/data/ma-lobbying-activities-{year}.json.
#
# ~200k rows a year, so the output is three header+rows tables rather than an
# array of objects, joined by index:
#   reports  one per CompleteDisclosure.aspx report (registrant, period, url)
#   blocks   one per client table in a report (report -> client, lobbyist)
#   rows     one per activity line (block -> bill, title, position, ...)
# Titles repeat heavily (one bill, many clients), so rows hold an index into
# `titles`.
#
# Usage:
#   python scripts/parse-sos-activities.py [dump.json ...]
# If no args, reads every sos-lobbyist-activities-*.json in .cache/sos-firm-scrapes/.
# Later dumps win when the same registrant appears twice.

import json
import sys
import pathlib
from collections import Counter

REPO = pathlib.Path(__file__).resolve().parent.parent
CACHE_DIR = REPO / ".cache" / "sos-firm-scrapes"
OUT_DIR = REPO / "public" / "data"

ROW_COLUMNS = [
    "chamber", "billNumber", "bill", "title", "position", "amount",
    "directBusinessAssociation", "isTotal",
]


def load_records(dump_path):
    raw = json.loads(pathlib.Path(dump_path).read_text(encoding="utf-8"))
    cols = raw.get("rowColumns") or ROW_COLUMNS
    missing = [c for c in ROW_COLUMNS if c not in cols]
    if missing:
        sys.exit(f"{dump_path}: rowColumns missing {missing}")
    pos = {c: cols.index(c) for c in ROW_COLUMNS}
    records = raw.get("records", [])
    for rec in records:
        for rep in rec.get("reports", []):
            for b in rep.get("blocks", []):
                # Re-order into ROW_COLUMNS so a reordered dump still parses.
                b["rows"] = [[r[pos[c]] if pos[c] < len(r) else None for c in ROW_COLUMNS]
                             for r in b.get("rows", [])]
    return records


def build(records):
    reports, blocks, rows, titles = [], [], [], []
    title_ix = {}
    chambers, positions = Counter(), Counter()
    zero_row_by_type, no_report_by_type = Counter(), Counter()
    activity_count = total_count = 0

    for rec in sorted(records, key=lambda r: ((r.get("name") or "").lower(), r.get("sysvalue") or "")):
        rtype = rec.get("accountType") or ""
        if not rec.get("reports"):
            no_report_by_type[rtype] += 1
            continue
        rec_rows = 0
        for rep in rec["reports"]:
            report_i = len(reports)
            reports.append([rec.get("name"), rtype, rec.get("sysvalue"), rep.get("period"), rep.get("url")])
            for b in rep.get("blocks", []):
                block_i = len(blocks)
                blocks.append([report_i, b.get("format"), b.get("client") or None,
                               b.get("clientTotalPaid"), b.get("lobbyist") or None])
                for chamber, bill_no, bill, title, position, amount, dba, is_total in b["rows"]:
                    title = title or None
                    if title is not None and title not in title_ix:
                        title_ix[title] = len(titles)
                        titles.append(title)
                    is_total = bool(is_total)
                    rows.append([block_i, chamber or None, bill_no or None, bill,
                                 title_ix.get(title) if title is not None else None,
                                 position or None, amount, dba or None, is_total])
                    if is_total:
                        total_count += 1
                    else:
                        activity_count += 1
                        chambers[chamber or ""] += 1
                        positions[position or ""] += 1
                    rec_rows += 1
        if rec_rows == 0:
            zero_row_by_type[rtype] += 1

    stats = {
        "chambers": chambers, "positions": positions,
        "zeroRowRegistrantsByType": zero_row_by_type,
        "noReportRegistrantsByType": no_report_by_type,
    }
    return reports, blocks, rows, titles, activity_count, total_count, stats


def main():
    args = sys.argv[1:]
    dumps = [pathlib.Path(a) for a in args] if args else sorted(CACHE_DIR.glob("sos-lobbyist-activities-*.json"))
    if not dumps:
        print(f"No dumps found in {CACHE_DIR}")
        sys.exit(1)

    by_year, scraped_ats = {}, {}
    for d in dumps:
        print(f"reading {d.name}")
        for rec in load_records(d):
            yr = str(rec.get("year") or "unknown")
            key = rec.get("sysvalue") or rec.get("name")
            if key:
                by_year.setdefault(yr, {})[key] = rec
            if rec.get("scrapedAt"):
                scraped_ats.setdefault(yr, []).append(rec["scrapedAt"])

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for year in sorted(by_year):
        records = list(by_year[year].values())
        reports, blocks, rows, titles, n_act, n_tot, stats = build(records)
        payload = {
            "year": year,
            "scrapedAt": max(scraped_ats[year]) if scraped_ats.get(year) else None,
            "source": "MA Secretary of State - Lobbyist Public Search (CompleteDisclosure.aspx)",
            "sourceUrl": "https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx",
            "note": (
                "Bill and agency activity lines from each registrant's disclosure "
                "reports, via the in-browser scraper userscript. Both report formats "
                "are included: lobbying-firm reports (format 'firm', table "
                "grdvActivitiesNew2020) and in-house lobbyist reports (format "
                "'in-house', table grdvActivitiesNew). `amount` is the per-activity "
                "figure as filed and is $0 on nearly every row because filers state "
                "they cannot report compensation at activity level; it is NOT dollars "
                "spent per bill. clientTotalPaid is the client-level total printed "
                "beside the client name on the report. Rows with isTotal=true are "
                "report total lines, not activities. `bill` is H/S + optional D "
                "(docket) + number for House/Senate Bill/Docket rows, the agency name "
                "for Executive rows, and the raw cell text otherwise."
            ),
            "registrantCount": len(records),
            "reportCount": len(reports),
            "blockCount": len(blocks),
            "activityCount": n_act,
            "totalRowCount": n_tot,
            "count": len(rows),
            "reports": {
                "columns": ["registrant", "registrantType", "registrantSysvalue", "reportPeriod", "url"],
                "rows": reports,
            },
            "blocks": {
                "columns": ["report", "format", "client", "clientTotalPaid", "lobbyist"],
                "rows": blocks,
            },
            "titles": titles,
            "columns": ["block", "chamber", "billNumber", "bill", "title", "position",
                        "amount", "directBusinessAssociation", "isTotal"],
            "rows": rows,
        }
        out_path = OUT_DIR / f"ma-lobbying-activities-{year}.json"
        out_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
                            encoding="utf-8")
        print(
            f"  -> {out_path.name:42} {len(records):>5} registrants  {len(reports):>5} reports  "
            f"{n_act:>7} activities  {n_tot:>6} totals  {out_path.stat().st_size:>11,} bytes"
        )
        print(f"     chambers:  {dict(stats['chambers'].most_common())}")
        print(f"     positions: {dict(stats['positions'].most_common())}")
        # The failure this guards against: a parser that reads only one table
        # format leaves a whole registrant type with reports but no rows.
        if stats["zeroRowRegistrantsByType"]:
            print(f"     registrants with reports but 0 rows: {dict(stats['zeroRowRegistrantsByType'])}")
        if stats["noReportRegistrantsByType"]:
            print(f"     registrants with no disclosure report: {dict(stats['noReportRegistrantsByType'])}")


if __name__ == "__main__":
    main()
