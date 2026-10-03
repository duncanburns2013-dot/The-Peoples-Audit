# Userscripts

Browser userscripts that scrape MA government sites which block automated
cloud-server access. Because they run **in your browser session**, they look
identical to a normal human visit to the WAF.

## sos-lobbyist-detail-scraper.user.js

Scrapes per-firm detail from the MA Secretary of State Lobbyist Public Search
(clients, fees, registered lobbyists, salaries, addresses) by walking each
`Summary.aspx?sysvalue=...` page reachable from a Default.aspx results page.

### Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser if you
   don't already have it.
2. Tampermonkey → Dashboard → "+" (Create a new script).
3. Replace the template with the contents of
   [`sos-lobbyist-detail-scraper.user.js`](./sos-lobbyist-detail-scraper.user.js).
4. Save (Ctrl+S). Confirm it's **enabled** in the Tampermonkey dashboard.

### Use

1. Go to <https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx>.
2. Pick a Registration Year. Set the page-size dropdown to **View all results**.
   Click **Search**. Wait for the full ~3,200-row grid to render.
3. A dark floating panel appears top-right with:
   - Year detected from the dropdown
   - Account-type filter (default: **Lobbyist Entity** — that's the level
     with firm-aggregate fee/client data)
   - "Scrape N rows" button
4. Click **Scrape N rows**. ~2 seconds per firm × 175 entities ≈ 6 minutes.
   The counter ticks live. You can leave the tab in the background.
5. When done, click **Download JSON**. The file (`sos-lobbyist-detail-TIMESTAMP.json`)
   lands in your Downloads folder.
6. Repeat steps 2–5 for each Registration Year you want detail for. The cache
   is shared across runs, so the year's already-scraped rows are skipped on
   re-visits.

### What it captures (per firm)

```json
{
  "sysvalue": "iSVYsKEM4pc/...",
  "year": "2026",
  "accountType": "Lobbyist Entity",
  "name": "ML Strategies, LLC",
  "url": "https://www.sec.state.ma.us/LobbyistPublicSearch/Summary.aspx?sysvalue=...",
  "scrapedAt": "2026-05-28T13:42:01.234Z",
  "title": "Lobbyist Public Search",
  "spans":  { "<aspnet-id>": "<text>", ... },   // every labeled element
  "links":  [ { "href": "...", "text": "...", "id": "..." }, ... ],
  "tables": [ { "id": "...", "rows": [["col1","col2"], ...] }, ... ]
}
```

The extraction is intentionally over-broad — every `<span>`, every link, every
table — so the offline parser can decide which fields matter without re-running
the scrape if the schema turns out to be different than expected.

### Bill activity (v1.6)

The same panel has a second button, **Scrape bill activity**, for the lines each
registrant files under "Activities, Bill Numbers and Titles" on its disclosure
reports.

1. On a Default.aspx results grid, set the Type filter to **Lobbyist Entity** and
   click **Scrape bill activity**, then switch to **Lobbyist** and click it again
   (1,697 registrants for 2026 across the two).
2. For each registrant it fetches `Summary.aspx` live, follows every
   `CompleteDisclosure.aspx` link whose period falls in the selected year, and
   parses the activity tables. One request every 1.5 s, three retries per page;
   a full 2026 pass takes about 1.5 hours. A registrant that fails is not cached,
   and a re-run skips registrants already cached, so re-running picks up only
   what is missing. **Clear activities** starts over.

   The site sits behind Incapsula bot protection. A blocked request comes back
   as HTTP 200 with a ~1 KB page, not an error. The scraper recognises that page,
   stops the whole run and says so; it does not retry into the block. Wait a few
   hours and click **Scrape bill activity** again. (v1.6 ran three workers at
   200 ms, was blocked after ~1,300 registrants, and cached the blocked ones as
   having no reports. v1.7 also refuses to believe "no reports" unless the
   Summary page carries the site's own "No Disclosure Report has been concluded"
   notice.)
