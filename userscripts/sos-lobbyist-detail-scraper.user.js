// ==UserScript==
// @name         MA SOS Lobbyist Detail Scraper
// @namespace    https://github.com/duncanburns2013-dot/The-Peoples-Audit
// @version      1.7
// @description  Scrape per-firm detail (clients, fees, lobbyists, salaries) and disclosure-report bill activity from the MA Secretary of State Lobbyist Public Search and download as JSON. Runs in your real browser session so it bypasses the WAF that blocks server-side scrapes.
// @author       The People's Audit
// @match        https://www.sec.state.ma.us/LobbyistPublicSearch/*
// @match        https://sec.state.ma.us/LobbyistPublicSearch/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @run-at       document-idle
// ==/UserScript==

/*
USAGE
-----
1. Install Tampermonkey, paste this script in as a new userscript, save & enable.
2. Go to https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx
3. Pick a Registration Year and "View all results", click Search.
4. A floating control panel appears top-right. Pick an Account Type filter
   (default: Lobbyist Entity — that's the one with firm-level fee detail),
   then click "Scrape N rows".
5. Watch the progress counter tick. ~2 sec per firm, so 175 firms ≈ 6 min.
6. When done, click "Download JSON". Send the file to me and I'll merge it
   into the dashboard's data layer.
7. Repeat for each Registration Year you want detail for.

WHAT IT CAPTURES
----------------
For each Summary.aspx page it visits, it stores:
  - sysvalue (the SOS internal key)
  - URL
  - Page title and any visible heading
  - Every <table> in the main content as a 2D array
  - Every labeled element with an id (spans/labels/inputs) as {id: text}
  - Every internal link as {href, text}
  - scrapedAt timestamp

That's intentionally over-broad — I'd rather grab everything and parse offline
than guess wrong about which fields matter. The download is ~5-15 KB per firm.

RESUME / SKIP
-------------
Already-scraped sysvalues are skipped automatically. To re-scrape, click
"Clear cache" (it dumps everything stored for the current origin).

BILL ACTIVITY (v1.6)
--------------------
"Scrape bill activity" walks the same filtered grid rows, fetches each
registrant's Summary.aspx live, follows every CompleteDisclosure.aspx link for
the selected year, and parses the "Activities, Bill Numbers and Titles" tables.
Two table formats exist and both are read:
  grdvActivitiesNew2020_N   lobbying-firm (Lobbyist Entity) reports
  grdvActivitiesNew_N       in-house lobbyist reports
A pass that read only the 2020 format missed all 1,273 in-house registrants.
Each table sits under a "Client: NAME" label; on firm reports that label runs
into "Total amount paid by client...: $X", which is split off into
clientTotalPaid. Rows with an empty chamber and "Total amount" in the position
cell are report totals and are flagged isTotal, not counted as activities.
Per-row Amount is $0 on nearly every row (firms say they cannot report
compensation at activity level); it is not dollars per bill.
Run it with Type = Lobbyist Entity, then Type = Lobbyist (1,697 registrants for
2026). Then "Download activities" and run
  python scripts/parse-sos-activities.py <download>
which writes public/data/ma-lobbying-activities-<year>.json.

v1.7: one request every 1.5 s. The site sits behind Incapsula bot protection,
which answers a blocked request with HTTP 200 and a tiny page. The scrape now
recognises that page and stops (it no longer records the registrant as having
no reports), a Summary page with no disclosure section and no "No Disclosure
Report has been concluded" notice counts as a failure, and a re-run skips
registrants already cached. A full 2026 pass takes roughly 1.5 hours.

PRIVACY
-------
Runs entirely in your browser. No data leaves the page until YOU click Download.
*/

