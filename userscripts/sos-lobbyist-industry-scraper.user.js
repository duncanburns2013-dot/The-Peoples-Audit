// ==UserScript==
// @name         MA SOS Lobbyist Industry Scraper
// @namespace    https://github.com/duncanburns2013-dot/The-Peoples-Audit
// @version      1.0
// @description  Capture the client -> industry mapping from the MA Secretary of State Lobbyist Public Search "Industry Type" results grid and download it as JSON.
// @author       The People's Audit
// @match        https://www.sec.state.ma.us/LobbyistPublicSearch/*
// @match        https://sec.state.ma.us/LobbyistPublicSearch/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-idle
// ==/UserScript==

/*
USAGE
-----
1. Install in Tampermonkey alongside sos-lobbyist-detail-scraper.user.js.
2. Go to https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx
3. Pick the "Industry Type" radio. The form reloads with a Registration Year
   dropdown and a multi-select list of 36 industries.
4. Pick the year, click "Select all industries" in this panel (bottom-right),
   set "View all results", click Search.
5. The grid comes back grouped by industry (one row per client, the industry
   cell spanning its group). Click "Capture N rows", then "Download JSON".
6. python scripts/parse-sos-industries.py <download> writes
   public/data/ma-lobbying-industries-<year>.json.

No page fetching: everything is on the results grid, so a capture is instant.

WHAT THE GRID HOLDS
-------------------
  <span id="..._grdvSearchResultByTypeAndCategory_lblIndustry_N">Marijuana</span>
      only on the first row of each industry group (rowspan)
  <a id="..._grdvSearchResultByTypeAndCategory_hplDisplayName_N"
     href="Summary.aspx?sysvalue=...">Client name</a>
      one per row
Walking both in document order assigns each client the industry above it.
The page nests the grid inside layout tables, so walking <tr>s double-counts
the first row; walking the spans and links directly does not.

Results are Clients only: 2026 returned 1,733 rows, the same 1,733 sysvalues as
the Client detail scrape.

STORAGE
-------
Same layout as sos-lobbyist-detail-scraper v1.5: one GM value per record plus an
index of keys. Never one growing blob; see the comment in that file for how a
blob crossed Chrome's 64 MiB extension-messaging cap and stopped injection.
Keys use their own prefixes so the two scripts never touch each other's cache.
*/

