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

### Privacy

The script runs entirely client-side. Nothing leaves your browser until you
click Download. Records are kept in Tampermonkey's per-origin storage
(`GM_setValue`), not browser cookies or external services.

### Tuning

- **Delay** (default 2000ms): edit `DELAY_MS` at the top of the script. Don't
  drop below 1500ms or the SOS site may rate-limit you.
- **Clear cache**: red button in the panel. Useful if you want to re-scrape
  a year after the SOS site updates a filing.