3. Click **Download activities**. That saves `sos-lobbyist-activities-TIMESTAMP.json`.
   Move it to `.cache/sos-firm-scrapes/` and run
   `python scripts/parse-sos-activities.py`. That writes
   `public/data/ma-lobbying-activities-<year>.json`.

Reports come in two formats and both are parsed: `grdvActivitiesNew2020_N` tables
on lobbying-firm reports and `grdvActivitiesNew_N` on in-house lobbyist reports.
Reading only the first format silently drops every in-house lobbyist. The parser
prints registrants that have reports but no rows, grouped by type. A large count
there is the sign of that failure.

Things to know about the fields:

- **client**: the text after "Client:". On firm reports it runs into
  "Total amount paid by client…: $X". That suffix is stripped, and the dollar
  figure goes into `clientTotalPaid`.
- **amount** is the per-activity figure as filed. It is $0 on nearly every row
  because filers say they cannot report compensation at activity level. It is
  not money spent per bill.
- **isTotal** marks the report's own total lines (empty chamber, "Total amount"
  in the position column). They are kept but not counted as activities.
- **bill** is `H`/`S` + optional `D` (docket) + number (`H5151`, `SD1234`) for
  House/Senate Bill/Docket rows, and the agency name for Executive rows.
  `billNumber` keeps the raw cell.

The output file is about 200k rows for a year. To keep it small it uses
header-plus-rows tables (`reports`, `blocks`, `rows`) joined by index, and `rows`
refers to titles by index into `titles`.

The activity cache is separate from the Summary cache. **Clear cache** and
**Clear activities** each empty only their own.

### Privacy

The script runs entirely client-side. Nothing leaves your browser until you
click Download. Records are kept in Tampermonkey's per-origin storage
(`GM_setValue`), not browser cookies or external services.

### If the panel never appears

Open the page console (F12). The script logs a blue `[ta-sos] vX loaded` badge
before it does anything else, so:

- **Badge present, no panel** — the panel div is there but empty, or it is behind
  the Tampermonkey popup, which sits in exactly the same corner. Close the popup.
- **No badge at all** — the script is not executing. Tampermonkey will still list
  it as enabled and matching the page, because that is computed from the metadata
  block; it tells you nothing about whether the body ran.

The failure that cost a full afternoon on 2026-09-27 was the second kind, and the
console said so the whole time:

```
Unchecked runtime.lastError: Message exceeded maximum allowed size of 64MiB.
```

Tampermonkey preloads a script's **entire value store** into the page on every
injection — that is what makes `GM_getValue` synchronous. Up to v1.2 this script
kept every scraped record in one GM value, so once that blob passed Chrome's
64 MiB messaging cap, injection itself failed and not one line of the script ran.
Editing the script could not fix it: the fault was in the stored data.

What tipped it over was setting the Account Type filter to **All** (3,293 rows for
2026) on top of eleven years of Lobbyist Entity records — roughly 29 MB already
held, plus ~49 MB more.

**To recover:** Dashboard → Settings → set **Config mode: Advanced** (the Storage
tab is hidden otherwise) → open the script → **Storage** → replace the contents
with `{"selected_type": "Lobbyist Entity"}` → Save. Deleting the script also works,
since storage dies with it.

v1.5 stores one GM value per record plus a small key index, so no message is ever
larger than a single firm (~15 KB) no matter how much is cached. Verified against
a stub enforcing the real 64 MiB cap: 5,000 records / 73 MB held, largest message
0.1 MB, zero messages over the cap.

Still, download between passes rather than letting runs stack up — the cache is
working state, not an archive. The committed `public/data/ma-lobbying-*.json`
files are the archive.

### Tuning

- **Delay** (default 2000ms): edit `DELAY_MS` at the top of the script. Don't
  drop below 1500ms or the SOS site may rate-limit you.
- **Clear cache**: red button in the panel. Useful if you want to re-scrape
  a year after the SOS site updates a filing.
