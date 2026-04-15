#!/usr/bin/env node
/**
 * fetch-ma-lobbying.mjs  (v4 — Playwright transport + regex parsing)
 *
 * The SOS site blocks plain HTTP from GitHub Actions but allows Playwright.
 * However, clicking the ASPX Search button breaks the page in headless mode.
 *
 * Solution: Use Playwright ONLY as a transport layer to get the raw HTML,
 * then parse it with regex. The page already loads with 2026 results by
 * default — no need to click Search at all.
 *
 * For "View all results" we need one interaction: change the page size
 * dropdown and click Search. If that fails, we fall back to parsing
 * whatever loaded on the initial page (usually 100 results).
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

/** Parse GridItem rows from raw HTML using regex */
function parseResultsFromHtml(html) {
  const records = [];

  // Lenient pattern: find each GridItem row, then extract type and name
  const rowPattern = /<tr[^>]*class="GridItem"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const rowHtml = rowMatch[1];

    // Extract account type from span with lblUserType
    const typeMatch = rowHtml.match(/id="[^"]*lblUserType[^"]*"[^>]*>([^<]*)</i);
    const accountType = typeMatch ? cleanText(typeMatch[1]) : '';

    // Extract name and href from link with hplDisplayName
    const linkMatch = rowHtml.match(/id="[^"]*hplDisplayName[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]*)</i);
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
    // ---- Step 1: Navigate and wait for page to fully load ----
    console.log('[ma-lobbying] Navigating to Lobbyist Public Search...');
    await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000); // Let ASPX scripts run
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    // Grab the raw HTML immediately — the page loads with default results
    let html = await page.content();
    console.log(`[ma-lobbying] Initial page: ${html.length} bytes`);

    // Quick check: do we already have results?
    let initialRecords = parseResultsFromHtml(html);
    console.log(`[ma-lobbying] Initial page has ${initialRecords.length} records`);

    // ---- Step 2: Try to get ALL results by changing page size ----
    if (initialRecords.length > 0) {
      try {
        console.log('[ma-lobbying] Trying to set "View all results" and re-search...');

        // Change page size to 20000 ("View all results")
        await page.selectOption('#ContentPlaceHolder1_drpPageSize', '20000').catch(() => {
          console.log('[ma-lobbying]   Could not change page size dropdown');
        });

        // Click the search button
        await page.click('#ContentPlaceHolder1_btnSearch', { timeout: 5000 }).catch(() => {
          console.log('[ma-lobbying]   Could not click search button');
        });

        // Wait for results to load
        await page.waitForTimeout(8000);
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

        const allHtml = await page.content();
        const allResults = parseResultsFromHtml(allHtml);
        console.log(`[ma-lobbying] After "View all": ${allResults.length} records (${allHtml.length} bytes)`);

        if (allResults.length > initialRecords.length) {
          html = allHtml;
          initialRecords = allResults;
        }
      } catch (err) {
        console.log(`[ma-lobbying] "View all" attempt failed: ${err.message} — using initial results`);
      }
    }

    // ---- Step 3: If we have records from the initial load, use them ----
    if (initialRecords.length > 0) {
      allRecords.push(...initialRecords);
      console.log(`[ma-lobbying] Using ${allRecords.length} records from page`);

      // ---- Step 3b: Handle pagination if we're on 100-per-page ----
      if (initialRecords.length >= 90 && initialRecords.length <= 100) {
        console.log('[ma-lobbying] Looks like paginated results, trying to get more pages...');
        let pageNum = 1;

        for (let p = 2; p <= 100; p++) {
          // Look for next page link and click it
          const clicked = await page.evaluate((nextNum) => {
            // Find the GridView's pagination row
            const table = document.querySelector('[id*="grdvSearchResultByTypeAndCategory"]');
            if (!table) return false;
            const links = table.querySelectorAll('tr:last-child a');
            for (const link of links) {
              if (link.textContent.trim() === String(nextNum)) {
                link.click();
                return true;
              }
            }
            // Try "..." link
            for (const link of links) {
              if (link.textContent.trim() === '...') {
                link.click();
                return true;
              }
            }
            return false;
          }, p).catch(() => false);

          if (!clicked) {
            console.log(`[ma-lobbying] No more pages after page ${p - 1}`);
            break;
          }

          await page.waitForTimeout(3000);
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

          const pageHtml = await page.content();
          const pageRecords = parseResultsFromHtml(pageHtml);

          if (pageRecords.length === 0) {
            console.log(`[ma-lobbying] Page ${p} returned 0 records, stopping`);
            break;
          }

          allRecords.push(...pageRecords);
          pageNum = p;
          console.log(`[ma-lobbying]   Page ${p}: ${pageRecords.length} records (${allRecords.length} total)`);

          await sleep(1000);
        }
      }
    } else {
      // No results on initial page — log debug info
      const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || 'N/A';
      const hasViewState = html.includes('__VIEWSTATE');
      const hasGridItem = html.includes('GridItem');
      const hasForm = html.includes('form1');
      console.log(`[ma-lobbying] Debug: title="${title}", VIEWSTATE=${hasViewState}, GridItem=${hasGridItem}, form=${hasForm}`);
      console.log(`[ma-lobbying] HTML snippet: ${html.substring(0, 500).replace(/\s+/g, ' ')}`);
    }

    console.log(`[ma-lobbying] Collected ${allRecords.length} total records`);

    // ---- Step 4: Scrape detail pages for Lobbyist Entities ----
    const entities = allRecords.filter(r =>
      r.accountType.toLowerCase().includes('entity') && r.detailUrl
    );
    const entitiesToScrape = entities.slice(0, MAX_DETAIL_PAGES);

    console.log(`[ma-lobbying] Fetching details for ${entitiesToScrape.length} entities...`);

    for (let i = 0; i < entitiesToScrape.length; i++) {
      const entity = entitiesToScrape[i];
      try {
        const detailPage = await context.newPage();
        await detailPage.goto(entity.detailUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        await detailPage.waitForTimeout(2000);

        const dHtml = await detailPage.content();
        await detailPage.close();

        const addrMatch = dHtml.match(/Address:\s*([^<]+?)(?:<|Registration)/si);
        const address = addrMatch ? cleanText(addrMatch[1]) : '';

        const salaryMatch = dHtml.match(/Total salaries paid:\s*\$?([\d,.]+)/i);
        const totalSalaries = salaryMatch ? salaryMatch[1] : '0';

        // Extract client names from links
        const clients = [];
        const clientPattern = /class="BlueLinks"[^>]*href="Summary\.aspx[^"]*"[^>]*>([^<]+)<\/a>/gi;
        const seen = new Set();
        let cm;
        while ((cm = clientPattern.exec(dHtml)) !== null) {
          const cn = cleanText(cm[1]);
          if (cn && !seen.has(cn) && cn !== entity.name) {
            seen.add(cn);
            clients.push({ name: cn, amount: '$0.00', details: '' });
          }
        }

        entityDetails.push({
          name: entity.name,
          accountType: entity.accountType,
          address,
          clients: clients.slice(0, 50),
          totalSalaries: parseMoney(totalSalaries),
          totalExpenditure: parseMoney(totalSalaries),
        });

        if ((i + 1) % 20 === 0 || i === 0) {
          console.log(`[ma-lobbying]   ${i + 1}/${entitiesToScrape.length} done`);
        }
        await sleep(DELAY_MS);
      } catch {
        // skip failed detail pages
      }
    }

    console.log(`[ma-lobbying] Scraped ${entityDetails.length} entity details`);

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
    summary: {
      totalClients: clients.length,
      totalLobbyists: lobbyists.length,
      totalEntities: entities.length,
    },
    top20,
    records: allRecords,
    entityDetails,
    industrySummary: Object.entries(industryCounts)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.count - a.count),
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  console.log(`[ma-lobbying] Wrote ${allRecords.length} records (${entityDetails.length} with details) to ${OUTPUT_PATH}`);
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
    scrapedSuccessfully: false,
    preservedFromCache: false,
    warnings: [`fatal: ${err?.message || String(err)}`],
    totalRecords: 0,
    top20: [],
    records: [],
    entityDetails: [],
    industrySummary: [],
  };
  mkdir(dirname(OUTPUT_PATH), { recursive: true })
    .then(() => writeFile(OUTPUT_PATH, JSON.stringify(stub, null, 2) + '\n'))
    .finally(() => process.exit(0));
});
