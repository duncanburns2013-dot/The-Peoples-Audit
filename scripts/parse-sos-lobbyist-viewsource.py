#!/usr/bin/env python3
# parse-sos-lobbyist-viewsource.py
#
# Parses MA Secretary of State Lobbyist Public Search "View Source" HTML files
# (Chromes view-source: rendering - line-numbered, entity-encoded) saved by hand
# because the SOS site blocks automated cloud scraping.
#
# Input: 11 files in C:/Users/dunca/Downloads/ named
#   view-source_https___www.sec.state.ma.us_LobbyistPublicSearch_Default.aspx N.html
# Year for each file is detected automatically from the form/page.
#
# Output: ../public/data/ma-lobbying-registrants.json

import re
import html
import json
import pathlib
from datetime import datetime, timezone

DL = pathlib.Path("C:/Users/dunca/Downloads")
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "data" / "ma-lobbying-registrants.json"

SUMMARY_BASE = "https://www.sec.state.ma.us/LobbyistPublicSearch/Summary.aspx?sysvalue="

def unwrap_view_source(p):
    raw = p.read_text(encoding="utf-8", errors="replace")
    line_re = re.compile(r'<td class="line-content"[^>]*>(.*?)</td>', re.DOTALL)
    pieces = []
    for m in line_re.finditer(raw):
        seg = m.group(1)
        seg = re.sub(r'<span[^>]*>', '', seg)
        seg = seg.replace('</span>', '')
        seg = seg.replace('<br>', '\n')
        pieces.append(seg)
    return html.unescape("\n".join(pieces))

ROW_RE = re.compile(
    r'<tr\s+class="(?:GridItem|GridAlternatingItem)"[^>]*>(.*?)</tr>',
    re.DOTALL,
)
TYPE_RE = re.compile(r'lblUserType_\d+"[^>]*>([^<]+)</', re.DOTALL)
SYSVAL_RE = re.compile(r'Summary\.aspx\?sysvalue=([A-Za-z0-9+/=]+)')
# Outer <a id="...hplDisplayName_N"> wraps the real display name. Chrome's
# view-source rendering nests a decoration <a class="html-attribute-value">URL</a>
# *inside* the outer anchor's href attribute value, so a naive non-greedy match
# stops at the inner </a>. We skip past the inner anchor + its closing quote +
# the outer target="_blank"> and then capture up to the OUTER </a>.
NAME_BLOCK_RE = re.compile(
    r'hplDisplayName_\d+".*?</a>"\s*target="_blank">(?P<name>.*?)</a>',
    re.DOTALL,
)
# selected year: look in the year dropdown for the option carrying selected="selected"
YEAR_SELECTED_RE = re.compile(
    r'ddlYear[^>]*>.*?<option[^>]*selected[^>]*value="(20[0-2][0-9])"',
    re.DOTALL,
)
YEAR_SELECTED_ALT_RE = re.compile(
    r'<option[^>]*selected[^>]*value="(20[0-2][0-9])"[^>]*>20[0-2][0-9]</option>',
    re.DOTALL,
)

def clean_text(s):
    s = re.sub(r'<[^>]+>', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def detect_year(decoded):
    m = YEAR_SELECTED_RE.search(decoded) or YEAR_SELECTED_ALT_RE.search(decoded)
    if m:
        return m.group(1)
    return None

def parse_rows(decoded):
    rows = ROW_RE.findall(decoded)
    out = []
    seen = set()
    for row_html in rows:
        t = TYPE_RE.search(row_html)
        n = NAME_BLOCK_RE.search(row_html)
        s = SYSVAL_RE.search(row_html)
        if not (t and n and s):
            continue
        if s.group(1) in seen:
            continue
        seen.add(s.group(1))
        out.append({
            "accountType": clean_text(t.group(1)),
            "name": clean_text(n.group("name")),
            "sysvalue": s.group(1),
            "summaryUrl": SUMMARY_BASE + s.group(1),
        })
    return out

def main():
    files = sorted(
        [p for p in DL.iterdir() if p.name.startswith("view-source_https___www.sec.state.ma.us_LobbyistPublicSearch_Default.aspx")],
        key=lambda p: int(re.search(r'\.aspx (\d+)\.html', p.name).group(1)),
    )

    by_year = {}
    diagnostics = []
    for p in files:
        decoded = unwrap_view_source(p)
        year = detect_year(decoded)
        rows = parse_rows(decoded)
        fname = p.name.split("aspx ")[1]
        if not year:
            diagnostics.append({"file": fname, "year": None, "rows": len(rows), "note": "year not detected"})
            print(f"[{fname}] year=??? rows={len(rows)} (year not detected, skipping)")
            continue
        if year in by_year:
            old = by_year[year]
            if len(rows) > len(old["rows"]):
                by_year[year] = {"file": fname, "rows": rows}
                diagnostics.append({"file": fname, "year": year, "rows": len(rows), "note": "replaced earlier same-year"})
            else:
                diagnostics.append({"file": fname, "year": year, "rows": len(rows), "note": "duplicate same-year, kept earlier"})
        else:
            by_year[year] = {"file": fname, "rows": rows}
            diagnostics.append({"file": fname, "year": year, "rows": len(rows), "note": "ok"})
        print(f"[{fname}] year={year} rows={len(rows)}")

    payload = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "source": "MA Secretary of State - Lobbyist Public Search (manual View Source)",
        "sourceUrl": "https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx",
        "note": "MA SOS blocks automated scraping from cloud servers; rosters pulled by hand via Chrome View Source. Each registrant links to its own Summary.aspx detail page on the SOS site.",
        "diagnostics": diagnostics,
        "years": {},
    }

    for year in sorted(by_year):
        rows = by_year[year]["rows"]
        by_type = {}
        for r in rows:
            by_type[r["accountType"]] = by_type.get(r["accountType"], 0) + 1
        payload["years"][year] = {
            "count": len(rows),
            "byAccountType": by_type,
            "sourceFile": by_year[year]["file"],
            "registrants": rows,
        }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print()
    print(f"-> {OUT}")
    print(f"-> {OUT.stat().st_size:,} bytes")
    print(f"-> years parsed: {sorted(payload['years'].keys())}")

if __name__ == "__main__":
    main()
