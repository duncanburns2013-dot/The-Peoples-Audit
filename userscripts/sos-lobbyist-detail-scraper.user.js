// ==UserScript==
// @name         MA SOS Lobbyist Detail Scraper
// @namespace    https://github.com/duncanburns2013-dot/The-Peoples-Audit
// @version      1.1
// @description  Scrape per-firm detail (clients, fees, lobbyists, salaries) from the MA Secretary of State Lobbyist Public Search and download as JSON. Runs in your real browser session so it bypasses the WAF that blocks server-side scrapes.
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

PRIVACY
-------
Runs entirely in your browser. No data leaves the page until YOU click Download.
*/

(function () {
  'use strict';

  const STORAGE_KEY = 'sos_lobbyist_detail_cache_v1';
  const DELAY_MS = 2000; // polite delay between fetches

  // Loud console marker so we can confirm the script actually ran.
  console.log(
    '%c[ta-sos] v1.1 loaded',
    'background:#2563eb;color:#fff;padding:2px 6px;border-radius:3px',
    location.href,
  );

  /* ------------------------------------------------------------------ */
  /* state                                                              */
  /* ------------------------------------------------------------------ */

  function getCache() {
    try {
      return JSON.parse(GM_getValue(STORAGE_KEY, '{}')) || {};
    } catch (e) {
      return {};
    }
  }
  function setCache(obj) {
    GM_setValue(STORAGE_KEY, JSON.stringify(obj));
  }
  function clearCache() {
    GM_deleteValue(STORAGE_KEY);
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

    // every table → 2D string array, with optional id/caption
    const tables = [];
    main.querySelectorAll('table').forEach((t) => {
      // skip layout tables that contain almost no data
      const rows = [];
      t.querySelectorAll('tr').forEach((tr) => {
        const cells = [];
        tr.querySelectorAll('th,td').forEach((c) => {
          cells.push((c.textContent || '').replace(/\s+/g, ' ').trim());
        });
        if (cells.some((c) => c)) rows.push(cells);
      });
      if (rows.length === 0) return;
      tables.push({
        id: t.id || null,
        className: t.className || null,
        rows,
      });
    });

    return { title, spans, links: linksOut, tables };
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
          <span>SOS Detail Scraper <span style="font-size:10px;color:#8a93a4;font-weight:400">v1.1</span></span>
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
        `}
        <div class="row" style="flex-wrap:wrap;margin-top:6px">
          <button class="btn-secondary" id="ta-download" ${cachedCount === 0 ? 'disabled' : ''}>
            Download JSON (${cachedCount})
          </button>
          <button class="btn-danger" id="ta-clear">Clear cache</button>
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
      document.getElementById('ta-download').onclick = downloadAll;
      document.getElementById('ta-clear').onclick = () => {
        if (confirm(`Delete ${cachedCount} cached firm records?`)) {
          clearCache();
          lastRenderKey = null;
          render();
        }
      };
    } else if (isSummary) {
      panel.innerHTML = `
        <h3>
          <span>SOS Detail Scraper <span style="font-size:10px;color:#8a93a4;font-weight:400">v1.1</span></span>
          <button class="close-x" id="ta-close">×</button>
        </h3>
        ${debugStrip}
        <div class="meta">On a Summary.aspx page.</div>
        <div class="progress">Cached records: ${cachedCount}</div>
        <button class="btn-secondary" id="ta-back">↶ Go to Default.aspx</button>
        <button class="btn-secondary" id="ta-download" ${
          cachedCount === 0 ? 'disabled' : ''
        }>Download JSON</button>
      `;
      document.getElementById('ta-close').onclick = () => panel.remove();
      document.getElementById('ta-back').onclick = () =>
        (location.href =
          'https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx');
      document.getElementById('ta-download').onclick = downloadAll;
    } else {
      // Unknown LobbyistPublicSearch sub-path. Still show the panel with debug
      // info instead of disappearing silently.
      panel.innerHTML = `
        <h3>
          <span>SOS Detail Scraper <span style="font-size:10px;color:#8a93a4;font-weight:400">v1.1</span></span>
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
      `;
      document.getElementById('ta-close').onclick = () => panel.remove();
      document.getElementById('ta-go').onclick = () =>
        (location.href =
          'https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx');
      document.getElementById('ta-download').onclick = downloadAll;
    }
  }

  /* ------------------------------------------------------------------ */
  /* run loop                                                           */
  /* ------------------------------------------------------------------ */

  let scraping = false;
  async function runScrape(rows, year, onProgress) {
    if (scraping) return;
    scraping = true;
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
        cache[key] = detail;
        setCache(cache);
        ok++;
      } catch (e) {
        console.warn('[ta-sos] fail', r.name, e);
        fail++;
      }
      await sleep(DELAY_MS);
    }
    scraping = false;
    alert(`Done. ${ok} ok, ${fail} failed. Click Download JSON to save.`);
    onProgress && onProgress();
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /* ------------------------------------------------------------------ */
  /* download                                                           */
  /* ------------------------------------------------------------------ */

  function downloadAll() {
    const cache = getCache();
    const records = Object.values(cache);
    if (records.length === 0) {
      alert('Nothing cached yet.');
      return;
    }
    const payload = {
      scrapedAt: new Date().toISOString(),
      source: 'MA Secretary of State Lobbyist Public Search - Summary.aspx pages',
      sourceUrl:
        'https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx',
      capturedBy: 'sos-lobbyist-detail-scraper.user.js v1.0',
      count: records.length,
      records,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    a.href = url;
    a.download = `sos-lobbyist-detail-${stamp}.json`;
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
