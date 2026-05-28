#!/usr/bin/env python3
# split-lobbying-registrants.py
#
# Splits the 11.7 MB ma-lobbying-registrants.json (all 11 years inline) into:
#   - ma-lobbying-registrants-index.json    -- ~5 KB summary, loaded eagerly
#   - ma-lobbying-registrants-YYYY.json     -- per year, loaded on demand
#
# Run after parse-sos-lobbyist-viewsource.py.

import json, pathlib

DATA_DIR = pathlib.Path(__file__).resolve().parent.parent / "public" / "data"
SRC = DATA_DIR / "ma-lobbying-registrants.json"

def main():
    payload = json.loads(SRC.read_text(encoding="utf-8"))
    years = payload["years"]

    index = {
        "fetchedAt": payload["fetchedAt"],
        "source": payload["source"],
        "sourceUrl": payload["sourceUrl"],
        "note": payload["note"],
        "years": {},
    }

    for year in sorted(years.keys()):
        y = years[year]
        # Per-year detail file
        detail = {
            "year": year,
            "fetchedAt": payload["fetchedAt"],
            "source": payload["source"],
            "sourceUrl": payload["sourceUrl"],
            "sourceFile": y["sourceFile"],
            "count": y["count"],
            "byAccountType": y["byAccountType"],
            "registrants": y["registrants"],
        }
        out_path = DATA_DIR / f"ma-lobbying-registrants-{year}.json"
        out_path.write_text(json.dumps(detail) + "\n", encoding="utf-8")
        size = out_path.stat().st_size
        print(f"  wrote {out_path.name:40} ({size:>9,} bytes, {y['count']:,} rows)")

        # Index entry (just totals, no registrant rows)
        index["years"][year] = {
            "count": y["count"],
            "byAccountType": y["byAccountType"],
            "detailFile": f"data/ma-lobbying-registrants-{year}.json",
        }

    index_path = DATA_DIR / "ma-lobbying-registrants-index.json"
    index_path.write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    print(f"\n  wrote {index_path.name:40} ({index_path.stat().st_size:>9,} bytes)")

    # Drop the monolithic copy to save repo space (we always rebuild from
    # the View Source dumps + the splitter).
    if SRC.exists():
        SRC.unlink()
        print(f"  removed {SRC.name} (monolith no longer needed)")

if __name__ == "__main__":
    main()
