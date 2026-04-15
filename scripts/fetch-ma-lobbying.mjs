#!/usr/bin/env node
/**
 * fetch-ma-lobbying.mjs  (v5 — complete rewrite)
 *
 * Proven facts from testing:
 *   - Playwright loads the SOS page fine (108KB, VIEWSTATE present)
 *   - The initial page has NO results (must submit search)
 *   - Clicking the Search button breaks ASPX rendering in headless
 *   - Plain HTTP fetch() can't connect from GitHub Actions
 *
 * Solution: Playwright loads the page, then submits the form using
 * JavaScript __doPostBack (native ASPX submission) instead of clicking.
 * Then we grab the raw HTML and parse with regex.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'data', 'ma-lobbying.json');
const BASE_URL = 'https://www.sec.state.ma.us/LobbyistPublicSearch';
const SEARCH_URL = `${BASE_URL}/Default.aspx`;
const DELAY_MS = 800;
const MAX_DETAIL_PAGES = 150;

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function cleanText(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function parseMoney(s) {
  if (!s) return 0;
  return parseFloat(String(s).replace(/[$,\s]/g, '')) || 0;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadExisting() {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/** Parse GridItem rows from raw HTML */
function parseResultsFromHtml(html) {
  const records = [];
  const rowPattern = /<tr[^>]*class="GridItem"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const typeMatch = rowHtml.match(/id="[^"]*lblUserType[^"]*"[^>]*>([^<]*)</i);
    const linkMatch = rowHtml.match(/id="[^"]*hplDisplayName[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]*)</i);

    const accountType = typeMatch ? cleanText(typeMatch[1]) : '';
    const href = linkMatch ? linkMatch[1] : '';
    const name = linkMatch ? cleanText(linkMatch[2]) : '';

    if (name && name.length > 1) {
      const detailUrl = href.startsWith('http') ? href : href ? `${BASE_URL}/${href}` : '';
      records.push({ accountType, name, detailUrl });
    }
  }
  return records;
}

/* ------------------------------------------------------------------ */
/* Scraper                                                              */
/* ------------------------------------------------------------------ */

