#!/usr/bin/env python3
# parse-sos-industries.py
#
# Reads a dump from userscripts/sos-lobbyist-industry-scraper.user.js (the MA
# SOS Lobbyist Public Search "Industry Type" results grid) and writes, per
# registration year:
#
#   public/data/ma-lobbying-industries-{year}.json
#   {
#     year, scrapedAt, source, sourceUrl, note,
#     industryCount, clientCount,
#     industries: [{ industry, clientCount, clients: [{ name, sysvalue }, ...] }, ...]
#   }
#
# Join to other lobbying files on sysvalue, never on name: the SOS renormalises
# names between years ("Smith, Costello & Crawford" in 2025 is "Smith Costello &
# Crawford" in 2026), and even within a year the industry grid can carry extra
# spaces the Summary page does not.
#
# Usage:
#   python scripts/parse-sos-industries.py path/to/sos-lobbyist-industries-*.json [...]

import json
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = REPO / "public" / "data"


def main():
    dumps = [pathlib.Path(a) for a in sys.argv[1:]]
    if not dumps:
        print(__doc__ or "usage: parse-sos-industries.py <dump.json> [...]")
        sys.exit(1)

    # year -> industry -> sysvalue -> name
    by_year = {}
    scraped = {}
    for d in dumps:
        raw = json.loads(d.read_text(encoding="utf-8"))
        print(f"reading {d.name}  ({raw.get('count')} records)")
        for r in raw.get("records", []):
            if not (r.get("year") and r.get("industry") and r.get("sysvalue")):
                continue
            name = " ".join((r.get("name") or "").split())
            by_year.setdefault(r["year"], {}).setdefault(r["industry"], {})[r["sysvalue"]] = name
            scraped.setdefault(r["year"], []).append(raw.get("scrapedAt") or r.get("scrapedAt"))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for year in sorted(by_year):
        industries = [
            {
                "industry": ind,
                "clientCount": len(clients),
                "clients": [
                    {"name": n, "sysvalue": s}
                    for s, n in sorted(clients.items(), key=lambda kv: kv[1].lower())
                ],
            }
            for ind, clients in by_year[year].items()
        ]
        industries.sort(key=lambda i: (-i["clientCount"], i["industry"]))
        client_count = len({c["sysvalue"] for i in industries for c in i["clients"]})
        payload = {
            "year": year,
            "scrapedAt": max(s for s in scraped[year] if s),
            "source": "MA Secretary of State - Lobbyist Public Search (Industry Type)",
            "sourceUrl": "https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx",
            "note": (
                "Industry labels are the SOS's own, as selected by each client at "
                "registration. Results are clients only. Join on sysvalue, not name."
            ),
            "industryCount": len(industries),
            "clientCount": client_count,
            "industries": industries,
        }
        out = OUT_DIR / f"ma-lobbying-industries-{year}.json"
        out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print(f"  -> {out.name}  {len(industries)} industries  {client_count} clients  "
              f"{out.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