(function () {
  'use strict';

  const VERSION = '1.0';
  const INDEX_KEY = 'sos_industry_index_v1';
  const REC_PREFIX = 'sos_industry_rec_v1::';
  const GRID = 'grdvSearchResultByTypeAndCategory';

  console.log(
    '%c[ta-sos-industry] v' + VERSION + ' loaded',
    'background:#0f766e;color:#fff;padding:2px 6px;border-radius:3px',
    location.href,
  );

  /* ------------------------------------------------------------------ */
  /* storage: one GM value per record + a key index                     */
  /* ------------------------------------------------------------------ */

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
  function getRecord(key) {
    try {
      return JSON.parse(GM_getValue(REC_PREFIX + key, 'null'));
    } catch (e) {
      return null;
    }
  }
  // Writes every new record, then the index once. The index is a Set in page
  // memory while we work, so a 1,733-row capture is 1,733 small messages plus
  // one index write, not 1,733 index rewrites.
  function putRecords(recs) {
    const keys = getIndex();
    const have = new Set(keys);
    let added = 0;
    for (const r of recs) {
      const key = `${r.year}::${r.industry}::${r.sysvalue}`;
      GM_setValue(REC_PREFIX + key, JSON.stringify(r));
      if (!have.has(key)) {
        have.add(key);
        keys.push(key);
        added++;
      }
    }
    setIndex(keys);
    return added;
  }
  function clearCache() {
    for (const k of getIndex()) GM_deleteValue(REC_PREFIX + k);
    GM_deleteValue(INDEX_KEY);
  }

  /* ------------------------------------------------------------------ */
  /* page reading                                                       */
  /* ------------------------------------------------------------------ */

  function yearSelect() {
    return document.querySelector('select[id$="ucSearchCriteriaByCategory_ddlYear"]');
  }
  function industryList() {
    return document.querySelector('select[id$="ucSearchCriteriaByCategory_lstCategory"]');
  }

  // The year the grid was produced for. ASP.NET keeps the dropdown on the
  // submitted value after the postback, so it matches the results.
  function detectYear() {
    const sel = yearSelect();
    return sel ? sel.value : null;
  }

  function extractRows() {
    const year = detectYear();
    const nodes = document.querySelectorAll(
      `span[id*="${GRID}_lblIndustry_"], a[id*="${GRID}_hplDisplayName_"]`,
    );
    const rows = [];
    const seen = new Set();
    let industry = null;
    nodes.forEach((el) => {
      if (el.tagName === 'SPAN') {
        industry = (el.textContent || '').replace(/\s+/g, ' ').trim();
        return;
      }
      const href = el.getAttribute('href') || '';
      const m = href.match(/sysvalue=([^&]+)/);
      if (!m || !industry) return;
      const sysvalue = decodeURIComponent(m[1]);
      const key = industry + '::' + sysvalue;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({
        year,
        industry,
        name: (el.textContent || '').trim(),
        sysvalue,
        url: new URL(href, location.href).toString(),
      });
    });
    return rows;
  }

  /* ------------------------------------------------------------------ */
  /* UI                                                                 */
  /* ------------------------------------------------------------------ */

  function buildPanel() {
    if (document.getElementById('ta-sos-industry')) return;
    const style = document.createElement('style');
    style.textContent = `
      #ta-sos-industry {
        position: fixed; bottom: 12px; right: 12px; z-index: 2147483646;
        width: 300px; background: #13201f; color: #e6f0ef;
        border: 1px solid #2c4a47; border-radius: 10px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        padding: 12px 14px;
      }
      #ta-sos-industry h3 { margin: 0 0 6px; font-size: 14px; color: #2dd4bf;
        display: flex; justify-content: space-between; }
      #ta-sos-industry .meta { font-size: 11px; color: #8fb3ae; margin-bottom: 8px; }
      #ta-sos-industry .progress { margin: 8px 0; padding: 8px; background: #0b1514;
        border-radius: 6px; font: 12px ui-monospace, monospace; }
      #ta-sos-industry button { cursor: pointer; padding: 6px 10px; border-radius: 6px;
        border: 1px solid #2c4a47; background: #1c302e; color: #d5e8e5;
        font: inherit; margin: 3px 3px 3px 0; }
      #ta-sos-industry button.primary { background: #0f766e; border-color: #0f766e; color: #fff; }
      #ta-sos-industry button.danger { color: #f87171; border-color: #4a2828; background: #1f1a1a; }
      #ta-sos-industry button:disabled { opacity: 0.45; cursor: default; }
      #ta-sos-industry .x { background: none; border: none; color: #8fb3ae; padding: 0 4px; margin: 0; }
    `;
    document.head.appendChild(style);
    const panel = document.createElement('div');
    panel.id = 'ta-sos-industry';
    document.body.appendChild(panel);
    render();
  }

  let lastRenderKey = null;

  function render() {
    const panel = document.getElementById('ta-sos-industry');
    if (!panel) return;
    const onIndustryForm = !!industryList();
    const rows = onIndustryForm ? extractRows() : [];
    const year = detectYear();
    const cachedKeys = getIndex();
    const cached = new Set(cachedKeys);
    const fresh = rows.filter((r) => !cached.has(`${r.year}::${r.industry}::${r.sysvalue}`));
    const industries = new Set(rows.map((r) => r.industry)).size;

    const key = JSON.stringify([onIndustryForm, rows.length, fresh.length, cachedKeys.length, year]);
    if (key === lastRenderKey) return;
    lastRenderKey = key;

    panel.innerHTML = `
      <h3><span>SOS Industry Scraper <span style="font-size:10px;color:#8fb3ae;font-weight:400">v${VERSION}</span></span>
        <button class="x" id="tai-close">×</button></h3>
      ${onIndustryForm ? `
        <div class="meta">Year: <b>${year || '?'}</b> · grid: <b>${rows.length}</b> clients in <b>${industries}</b> industries</div>
        <button id="tai-all">Select all industries</button>
        ${rows.length === 0 ? `
          <div class="progress" style="color:#fbbf24">No results grid yet. Select all industries,
          set "View all results", click Search.</div>` : ''}
      ` : `
        <div class="progress" style="color:#fbbf24">Select the <b>Industry Type</b> radio on the
        search form to use this panel.</div>`}
      <div class="progress">
        Cached records: ${cachedKeys.length}<br>
        New on this grid: <b style="color:#2dd4bf">${fresh.length}</b>
      </div>
      <button class="primary" id="tai-capture" ${fresh.length === 0 ? 'disabled' : ''}>Capture ${fresh.length} rows</button>
      <button id="tai-download" ${cachedKeys.length === 0 ? 'disabled' : ''}>Download JSON (${cachedKeys.length})</button>
      <button class="danger" id="tai-clear" ${cachedKeys.length === 0 ? 'disabled' : ''}>Clear</button>
    `;

    document.getElementById('tai-close').onclick = () => panel.remove();
    const allBtn = document.getElementById('tai-all');
    if (allBtn) allBtn.onclick = () => {
      for (const o of industryList().options) o.selected = true;
    };
    document.getElementById('tai-capture').onclick = () => {
      const added = putRecords(fresh.map((r) => ({ ...r, scrapedAt: new Date().toISOString() })));
      console.log('[ta-sos-industry] captured', added, 'records');
      lastRenderKey = null;
      render();
    };
    document.getElementById('tai-download').onclick = downloadAll;
    document.getElementById('tai-clear').onclick = () => {
      if (confirm(`Delete ${cachedKeys.length} cached industry records?`)) {
        clearCache();
        lastRenderKey = null;
        render();
      }
    };
  }

  function downloadAll() {
    // One record per message on the way out too; the array only ever lives in
    // page memory.
    const records = [];
    for (const k of getIndex()) {
      const r = getRecord(k);
      if (r) records.push(r);
    }
    if (!records.length) return alert('Nothing cached yet.');
    const payload = {
      scrapedAt: new Date().toISOString(),
      source: 'MA Secretary of State Lobbyist Public Search - Industry Type results',
      sourceUrl: 'https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx',
      capturedBy: 'sos-lobbyist-industry-scraper.user.js v' + VERSION,
      count: records.length,
      records,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sos-lobbyist-industries-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ------------------------------------------------------------------ */
  /* boot                                                               */
  /* ------------------------------------------------------------------ */

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
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (document.getElementById('ta-sos-industry')) render();
      });
    }).observe(document.body, { childList: true, subtree: true });
  });
})();