async function scrapeLobbyists() {
  const { chromium } = await import('playwright');
  const allRecords = [];
  const entityDetails = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  try {
    // ---- Step 1: Load the page ----
    console.log('[ma-lobbying] Navigating to Lobbyist Public Search...');
    await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    let html = await page.content();
    console.log(`[ma-lobbying] Page loaded: ${html.length} bytes`);

    const hasViewState = html.includes('__VIEWSTATE');
    const hasForm = html.includes('ContentPlaceHolder1_btnSearch');
    console.log(`[ma-lobbying] VIEWSTATE=${hasViewState}, SearchButton=${hasForm}`);

    if (!hasForm) {
      console.log('[ma-lobbying] ERROR: Search form not found on page');
      return { allRecords, entityDetails };
    }

    // ---- Step 2: Submit search via native ASPX postback ----
    console.log('[ma-lobbying] Submitting search via __doPostBack...');

    await page.evaluate(() => {
      // Set page size to "View all" (20000)
      var ps = document.getElementById('ContentPlaceHolder1_drpPageSize');
      if (ps) ps.value = '20000';

      // Set type to ALL
      var tp = document.getElementById('ContentPlaceHolder1_ucSearchCriteriaByType_drpType');
      if (tp) tp.value = 'Z';

      // Set year to 2026
      var yr = document.getElementById('ContentPlaceHolder1_ucSearchCriteriaByType_ddlYear');
      if (yr) yr.value = '2026';

      // Submit via ASPX native postback mechanism
      var form = document.getElementById('form1');
      var et = document.getElementById('__EVENTTARGET');
      var ea = document.getElementById('__EVENTARGUMENT');
      if (et) et.value = 'ctl00$ContentPlaceHolder1$btnSearch';
      if (ea) ea.value = '';
      if (form) form.submit();
    });

    console.log('[ma-lobbying] Form submitted, waiting for results...');

    // Wait for navigation (form.submit() causes a full page reload)
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch((err) => {
      console.log(`[ma-lobbying] Navigation wait: ${err.message}`);
    });
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    html = await page.content();
    console.log(`[ma-lobbying] Results page: ${html.length} bytes`);

    const hasGridItem = html.includes('GridItem');
    const hasTable = html.includes('grdvSearchResultByTypeAndCategory');
    console.log(`[ma-lobbying] GridItem=${hasGridItem}, ResultsTable=${hasTable}`);

    // ---- Step 3: Parse results ----
    let records = parseResultsFromHtml(html);
    console.log(`[ma-lobbying] Parsed ${records.length} records`);

    if (records.length === 0) {
      // Maybe the form.submit didn't work. Try clicking the button directly as fallback.
      console.log('[ma-lobbying] No records from __doPostBack, trying button click fallback...');
      try {
        await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

        // Set values
        await page.selectOption('#ContentPlaceHolder1_drpPageSize', '20000').catch(() => {});
        await page.selectOption('#ContentPlaceHolder1_ucSearchCriteriaByType_drpType', 'Z').catch(() => {});

        // Click and wait
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
          page.click('#ContentPlaceHolder1_btnSearch', { timeout: 5000 }),
        ]);
        await page.waitForTimeout(8000);
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

        html = await page.content();
        records = parseResultsFromHtml(html);
        console.log(`[ma-lobbying] Fallback click: ${records.length} records (${html.length} bytes)`);
      } catch (err) {
        console.log(`[ma-lobbying] Fallback click failed: ${err.message}`);
      }
    }

    if (records.length > 0) {
      allRecords.push(...records);
    }

    // ---- Step 4: Handle pagination if not "View all" ----
    if (records.length >= 90 && records.length <= 100) {
      console.log('[ma-lobbying] Got paginated results, fetching more pages...');
      for (let p = 2; p <= 50; p++) {
        try {
          const clicked = await page.evaluate((nextNum) => {
            var table = document.querySelector('[id*="grdvSearchResultByTypeAndCategory"]');
            if (!table) return false;
            var links = table.querySelectorAll('tr:last-child a');
            for (var i = 0; i < links.length; i++) {
              if (links[i].textContent.trim() === String(nextNum)) {
                links[i].click();
                return true;
              }
            }
            for (var j = 0; j < links.length; j++) {
              if (links[j].textContent.trim() === '...') {
                links[j].click();
                return true;
              }
            }
            return false;
          }, p);

          if (!clicked) {
            console.log(`[ma-lobbying] No page ${p} link found, done`);
            break;
          }

          await page.waitForTimeout(4000);
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

          const pageHtml = await page.content();
          const pageRecords = parseResultsFromHtml(pageHtml);

          if (pageRecords.length === 0) {
            console.log(`[ma-lobbying] Page ${p}: 0 records, stopping`);
            break;
          }

          allRecords.push(...pageRecords);
          console.log(`[ma-lobbying]   Page ${p}: ${pageRecords.length} records (${allRecords.length} total)`);
          await sleep(1000);
        } catch (err) {
          console.log(`[ma-lobbying] Page ${p} error: ${err.message}`);
          break;
        }
      }
    }

    console.log(`[ma-lobbying] Collected ${allRecords.length} total records`);

    // ---- Step 5: Detail pages for entities ----
    const entities = allRecords.filter(r =>
      r.accountType.toLowerCase().includes('entity') && r.detailUrl
    );
    const toScrape = entities.slice(0, MAX_DETAIL_PAGES);
    console.log(`[ma-lobbying] Fetching details for ${toScrape.length} entities...`);

    for (let i = 0; i < toScrape.length; i++) {
      try {
        const dp = await context.newPage();
        await dp.goto(toScrape[i].detailUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await dp.waitForTimeout(2000);
        const dh = await dp.content();
        await dp.close();

        const addrM = dh.match(/Address:\s*([^<]+?)(?:<|Registration)/si);
        const salM = dh.match(/Total salaries paid:\s*\$?([\d,.]+)/i);
        const clients = [];
        const seen = new Set();
        const cp = /class="BlueLinks"[^>]*href="Summary\.aspx[^"]*"[^>]*>([^<]+)<\/a>/gi;
        let m;
        while ((m = cp.exec(dh)) !== null) {
          const cn = cleanText(m[1]);
          if (cn && !seen.has(cn) && cn !== toScrape[i].name) {
            seen.add(cn);
            clients.push({ name: cn, amount: '$0.00', details: '' });
          }
        }

        entityDetails.push({
          name: toScrape[i].name,
          accountType: toScrape[i].accountType,
          address: addrM ? cleanText(addrM[1]) : '',
          clients: clients.slice(0, 50),
          totalSalaries: parseMoney(salM ? salM[1] : '0'),
          totalExpenditure: parseMoney(salM ? salM[1] : '0'),
        });

        if ((i + 1) % 20 === 0 || i === 0) console.log(`[ma-lobbying]   ${i + 1}/${toScrape.length}`);
        await sleep(DELAY_MS);
      } catch { /* skip */ }
    }
    console.log(`[ma-lobbying] Got ${entityDetails.length} entity details`);

  } catch (err) {
    console.error('[ma-lobbying] Scraping error:', err.message);
  } finally {
    await browser.close();
  }

  return { allRecords, entityDetails };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  const warnings = [];
  let allRecords = [];
  let entityDetails = [];
  let scrapedSuccessfully = false;

  try {
    const result = await scrapeLobbyists();
    allRecords = result.allRecords;
    entityDetails = result.entityDetails;
    if (allRecords.length > 0) {
      scrapedSuccessfully = true;
    } else {
      warnings.push('Scraper returned 0 records — site structure may have changed');
    }
  } catch (err) {
    warnings.push(`Scraper failed: ${err?.message || String(err)}`);
  }

  const clients = allRecords.filter(r => r.accountType.toLowerCase() === 'client');
  const lobbyists = allRecords.filter(r => r.accountType.toLowerCase() === 'lobbyist');
  const entities = allRecords.filter(r => r.accountType.toLowerCase().includes('entity'));
  entityDetails.sort((a, b) => (b.totalExpenditure || 0) - (a.totalExpenditure || 0));

  const top20 = entityDetails.slice(0, 20).map((r, i) => ({
    rank: i + 1,
    name: r.name,
    totalExpenditure: r.totalExpenditure,
    clients: r.clients.map(c => c.name).join(', '),
    clientCount: r.clients.length,
    focus: r.clients.slice(0, 3).map(c => c.details).filter(Boolean).join('; ').slice(0, 200),
    yearFounded: '',
  }));

  const existing = await loadExisting();
  let preservedFromCache = false;
  if (allRecords.length === 0 && (existing?.records?.length || existing?.top20?.length)) {
    top20.push(...(existing.top20 || []));
    preservedFromCache = true;
    warnings.push('Scraper returned 0 records — preserving data from previous successful run.');
  }

  const industryCounts = {};
  for (const r of allRecords) {
    const type = r.accountType || 'Unknown';
    if (!industryCounts[type]) industryCounts[type] = { count: 0 };
    industryCounts[type].count++;
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    source: 'MA Secretary of State — Lobbyist Public Search',
    sourceUrl: SEARCH_URL,
    scrapedSuccessfully,
    preservedFromCache,
    warnings,
    totalRecords: allRecords.length,
    summary: { totalClients: clients.length, totalLobbyists: lobbyists.length, totalEntities: entities.length },
    top20,
    records: allRecords,
    entityDetails,
    industrySummary: Object.entries(industryCounts).map(([type, d]) => ({ type, ...d })).sort((a, b) => b.count - a.count),
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`[ma-lobbying] Wrote ${allRecords.length} records (${entityDetails.length} details) to ${OUTPUT_PATH}`);
  if (warnings.length) {
    console.log('[ma-lobbying] Warnings:');
    for (const w of warnings) console.log('  - ' + w);
  }
}

main().catch(async (err) => {
  console.error('[ma-lobbying] Fatal:', err);
  const existing = await loadExisting().catch(() => null);
  if (existing?.top20?.length) {
    existing.warnings = [`fatal: ${err?.message || String(err)} — preserving previous data`];
    existing.scrapedSuccessfully = false;
    existing.preservedFromCache = true;
    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, JSON.stringify(existing, null, 2) + '\n');
    console.log('[ma-lobbying] Preserved existing data after fatal error');
    return;
  }
  const stub = {
    fetchedAt: new Date().toISOString(),
    source: 'MA Secretary of State — Lobbyist Public Search',
    sourceUrl: SEARCH_URL,
    scrapedSuccessfully: false, preservedFromCache: false,
    warnings: [`fatal: ${err?.message || String(err)}`],
    totalRecords: 0, top20: [], records: [], entityDetails: [], industrySummary: [],
  };
  mkdir(dirname(OUTPUT_PATH), { recursive: true })
    .then(() => writeFile(OUTPUT_PATH, JSON.stringify(stub, null, 2) + '\n'))
    .finally(() => process.exit(0));
});
