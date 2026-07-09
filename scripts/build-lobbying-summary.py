#!/usr/bin/env python3
# build-lobbying-summary.py
#
# Regenerates public/data/ma-lobbying.json (the Lobbying Explorer "Overview /
# Top Firms / By Industry" summary) from the per-firm detail snapshots, so the
# summary stops going stale. It was previously hand-built from a View Source
# dump (fetch-ma-lobbying.mjs is only a no-op preserver), which is why its
# fetchedAt froze at Apr 15 while the underlying firm-detail scrapes moved on.
#
# Derives from:
#   - ma-lobbying-firm-details-2025.json  -> top20 (2025 fees/rosters), keyIndividuals
#   - ma-lobbying-firm-details-2026.json  -> entities2026, totalRevenue2026
#   - ma-lobbying-registrants-2025.json   -> uniqueClients / uniqueLobbyists
#                                            (distinct 2025 registrant rows by type)
#   - existing ma-lobbying.json           -> preserves curated `focus` industry
#                                            tags (name-joined)
#
# The 2025 disclosure year is complete, so totalRevenue2025 is final (verified
# byte-identical to the prior summary). Roster counts (clients/lobbyists per
# firm) are refreshed to the firm-detail scrape so the Top Firms cards match
# their own drill-down panels.
#
# Usage: python scripts/build-lobbying-summary.py

import json
import pathlib

REPO = pathlib.Path(__file__).resolve().parent.parent
DATA = REPO / "public" / "data"


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def rint(x):
    return int(round(x or 0))


def main():
    old = load("ma-lobbying.json")
    fd25 = load("ma-lobbying-firm-details-2025.json")
    fd26 = load("ma-lobbying-firm-details-2026.json")
    # Authoritative "who registered" roster for the unique-counts KPIs.
    reg25_by_type = load("ma-lobbying-registrants-2025.json").get("byAccountType", {})

    # Preserve curated per-firm industry tags by name-join.
    focus_by_name = {f["name"]: f.get("focus") for f in old.get("top20", []) if f.get("focus")}

    # --- top20: every 2025 entity with disclosed revenue, ranked by revenue.
    firms25 = [f for f in fd25["firms"] if (f.get("totalSalariesReceived") or 0) > 0]
    firms25.sort(key=lambda f: -(f.get("totalSalariesReceived") or 0))
    top20 = []
    for i, f in enumerate(firms25):
        clients = sorted(f.get("clients", []), key=lambda c: -(c.get("amount") or 0))
        lobs = sorted(f.get("lobbyists", []), key=lambda l: -(l.get("amount") or 0))
        top20.append({
            "rank": i + 1,
            "name": f["name"],
            "totalExpenditure": rint(f.get("totalSalariesReceived")),
            "directExpenses": rint(f.get("totalExpenses")),
            "clients": f.get("clientCount") or len(f.get("clients", [])),
            "lobbyistCount": f.get("lobbyistCount") or len(f.get("lobbyists", [])),
            "focus": focus_by_name.get(f["name"]),
            "type": f.get("type") or "Registered Lobbying Entity",
            "address": f.get("address"),
            "year": "2025",
            "topClients": [{"name": c["name"], "amount": rint(c.get("amount"))} for c in clients[:8] if c.get("name")],
            "lobbyists": [{"name": l["name"], "salary": rint(l.get("amount"))} for l in lobs[:8] if l.get("name")],
        })

    # --- keyIndividuals: 2025 lobbyists aggregated by name across firms.
    agg = {}
    for f in fd25["firms"]:
        for l in f.get("lobbyists", []):
            nm = (l.get("name") or "").strip()
            if not nm:
                continue
            rec = agg.setdefault(nm, {"salary": 0.0, "firms": []})
            rec["salary"] += l.get("amount") or 0
            if f["name"] not in rec["firms"]:
                rec["firms"].append(f["name"])
    key_individuals = []
    for nm, rec in sorted(agg.items(), key=lambda kv: -kv[1]["salary"])[:40]:
        key_individuals.append({
            "name": nm,
            "role": "Registered Lobbyist",
            "firm": rec["firms"][0] if rec["firms"] else "",
            "firms": rec["firms"],
            "totalSalary": rint(rec["salary"]),
            "note": "Registered at multiple firms" if len(rec["firms"]) > 1 else "",
        })

    entities_with_data = len(firms25)
    total_rev_2025 = rint(sum(f.get("totalSalariesReceived") or 0 for f in fd25["firms"]))
    total_rev_2026 = rint(sum(f.get("totalSalariesReceived") or 0 for f in fd26["firms"]))

    stats = {
        "entities2025": fd25.get("firmCount", len(fd25["firms"])),
        "entities2026": fd26.get("firmCount", len(fd26["firms"])),
        "entitiesWithData": entities_with_data,
        "totalRevenue2025": total_rev_2025,
        "totalRevenue2026": total_rev_2026,
        # Unique registered clients / lobbyists = distinct 2025 SOS registrant
        # rows (deduped by sysvalue) of each account type. Directly verifiable
        # against ma-lobbying-registrants-2025.json byAccountType.
        "uniqueClients": reg25_by_type.get("Client", old["stats"]["uniqueClients"]),
        "uniqueLobbyists": reg25_by_type.get("Lobbyist", old["stats"]["uniqueLobbyists"]),
    }

    payload = {
        # 2025 fees are final; 2026 registrations pulled 2026-07-08. Date the
        # composite to the most recent underlying scrape.
        "fetchedAt": fd26.get("scrapedAt") or old["fetchedAt"],
        "source": old["source"],
        "sourceUrl": old.get("sourceUrl", "https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx"),
        "note": (
            "2025 is a complete disclosure year (fee totals are final). 2026 shows "
            "registration activity only — fee-disclosure reports are not yet due, so "
            "2026 revenue reads $0. Regenerated from the MA SOS firm-detail snapshots "
            "by scripts/build-lobbying-summary.py."
        ),
        "registrationYears": ["2025", "2026"],
        "totalRecords": stats["entities2025"] + stats["entities2026"],
        "stats": stats,
        "top20": top20,
        "keyIndividuals": key_individuals,
        "warnings": [
            "2026 expenditure data shows $0 for most entities — disclosure reports "
            "are not yet due. 2025 data is complete.",
        ],
    }

    (DATA / "ma-lobbying.json").write_text(json.dumps(payload, indent=1) + "\n", encoding="utf-8")
    print(f"wrote ma-lobbying.json  fetchedAt={payload['fetchedAt']}")
    print(f"  entities2025={stats['entities2025']} entities2026={stats['entities2026']} "
          f"withData={entities_with_data}")
    print(f"  totalRevenue2025=${total_rev_2025:,} (was ${old['stats']['totalRevenue2025']:,})")
    print(f"  top20={len(top20)} keyIndividuals={len(key_individuals)}")
    missing_focus = [f["name"] for f in top20 if not f["focus"]]
    print(f"  focus preserved for {len(top20)-len(missing_focus)}/{len(top20)} firms")


if __name__ == "__main__":
    main()