(function () {
  'use strict';

  const VERSION = '1.7';
  const STORAGE_KEY = 'sos_lobbyist_detail_cache_v1';
  const DELAY_MS = 2000; // polite delay between fetches

  // Loud console marker so we can confirm the script actually ran.
  console.log(
    '%c[ta-sos] v' + VERSION + ' loaded',
    'background:#2563eb;color:#fff;padding:2px 6px;border-radius:3px',
    location.href,
  );

  /* ------------------------------------------------------------------ */
  /* state                                                              */
  /* ------------------------------------------------------------------ */

  // WHY THIS IS NOT ONE BLOB ANY MORE
  // v1.2 and earlier kept every scraped record in a single GM value. Every
  // GM_getValue/GM_setValue ships that whole value between the page and the
  // extension over Chrome's runtime messaging, which is hard-capped at 64 MiB.
  // render() calls getCache() first thing and fires every 2 seconds, so once the
  // blob crossed the cap the page filled with
  //     Unchecked runtime.lastError: Message exceeded maximum allowed size of 64MiB
  // and the panel silently stopped drawing. Editing the script could not fix it,
  // because the fault was in the stored data, not the code.
  //
  // 1,989 Lobbyist Entity records is ~29 MB and survived. One year of Clients
  // (1,649) or All (3,293) on top of that does not.
  //
  // Now: each record is its own GM value, so no message is ever bigger than one
  // firm (~15 KB), and a lightweight index holds just the keys. The index is what
  // render() reads, so the hot path moves ~50 bytes per entry instead of 29 MB.
  const INDEX_KEY = 'sos_lobbyist_index_v2';
  const REC_PREFIX = 'sos_rec_v2::';

  function getIndex() {
    try {
      const a = JSON.parse(GM_getValue(INDEX_KEY, '[]'));
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }
  function setIndex(keys) {
    GM_setValue(INDEX_KEY, JSON.stringify(keys));
  }

  // render() only ever needs to know WHICH keys are cached, never their contents.
  function getCache() {
    const out = {};
    for (const k of getIndex()) out[k] = true;
    return out;
  }

  function putRecord(key, detail) {
    GM_setValue(REC_PREFIX + key, JSON.stringify(detail));
    const keys = getIndex();
    if (!keys.includes(key)) {
      keys.push(key);
      setIndex(keys);
    }
  }

  function getRecord(key) {
    try {
      return JSON.parse(GM_getValue(REC_PREFIX + key, 'null'));
    } catch (e) {
      return null;
    }
  }

  function clearCache() {
    for (const k of getIndex()) GM_deleteValue(REC_PREFIX + k);
    GM_deleteValue(INDEX_KEY);
    GM_deleteValue(STORAGE_KEY);   // the pre-v1.5 blob, if one is still stranded
  }

  /* ------------------------------------------------------------------ */
  /* page-type detection                                                */
  /* ------------------------------------------------------------------ */

  // Re-evaluated each render in case the page navigated since script start.
  function detectPageType() {
    const p = location.pathname;
    const isSummary = /Summary\.aspx/i.test(p);
    // Treat any LobbyistPublicSearch URL that ISN'T a Summary page as a
    // potential search page — covers Default.aspx, root /, or any other
    // SOS-served search variant.
    const isSearchish = /\/LobbyistPublicSearch\//i.test(p) && !isSummary;
    return { isDefault: isSearchish, isSummary };
  }

  /* ------------------------------------------------------------------ */
  /* row extraction (on Default.aspx)                                   */
  /* ------------------------------------------------------------------ */

  function extractRowsOnDefaultPage() {
    // Each row in the results grid carries:
    //   - <span id="..._lblUserType_N">Client/Lobbyist/Lobbyist Entity</span>
    //   - <a id="..._hplDisplayName_N" href=".../Summary.aspx?sysvalue=...">NAME</a>
    const rows = [];
    const links = document.querySelectorAll('a[id*="hplDisplayName_"]');
    links.forEach((a) => {
      const m = a.id.match(/hplDisplayName_(\d+)/);
      if (!m) return;
      const idx = m[1];
      const typeSpan = document.getElementById(
        a.id.replace('hplDisplayName_' + idx, 'lblUserType_' + idx),
      );
      const href = a.getAttribute('href') || '';
      const sysMatch = href.match(/sysvalue=([^&]+)/);
      rows.push({
        accountType: (typeSpan?.textContent || '').trim(),
        name: (a.textContent || '').trim(),
        href: href.startsWith('http')
          ? href
          : new URL(href, location.href).toString(),
        sysvalue: sysMatch ? decodeURIComponent(sysMatch[1]) : null,
      });
    });
    // Fallback: everything above is addressed by ASP.NET auto-generated control
    // ids (hplDisplayName_N, lblUserType_N), which the SOS can rename at will.
    // That would not throw -- the panel would just report 0 rows and look broken.
    // The Summary.aspx link cannot change without breaking the site's own
    // navigation, so use it when the ids find nothing.
    if (rows.length === 0) {
      const seen = new Set();
      document.querySelectorAll('a[href*="Summary.aspx"]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        const sysMatch = href.match(/sysvalue=([^&]+)/);
        if (!sysMatch) return;
        const sysvalue = decodeURIComponent(sysMatch[1]);
        if (seen.has(sysvalue)) return;
        seen.add(sysvalue);
        const tr = a.closest('tr');
        const cells = tr ? tr.querySelectorAll('td') : [];
        rows.push({
          accountType: cells.length ? (cells[0].textContent || '').trim() : '',
          name: (a.textContent || '').trim(),
          href: href.startsWith('http') ? href : new URL(href, location.href).toString(),
          sysvalue,
        });
      });
      if (rows.length) {
        console.warn('[ta-sos] control ids did not match - used the Summary.aspx',
                     'fallback,', rows.length, 'rows.');
      }
    }

    return rows;
  }

  function detectYearOnDefaultPage() {
    const sel = document.querySelector('select[id$="ddlYear"]');
    return sel ? sel.value : null;
  }

  /* ------------------------------------------------------------------ */
  /* detail page parser (used for Summary.aspx HTML)                    */
  /* ------------------------------------------------------------------ */

  function parseSummaryHtml(htmlString, contextUrl) {
    const doc = new DOMParser().parseFromString(htmlString, 'text/html');

    const title = (doc.querySelector('title')?.textContent || '').trim();

    // grab the main content placeholder (everything inside it)
    const main =
      doc.getElementById('ContentPlaceHolder1') ||
      doc.querySelector('#aspnetForm') ||
      doc.body;

    // every span/label/input with an id → {id: text}
    const spans = {};
    main.querySelectorAll('span[id], label[id]').forEach((el) => {
      const txt = el.textContent.replace(/\s+/g, ' ').trim();
      if (txt) spans[el.id] = txt;
    });
    main.querySelectorAll('input[id][type="text"], input[id][type="hidden"]').forEach((el) => {
      if (el.value) spans[el.id] = el.value;
    });

    // every internal link → {href, text}
    const linksOut = [];
    main.querySelectorAll('a[href]').forEach((a) => {
      const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
      let href = a.getAttribute('href') || '';
      if (href.startsWith('javascript:') || href.startsWith('#')) return;
      if (!href.startsWith('http')) {
        try {
          href = new URL(href, contextUrl).toString();
        } catch (_) {}
      }
      linksOut.push({ href, text, id: a.id || null });
    });

    // v1.0/v1.1 also captured the full <table> matrix, but in practice the
    // SOS page nests every cell inside several wrapper tables so the capture
    // duplicated the same row up to 6 times. That blew the per-firm record
    // to ~190 KB and crashed Chrome around the 200-firm cumulative mark.
    // The parser only ever used spans + links anyway, and falls back to a
    // single concatenated text blob for regex scans of free-text fields
    // (e.g. "Initial registration 12-03-2025"). Capture exactly that.
    const text = (main.textContent || '')
      .replace(/[ \t ]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
      .trim();

    return { title, spans, links: linksOut, text };
  }

  /* ------------------------------------------------------------------ */
  /* fetcher                                                            */
  /* ------------------------------------------------------------------ */

  async function fetchAndParse(row, year) {
    const res = await fetch(row.href, {
      credentials: 'include',
      headers: { Accept: 'text/html' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    const parsed = parseSummaryHtml(html, row.href);
    return {
      sysvalue: row.sysvalue,
      year,
      accountType: row.accountType,
      name: row.name,
      url: row.href,
      scrapedAt: new Date().toISOString(),
      ...parsed,
    };
  }

  /* ------------------------------------------------------------------ */
  /* bill activity: CompleteDisclosure.aspx reports                     */
  /* ------------------------------------------------------------------ */

  // Own cache, same one-value-per-record layout as the Summary cache above, so
  // "Clear cache" on one never touches the other. One record per registrant.
  const ACT_INDEX_KEY = 'sos_activity_index_v1';
  const ACT_REC_PREFIX = 'sos_act_rec_v1::';
  // One worker at the README pace. Three workers at 200ms tripped the site's
  // Incapsula bot protection after ~1,300 registrants (28 Sep 2026).
  const ACT_WORKERS = 1;
  const ACT_DELAY_MS = 1500;
  // Rows are stored as arrays (~200k of them for 2026), in this column order.
  const ACT_ROW_COLUMNS = [
    'chamber', 'billNumber', 'bill', 'title', 'position', 'amount',
    'directBusinessAssociation', 'isTotal',
  ];
  // grdvActivitiesNew2020_N = lobbying-firm reports, grdvActivitiesNew_N =
  // in-house lobbyist reports. Anchored so sibling grids never match.
  const ACT_TABLE_ID = /grdvActivitiesNew(2020)?_\d+$/;

  function getActIndex() {
    try {
      const a = JSON.parse(GM_getValue(ACT_INDEX_KEY, '[]'));
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }
  function putActRecord(key, rec) {
    GM_setValue(ACT_REC_PREFIX + key, JSON.stringify(rec));
    const keys = getActIndex();
    if (!keys.includes(key)) {
      keys.push(key);
      GM_setValue(ACT_INDEX_KEY, JSON.stringify(keys));
    }
  }
  function getActRecord(key) {
    try {
      return JSON.parse(GM_getValue(ACT_REC_PREFIX + key, 'null'));
    } catch (e) {
      return null;
    }
  }
  function clearActCache() {
    for (const k of getActIndex()) GM_deleteValue(ACT_REC_PREFIX + k);
    GM_deleteValue(ACT_INDEX_KEY);
  }

  // Summary links can be absolute www.sec.state.ma.us URLs while the page runs
  // on sec.state.ma.us (both are @match'd). Pin them to the page's origin so
  // every fetch stays same-origin and carries the session cookies.
  function sameOrigin(href) {
    const u = new URL(href, location.href);
    if (/(^|\.)sec\.state\.ma\.us$/i.test(u.hostname)) {
      u.protocol = location.protocol;
      u.host = location.host;
    }
    return u.toString();
  }

  // Incapsula answers a blocked request with HTTP 200 and a ~1 KB page. A status
  // check alone reads that as a normal page with no reports, which is how 407
  // registrants were once cached as "no reports" while the site was blocking.
  class BlockedError extends Error {}
  function isBlockPage(html) {
    return /_Incapsula_Resource|Incapsula incident ID/i.test(html);
  }

  async function fetchText(url) {
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          credentials: 'include',
          headers: { Accept: 'text/html' },
        });
        if (res.ok) {
          const html = await res.text();
          // Never retry into a block: it only extends it.
          if (isBlockPage(html)) throw new BlockedError('blocked by the site\'s bot protection');
          return html;
        }
        lastErr = new Error('HTTP ' + res.status);
      } catch (e) {
        if (e instanceof BlockedError) throw e;
        lastErr = e;
      }
      await sleep(1500 * (attempt + 1));
    }
    throw lastErr;
  }

  function cleanText(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  // '$1,234.56' -> 1234.56, '' -> null. Same rule as money() in the parsers.
  function money(text) {
    const m = /(-?)\$?\s*([\d,]+(?:\.\d+)?)/.exec(text || '');
    if (!m) return null;
    const v = parseFloat(m[2].replace(/,/g, ''));
    if (!Number.isFinite(v)) return null;
    return m[1] ? -v : v;
  }

  // "1/1/2026-6/30/2026" out of "View disclosure reporting details filed for
  // the period 1/1/2026-6/30/2026Charles carr" (the name is glued on).
  function reportPeriod(text) {
    const m = /period\s+(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/i
      .exec(text || '');
    return m ? `${m[1]}-${m[2]}` : null;
  }

  function disclosureLinks(links, year) {
    const out = [];
    const seen = new Set();
    for (const l of links) {
      if (!/CompleteDisclosure\.aspx/i.test(l.href || '')) continue;
      if (seen.has(l.href)) continue;
      seen.add(l.href);
      const period = reportPeriod(l.text);
      if (year && period && !period.includes(String(year))) continue;
      out.push({ url: l.href, period });
    }
    return out;
  }

  // Walk back through previous siblings and up through ancestors until an
  // element's text starts with the label. The length cap stops at the label
  // itself rather than a container that happens to begin with it.
  function labelAbove(el, prefix, maxLen) {
    let e = el;
    for (let i = 0; i < 14 && e; i++) {
      e = e.previousElementSibling || e.parentElement;
      if (!e) break;
      const tx = cleanText(e);
      if (tx.startsWith(prefix) && tx.length < maxLen) {
        return tx.slice(prefix.length).trim();
      }
    }
    return '';
  }

  // Firm reports: "Client: NAME Total amount paid by client; lobbyist is unable
  // to report compensation at activity level: $2,240.72". Read the dollar
  // figure before stripping the suffix, or it is lost.
  function splitClientLabel(raw) {
    const name = raw.replace(/\s*Total amount.*$/i, '').trim();
    const m = /Total amount.*?(-?\$\s*[\d,]+(?:\.\d+)?)/i.exec(raw);
    return { name, totalPaid: m ? money(m[1]) : null };
  }

  // House/Senate Bill/Docket -> H5151, S2986, HD4321, SD1234. Executive rows
  // name an agency, not a bill, so the key is the agency text. Anything else,
  // or a cell holding more than one number, keeps its raw text.
  function billKey(chamber, billNumber) {
    const raw = (billNumber || '').trim();
    const m = /^(House|Senate)\s+(Bill|Docket)$/i.exec(chamber || '');
    if (m) {
      const nums = raw.match(/\d+/g) || [];
      if (nums.length === 1) {
        return m[1][0].toUpperCase() + (/docket/i.test(m[2]) ? 'D' : '') +
          String(parseInt(nums[0], 10));
      }
    }
    return raw || null;
  }

  function parseDisclosureHtml(htmlString, registrantName) {
    const doc = new DOMParser().parseFromString(htmlString, 'text/html');
    const blocks = [];
    doc.querySelectorAll('table[id*="grdvActivitiesNew"]').forEach((t) => {
      if (!ACT_TABLE_ID.test(t.id)) return;
      const client = splitClientLabel(labelAbove(t, 'Client:', 400));
      const rows = [];
      for (const r of t.rows) {
        const cells = [...r.cells];
        if (cells.length && cells.every((c) => c.tagName === 'TH')) continue;
        const c = cells.map(cleanText);
        if (c.length < 5) continue; // "No activities..." placeholder row
        if (/^House\s*\/\s*Senate$/i.test(c[0])) continue; // header row
        const [chamber, billNumber, title, position, amountText, dba = ''] = c;
        const isTotal = !chamber && /^Total amount/i.test(position);
        rows.push([
          chamber,
          billNumber,
          isTotal ? null : billKey(chamber, billNumber),
          title,
          position,
          money(amountText),
          dba,
          isTotal ? 1 : 0,
        ]);
      }
      blocks.push({
        table: t.id.replace(/^.*_(grdvActivitiesNew(?:2020)?_\d+)$/, '$1'),
        format: /grdvActivitiesNew2020_/.test(t.id) ? 'firm' : 'in-house',
        client: client.name,
        clientTotalPaid: client.totalPaid,
        lobbyist: labelAbove(t, 'Lobbyist:', 300) || registrantName,
        rows,
      });
    });
    return blocks;
  }

  // Summary.aspx is always fetched live: a cached Summary record from before
  // the filing deadline has no disclosure links and would read as "no reports".
  async function fetchActivity(row, year) {
    const summaryUrl = sameOrigin(row.href);
    const summaryHtml = await fetchText(summaryUrl);
    const summary = parseSummaryHtml(summaryHtml, summaryUrl);
    const links = disclosureLinks(summary.links, year);
    // "No reports" is only believed when the page says so. A Summary page with
    // neither report links nor the site's own notice is incomplete: throw, so
    // the registrant is not cached and the next run fetches it again.
    if (!links.length && !/No Disclosure Report has been concluded/i.test(summaryHtml)) {
      throw new Error('Summary page had no disclosure section');
    }
    const reports = [];
    for (const d of links) {
      await sleep(ACT_DELAY_MS);
      const html = await fetchText(sameOrigin(d.url));
      reports.push({
        url: d.url,
        period: d.period,
        blocks: parseDisclosureHtml(html, row.name),
      });
    }
    return {
      sysvalue: row.sysvalue,
      year,
      accountType: row.accountType,
      name: row.name,
      url: row.href,
      scrapedAt: new Date().toISOString(),
      reports,
    };
  }

  /* ------------------------------------------------------------------ */
  /* UI panel                                                           */
  /* ------------------------------------------------------------------ */

  function buildPanel() {
    if (document.getElementById('ta-sos-scraper')) return;

    const css = `
      #ta-sos-scraper {
        position: fixed; top: 12px; right: 12px; z-index: 2147483647;
        width: 320px; background: #1a1d24; color: #e8eaed;
        border: 1px solid #3a3f4a; border-radius: 10px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        padding: 14px 16px;
      }
      #ta-sos-scraper h3 {
        margin: 0 0 8px; font-size: 14px; font-weight: 600;
        display: flex; align-items: center; justify-content: space-between;
        color: #4ea1ff;
      }
      #ta-sos-scraper .meta {
        font-size: 11px; color: #8a93a4; margin-bottom: 10px;
      }
      #ta-sos-scraper button {
        cursor: pointer; padding: 7px 12px; border-radius: 6px; border: none;
        font: inherit; font-weight: 500; margin: 3px 3px 3px 0;
      }
      #ta-sos-scraper .btn-primary {
        background: #2563eb; color: #fff;
      }
      #ta-sos-scraper .btn-primary:hover { background: #1d4ed8; }
      #ta-sos-scraper .btn-secondary {
        background: #2c303a; color: #d0d4dc; border: 1px solid #3a3f4a;
      }
      #ta-sos-scraper .btn-secondary:hover { background: #3a3f4a; }
      #ta-sos-scraper .btn-danger {
        background: #1f1a1a; color: #f87171; border: 1px solid #4a2828;
      }
      #ta-sos-scraper .btn-danger:hover { background: #2a1f1f; }
      #ta-sos-scraper select {
        background: #2c303a; color: #e8eaed; border: 1px solid #3a3f4a;
        padding: 5px 8px; border-radius: 5px; font: inherit; margin: 4px 0;
      }
      #ta-sos-scraper .progress {
        margin: 8px 0; padding: 8px; background: #14171f;
        border-radius: 6px; font-size: 12px; font-family: ui-monospace, monospace;
      }
      #ta-sos-scraper .row { display: flex; gap: 6px; align-items: center; }
      #ta-sos-scraper code {
        background: #14171f; padding: 1px 5px; border-radius: 3px;
        font-size: 11px; color: #4ea1ff;
      }
      #ta-sos-scraper .close-x {
        background: none; border: none; color: #8a93a4; font-size: 16px;
        cursor: pointer; padding: 0 4px;
      }
      #ta-sos-scraper .debug {
        font-size: 10px; color: #fbbf24; background: #14171f;
        padding: 4px 6px; border-radius: 4px; margin-bottom: 6px;
        font-family: ui-monospace, monospace; word-break: break-all;
      }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'ta-sos-scraper';
    document.body.appendChild(panel);
    render();
  }

  // Avoid render loops when the panel's own innerHTML mutation re-triggers
  // the MutationObserver. We hash the inputs and only re-render on change.
  let lastRenderKey = null;

  function render() {
    const panel = document.getElementById('ta-sos-scraper');
    if (!panel) return;
    const { isDefault, isSummary } = detectPageType();
    const cache = getCache();
    const cachedCount = Object.keys(cache).length;
    const allRows = isDefault ? extractRowsOnDefaultPage() : [];
    const year = isDefault ? detectYearOnDefaultPage() : null;
    const types = [...new Set(allRows.map((r) => r.accountType).filter(Boolean))];
    const selectedType = GM_getValue('selected_type', 'Lobbyist Entity');
    const filtered = allRows.filter(
      (r) => !selectedType || selectedType === 'All' || r.accountType === selectedType,
    );
    const remaining = filtered.filter(
      (r) => r.sysvalue && !cache[`${year}::${r.sysvalue}`],
    );
    const actKeys = new Set(getActIndex());
    const actRemaining = filtered.filter(
      (r) => r.sysvalue && !actKeys.has(`${year}::${r.sysvalue}`),
    );

    // Re-render guard: only update DOM if relevant state changed.
    const key = JSON.stringify([
      isDefault,
      isSummary,
      cachedCount,
      allRows.length,
      filtered.length,
      remaining.length,
      year,
      selectedType,
      actKeys.size,
      actRemaining.length,
    ]);
    if (key === lastRenderKey) return;
    lastRenderKey = key;

    // Always-visible debug strip so you can tell the script is alive even if
    // the page-type heuristic guesses wrong.
    const debugStrip = `
      <div class="debug">
        path: <code>${location.pathname}</code> ·
        type: <code>${isDefault ? 'search' : isSummary ? 'summary' : 'other'}</code>
      </div>
    `;

    if (isDefault) {
      panel.innerHTML = `
        <h3>
          <span>SOS Detail Scraper <span style="font-size:10px;color:#8a93a4;font-weight:400">v${VERSION}</span></span>
          <button class="close-x" id="ta-close">×</button>
        </h3>
        ${debugStrip}
        <div class="meta">
          Year on page: <code>${year || 'unknown'}</code> ·
          <code>${allRows.length}</code> rows visible in grid
        </div>
        ${allRows.length === 0 ? `
          <div class="progress" style="color:#fbbf24">
            No result rows detected yet. Run a search with "View all results"
            and wait for the grid to render, then this panel updates automatically.
          </div>
        ` : `
          <div class="row" style="margin-bottom:6px">
            <label style="font-size:12px;color:#8a93a4">Type:</label>
            <select id="ta-type">
              <option value="All">All (${allRows.length})</option>
              ${types
                .map(
                  (t) =>
                    `<option value="${t}" ${
                      t === selectedType ? 'selected' : ''
                    }>${t} (${allRows.filter((r) => r.accountType === t).length})</option>`,
                )
                .join('')}
            </select>
          </div>
          <div class="progress" id="ta-progress">
            Cached (this origin): ${cachedCount}<br>
            Filtered this page: ${filtered.length}<br>
            Already done: ${filtered.length - remaining.length}<br>
            To scrape: <b style="color:#4ea1ff">${remaining.length}</b>
          </div>
          <div class="row" style="flex-wrap:wrap">
            <button class="btn-primary" id="ta-scrape" ${remaining.length === 0 ? 'disabled' : ''}>
              Scrape ${remaining.length} row${remaining.length === 1 ? '' : 's'}
            </button>
          </div>
          <div class="progress" id="ta-act-progress">${actStatus || `
            Bill activity cached: ${actKeys.size}<br>
            To scrape (this filter): <b style="color:#4ea1ff">${actRemaining.length}</b>
          `}</div>
          <div class="row" style="flex-wrap:wrap">
            <button class="btn-primary" id="ta-act-scrape" ${actRemaining.length === 0 ? 'disabled' : ''}>
              Scrape bill activity (${actRemaining.length})
            </button>
          </div>
        `}
        <div class="row" style="flex-wrap:wrap;margin-top:6px">
          <button class="btn-secondary" id="ta-download" ${cachedCount === 0 ? 'disabled' : ''}>
            Download JSON (${cachedCount})
          </button>
          <button class="btn-danger" id="ta-clear">Clear cache</button>
        </div>
        <div class="row" style="flex-wrap:wrap">
          <button class="btn-secondary" id="ta-act-download" ${actKeys.size === 0 ? 'disabled' : ''}>
            Download activities (${actKeys.size})
          </button>
          <button class="btn-danger" id="ta-act-clear" ${actKeys.size === 0 ? 'disabled' : ''}>Clear activities</button>
        </div>
        <div class="meta" style="margin-top:8px;font-size:10px">
          Open DevTools console for [ta-sos] logs.
        </div>
      `;

      document.getElementById('ta-close').onclick = () => panel.remove();
      const typeEl = document.getElementById('ta-type');
      if (typeEl) typeEl.onchange = (e) => {
        GM_setValue('selected_type', e.target.value);
        lastRenderKey = null;
        render();
      };
      const scrapeEl = document.getElementById('ta-scrape');
      if (scrapeEl) scrapeEl.onclick = () =>
        runScrape(remaining, year, () => { lastRenderKey = null; render(); });
      const actScrapeEl = document.getElementById('ta-act-scrape');
      if (actScrapeEl) actScrapeEl.onclick = () =>
        runActivityScrape(actRemaining, year, () => { lastRenderKey = null; render(); });
      document.getElementById('ta-download').onclick = downloadAll;
      document.getElementById('ta-act-download').onclick = downloadActivities;
      document.getElementById('ta-clear').onclick = () => {
        if (confirm(`Delete ${cachedCount} cached firm records?`)) {
          clearCache();
          lastRenderKey = null;
          render();
        }
      };
      document.getElementById('ta-act-clear').onclick = () => {
        if (confirm(`Delete ${actKeys.size} cached bill-activity records?`)) {
          clearActCache();
          lastRenderKey = null;
          render();
        }
      };
    } else if (isSummary) {
      panel.innerHTML = `
        <h3>
          <span>SOS Detail Scraper <span style="font-size:10px;color:#8a93a4;font-weight:400">v${VERSION}</span></span>
          <button class="close-x" id="ta-close">×</button>
        </h3>
        ${debugStrip}
        <div class="meta">On a Summary.aspx page.</div>
        <div class="progress">Cached records: ${cachedCount}</div>
        <button class="btn-secondary" id="ta-back">↶ Go to Default.aspx</button>
        <button class="btn-secondary" id="ta-download" ${
          cachedCount === 0 ? 'disabled' : ''
        }>Download JSON</button>
        <button class="btn-secondary" id="ta-act-download" ${
          actKeys.size === 0 ? 'disabled' : ''
        }>Download activities (${actKeys.size})</button>
      `;
      document.getElementById('ta-close').onclick = () => panel.remove();
      document.getElementById('ta-back').onclick = () =>
        (location.href =
          'https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx');
      document.getElementById('ta-download').onclick = downloadAll;
      document.getElementById('ta-act-download').onclick = downloadActivities;
    } else {
      // Unknown LobbyistPublicSearch sub-path. Still show the panel with debug
      // info instead of disappearing silently.
      panel.innerHTML = `
        <h3>
          <span>SOS Detail Scraper <span style="font-size:10px;color:#8a93a4;font-weight:400">v${VERSION}</span></span>
          <button class="close-x" id="ta-close">×</button>
        </h3>
        ${debugStrip}
        <div class="progress" style="color:#fbbf24">
          This URL doesn't look like a Default or Summary page. Navigate to
          <code>/LobbyistPublicSearch/Default.aspx</code> to use the scraper.
        </div>
        <button class="btn-secondary" id="ta-go">↪ Go to Default.aspx</button>
        <button class="btn-secondary" id="ta-download" ${
          cachedCount === 0 ? 'disabled' : ''
        }>Download JSON (${cachedCount})</button>
        <button class="btn-secondary" id="ta-act-download" ${
          actKeys.size === 0 ? 'disabled' : ''
        }>Download activities (${actKeys.size})</button>
      `;
      document.getElementById('ta-close').onclick = () => panel.remove();
      document.getElementById('ta-go').onclick = () =>
        (location.href =
          'https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx');
      document.getElementById('ta-download').onclick = downloadAll;
      document.getElementById('ta-act-download').onclick = downloadActivities;
    }
  }

  /* ------------------------------------------------------------------ */
  /* run loop                                                           */
  /* ------------------------------------------------------------------ */

  let scraping = false;
  async function runScrape(rows, year, onProgress) {
    if (scraping || actRunning) return;
    scraping = true;
    try {
    const cache = getCache();
    let ok = 0,
      fail = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const key = `${year}::${r.sysvalue}`;
      const progressEl = document.getElementById('ta-progress');
      if (progressEl) {
        progressEl.innerHTML = `
          <b>Scraping ${i + 1} / ${rows.length}</b><br>
          ${r.name.slice(0, 50)}<br>
          ok=${ok} fail=${fail}
        `;
      }
      try {
        const detail = await fetchAndParse(r, year);
        putRecord(key, detail);
        cache[key] = true;
        ok++;
      } catch (e) {
        console.warn('[ta-sos] fail', r.name, e);
        fail++;
      }
      await sleep(DELAY_MS);
    }
    alert(`Done. ${ok} ok, ${fail} failed. Click Download JSON to save.`);
    onProgress && onProgress();
    } finally {
      // Released even if the loop throws. As a plain assignment at the end it
      // stayed true forever on any error, and every later click of "Scrape"
      // was then a silent no-op.
      scraping = false;
    }
  }

  // Bill activity: a small worker pool, each worker pausing ACT_DELAY_MS
  // between fetches. A registrant whose fetch fails is not stored, so the next
  // run picks it up again, and registrants already cached are skipped, so a
  // run can be resumed. "Clear activities" starts over.
  let actRunning = false;
  let actStatus = '';
  async function runActivityScrape(allRows, year, onDone) {
    if (actRunning || scraping) return;
    actRunning = true;
    const cached = new Set(getActIndex());
    const rows = allRows.filter((r) => !cached.has(`${year}::${r.sysvalue}`));
    const skipped = allRows.length - rows.length;
    let next = 0,
      ok = 0,
      fail = 0,
      reports = 0,
      activityRows = 0,
      blocked = null;
    const show = (name) => {
      actStatus = `
        <b>Bill activity ${Math.min(next, rows.length)} / ${rows.length}</b><br>
        ${String(name || '').slice(0, 50)}<br>
        ok=${ok} fail=${fail} reports=${reports} rows=${activityRows}
      `;
      const el = document.getElementById('ta-act-progress');
      if (el) el.innerHTML = actStatus;
    };
    async function worker() {
      while (next < rows.length && !blocked) {
        const r = rows[next++];
        show(r.name);
        try {
          const rec = await fetchActivity(r, year);
          putActRecord(`${year}::${r.sysvalue}`, rec);
          ok++;
          reports += rec.reports.length;
          for (const rep of rec.reports) {
            for (const b of rep.blocks) activityRows += b.rows.length;
          }
        } catch (e) {
          console.warn('[ta-sos] activity fail', r.name, e);
          fail++;
          // Stop every worker on a block rather than keep requesting.
          if (e instanceof BlockedError) blocked = r.name;
        }
        show(r.name);
        await sleep(ACT_DELAY_MS);
      }
    }
    try {
      const n = Math.min(ACT_WORKERS, rows.length);
      await Promise.all(Array.from({ length: n }, () => worker()));
      const summary =
        `${ok} ok, ${fail} failed, ${reports} reports, ${activityRows} rows` +
        (skipped ? `, ${skipped} already cached and skipped` : '') + '.';
      alert(
        blocked
          ? `Stopped: the site's bot protection blocked the request for ${blocked}. ` +
            `${summary} Wait a few hours, then click "Scrape bill activity" again; ` +
            'cached registrants are skipped.'
          : `Bill activity done. ${summary} Click "Download activities" to save.`,
      );
    } finally {
      actRunning = false;
      actStatus = '';
      onDone && onDone();
    }
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /* ------------------------------------------------------------------ */
  /* download                                                           */
  /* ------------------------------------------------------------------ */

  function downloadAll() {
    // Read back one record per message, for the same reason they are stored that
    // way. Assembling the array here is fine -- it lives in page memory and never
    // crosses the extension boundary.
    const records = [];
    for (const k of getIndex()) {
      const r = getRecord(k);
      if (r) records.push(r);
    }
    if (records.length === 0) {
      alert('Nothing cached yet.');
      return;
    }
    const payload = {
      scrapedAt: new Date().toISOString(),
      source: 'MA Secretary of State Lobbyist Public Search - Summary.aspx pages',
      sourceUrl:
        'https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx',
      capturedBy: 'sos-lobbyist-detail-scraper.user.js v' + VERSION,
      count: records.length,
      records,
    };
    saveJson(JSON.stringify(payload, null, 2), 'sos-lobbyist-detail');
  }

  // Raw per-registrant activity dump for scripts/parse-sos-activities.py.
  // Written without indentation: ~200k rows for a full year.
  function downloadActivities() {
    const records = [];
    for (const k of getActIndex()) {
      const r = getActRecord(k);
      if (r) records.push(r);
    }
    if (records.length === 0) {
      alert('No bill activity cached yet.');
      return;
    }
    const payload = {
      scrapedAt: new Date().toISOString(),
      source:
        'MA Secretary of State Lobbyist Public Search - CompleteDisclosure.aspx pages',
      sourceUrl:
        'https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx',
      capturedBy: 'sos-lobbyist-detail-scraper.user.js v' + VERSION,
      count: records.length,
      rowColumns: ACT_ROW_COLUMNS,
      records,
    };
    saveJson(JSON.stringify(payload), 'sos-lobbyist-activities');
  }

  function saveJson(text, prefix) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    a.href = url;
    a.download = `${prefix}-${stamp}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ------------------------------------------------------------------ */
  /* boot                                                               */
  /* ------------------------------------------------------------------ */

  // ASP.NET WebForms re-renders the grid via postback without a full nav,
  // so we re-render the panel whenever the results table changes. Throttle
  // the observer so it doesn't fire on every keystroke or our own innerHTML
  // updates (re-renders are gated by lastRenderKey anyway, but the throttle
  // keeps CPU low on slow machines).
  function whenBodyReady(cb) {
    if (document.body) return cb();
    const iv = setInterval(() => {
      if (document.body) {
        clearInterval(iv);
        cb();
      }
    }, 50);
  }

  whenBodyReady(() => {
    buildPanel();
    let pending = false;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (document.getElementById('ta-sos-scraper')) render();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Also re-render every 2 sec in case nothing in the DOM changed but the
    // URL did (e.g. SPA-style history.pushState).
    setInterval(() => {
      if (document.getElementById('ta-sos-scraper')) render();
    }, 2000);
  });
})();
