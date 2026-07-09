#!/usr/bin/env python3
# parse-sos-lobbyist-grid.py
#
# Parses a *live-DOM* capture of the MA Secretary of State Lobbyist Public
# Search results grid (Default.aspx) and updates a single registration year's
# roster in public/data/ma-lobbying-registrants-{year}.json plus the shared
# ma-lobbying-registrants-index.json -- preserving every other year.
#
# WHY THIS EXISTS (vs. parse-sos-lobbyist-viewsource.py):
#   The SOS results grid is rendered by an ASP.NET postback. Chrome's
#   "View Source" / "Save As" re-requests the URL with a GET and gets back the
#   empty search form, so a saved source file never contains the grid. The
#   reliable capture is the *live DOM*, grabbed from the DevTools console:
#
#       (()=>{const h=document.documentElement.outerHTML;
#         const b=new Blob([h],{type:'text/html'});
#         const a=document.createElement('a');a.href=URL.createObjectURL(b);
#         a.download='sos-lobbyist-<year>-grid.html';
#         document.body.appendChild(a);a.click();a.remove();})();
#
#   That yields plain rendered HTML with normal <a> anchors -- NOT the
#   line-numbered view-source markup the older parser unwraps -- so this parser
#   reads the <tr class="GridItem"> rows directly.
#
# Usage:
#   python scripts/parse-sos-lobbyist-grid.py path/to/sos-lobbyist-2026-grid.html [--year 2026]
#
# Captures per registrant: accountType, name, sysvalue, summaryUrl. The year is
# auto-detected from the page's year dropdown unless --year is given.

import argparse
import html
import json
import pathlib
import re
from datetime import datetime, timezone

REPO = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = REPO / "public" / "data"
SUMMARY_BASE = "https://www.sec.state.ma.us/LobbyistPublicSearch/Summary.aspx?sysvalue="

ROW_RE = re.compile(r'<tr[^>]*class="Grid(?:Item|AlternatingItem)"[^>]*>(.*?)</tr>', re.DOTALL)
TYPE_RE = re.compile(r'lblUserType_\d+"[^>]*>([^<]+)</')
SYSVAL_RE = re.compile(r'Summary\.aspx\?sysvalue=([A-Za-z0-9+/=]+)')
NAME_RE = re.compile(r'hplDisplayName_\d+"[^>]*>(.*?)</a>', re.DOTALL)
YEAR_RE = re.compile(r'ddlYear"[^>]*>.*?<option[^>]*\bselected\b[^>]*value="(20\d\d)"', re.DOTALL)
YEAR_ALT_RE = re.compile(r'<option[^>]*\bselected\b[^>]*value="(20\d\d)"[^>]*>\s*20\d\d', re.DOTALL)


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def parse_grid(raw):
    recs, seen = [], set()
    for row in ROW_RE.findall(raw):
        t = TYPE_RE.search(row)
        s = SYSVAL_RE.search(row)
        n = NAME_RE.search(row)
        if not (t and s and n):
            continue
        sysv = s.group(1)
        if sysv in seen:
            continue
        seen.add(sysv)
        recs.append(
            {
                "accountType": clean(t.group(1)),
                "name": clean(n.group(1)),
                "sysvalue": sysv,
                "summaryUrl": SUMMARY_BASE + sysv,
            }
        )
    return recs


def detect_year(raw):
    m = YEAR_RE.search(raw) or YEAR_ALT_RE.search(raw)
    return m.group(1) if m else None


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("grid_html", help="live-DOM grid HTML capture from Default.aspx")
    ap.add_argument("--year", help="registration year (auto-detected if omitted)")
    args = ap.parse_args()

    src = pathlib.Path(args.grid_html)
    raw = src.read_text(encoding="utf-8", errors="replace")
    year = args.year or detect_year(raw)
    if not year:
        raise SystemExit("Could not detect registration year; pass --year")

    recs = parse_grid(raw)
    if not recs:
        raise SystemExit(
            "No registrant rows parsed -- is this a live-DOM grid capture with "
            "results loaded? (A plain View Source save of Default.aspx is empty.)"
        )

    by_type = {}
    for r in recs:
        by_type[r["accountType"]] = by_type.get(r["accountType"], 0) + 1

    now = datetime.now(timezone.utc).isoformat()
    detail = {
        "year": year,
        "fetchedAt": now,
        "source": "MA Secretary of State - Lobbyist Public Search (live-DOM grid capture)",
        "sourceUrl": "https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx",
        "sourceFile": src.name,
        "count": len(recs),
        "byAccountType": by_type,
        "registrants": recs,
    }
    out_path = DATA_DIR / f"ma-lobbying-registrants-{year}.json"
    # Compact (no indent), matching split-lobbying-registrants.py output.
    out_path.write_text(json.dumps(detail) + "\n", encoding="utf-8")
    print(f"wrote {out_path.name}: {len(recs)} registrants {by_type}")

    # Merge into the shared index, preserving every other year.
    idx_path = DATA_DIR / "ma-lobbying-registrants-index.json"
    idx = json.loads(idx_path.read_text(encoding="utf-8"))
    idx["fetchedAt"] = now
    idx.setdefault("years", {})[year] = {
        "count": len(recs),
        "byAccountType": by_type,
        "detailFile": f"data/ma-lobbying-registrants-{year}.json",
    }
    idx_path.write_text(json.dumps(idx, indent=2) + "\n", encoding="utf-8")
    print(f"updated {idx_path.name}: years now {sorted(idx['years'])}")


if __name__ == "__main__":
    main()
