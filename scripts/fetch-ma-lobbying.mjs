#!/usr/bin/env node
/**
 * fetch-ma-lobbying.mjs
 *
 * Scrapes the MA Secretary of State Lobbyist Public Search
 * (https://www.sec.state.ma.us/lobbyistpublicsearch/) using Playwright
 * and writes results to public/data/ma-lobbying.json.
 *
 * The SOS site is an ASP.NET WebForms app with ViewState — a headless
 * browser is the most reliable way to interact with it.
 *
 * Design rules (matching existing scrapers):
 *   - NEVER throw. Always write a valid JSON file.
 *   - If scraping fails, preserve previous cached data so the UI never blanks.
 *   - Output is sorted by total expenditures descending.
 *
 * Runs weekly via GitHub Actions (update-lobbying.yml).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'data', 'ma-lobbying.json');

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function cleanText(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function parseMoney(s) {
  if (!s) return 0;
  const cleaned = String(s).replace(/[$,\s]/g, '');
  return parseFloat(cleaned) || 0;
}

async function loadExisting() {
  try {
    const raw = await readFile(OUTPUT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Playwright scraper                                                   */
/* ------------------------------------------------------------------ */

async function scrapeLobbyists() {
  // Dynamic import so the script can still write fallback if playwright isn't installed
  const { chromium } = await import('playwright');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const allRecords = [];

  try {
    console.log('[ma-lobbying] Navigating to SOS Lobbyist Public Search...');
    await page.goto('https://www.sec.state.ma.us/lobbyistpublicsearch/', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // The site has search options: by Lobbyist, Entity, Client, Industry, etc.
    // Strategy: Search for all lobbyist entities (broadest useful view)
    // Look for a "Search" or "Lobbyist Entity" tab/link
    console.log('[ma-lobbying] Looking for entity search...');

    // Try clicking "Lobbyist Entity" tab if available
    const entityTab = await page.$('a:has-text("Lobbyist Entity"), a:has-text("Entity"), [id*="Entity"]');
    if (entityTab) {
      await entityTab.click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    }

    // Submit search with empty/wildcard criteria to get all results
    // ASPX sites typically have a search button — click it with empty fields
    const searchBtn = await page.$(
      'input[type="submit"][value*="Search"], button:has-text("Search"), input[type="button"][value*="Search"], [id*="btnSearch"], [id*="SearchButton"]'
    );
    if (searchBtn) {
      console.log('[ma-lobbying] Clicking search button...');
      await searchBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      // Wait for results table
      await page.waitForSelector('table', { timeout: 15000 }).catch(() => {});
    }

    // Also try: some ASPX sites need you to select "All" from a dropdown first
    const yearSelect = await page.$('select[id*="Year"], select[id*="year"]');
    if (yearSelect) {
      // Select most recent year
      const options = await yearSelect.$$eval('option', opts =>
        opts.map(o => ({ value: o.value, text: o.textContent.trim() }))
      );
      const currentYear = new Date().getFullYear();
      const recentYear = options.find(o =>
        o.text.includes(String(currentYear)) || o.text.includes(String(currentYear - 1))
      );
      if (recentYear) {
        await yearSelect.selectOption(recentYear.value);
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      }
    }

    // Parse results from whatever table is displayed
    console.log('[ma-lobbying] Parsing results table...');
    const tables = await page.$$('table');

    for (const table of tables) {
      const rows = await table.$$('tr');
      if (rows.length < 2) continue; // skip tables without data rows

      // Get headers
      const headerCells = await rows[0].$$('th, td');
      const headers = [];
      for (const cell of headerCells) {
        headers.push(cleanText(await cell.textContent()));
      }

      // Skip non-data tables (nav, layout, etc.)
      const headerText = headers.join(' ').toLowerCase();
      if (!headerText.match(/lobbyist|entity|client|expenditure|name|firm/)) continue;

      console.log(`[ma-lobbying] Found data table with headers: ${headers.join(' | ')}`);

      // Parse data rows
      for (let i = 1; i < rows.length; i++) {
        const cells = await rows[i].$$('td');
        if (cells.length < 2) continue;

        const cellTexts = [];
        for (const cell of cells) {
          cellTexts.push(cleanText(await cell.textContent()));
        }

        // Build record by mapping headers to values
        const record = {};
        for (let j = 0; j < Math.min(headers.length, cellTexts.length); j++) {
          record[headers[j]] = cellTexts[j];
        }

        // Normalize to consistent field names
        const normalized = {
          name: record['Lobbyist Entity'] || record['Entity Name'] || record['Lobbyist'] ||
                record['Name'] || record['Firm'] || cellTexts[0] || '',
          type: record['Type'] || record['Entity Type'] || '',
          clients: record['Clients'] || record['Number of Clients'] || record['Client Count'] || '',
          totalExpenditure: parseMoney(
            record['Total Expenditures'] || record['Expenditures'] ||
            record['Total Spend'] || record['Amount'] || ''
          ),
          expenditureToOfficials: parseMoney(
            record['Expenditure to Officials'] || record['To Officials'] ||
            record['Official Expenditures'] || record['Gifts to Officials'] || ''
          ),
          registrationYear: record['Year'] || record['Registration Year'] || '',
          address: record['Address'] || record['City'] || '',
        };

        if (normalized.name && normalized.name.length > 1) {
          allRecords.push(normalized);
        }
      }
    }

    // If no table data found, try parsing links/lists as fallback
    if (allRecords.length === 0) {
      console.log('[ma-lobbying] No table data found, trying link-based parsing...');
      const links = await page.$$eval('a[href*="lobbyist"], a[href*="entity"], a[href*="detail"]', els =>
        els.map(el => ({
          name: el.textContent.trim(),
          href: el.href,
        })).filter(l => l.name.length > 2 && l.name.length < 200)
      );

      for (const link of links) {
        if (!/home|search|login|help|contact|back|privacy|sign/i.test(link.name)) {
          allRecords.push({
            name: link.name,
            type: 'Lobbyist Entity',
            clients: '',
            totalExpenditure: 0,
            expenditureToOfficials: 0,
            registrationYear: '',
            address: '',
            detailUrl: link.href,
          });
        }
      }
    }

    // Try to get detail pages for top entities (expenditure data)
    // Only do this for the first 20 to avoid hammering the server
    if (allRecords.length > 0 && allRecords[0].totalExpenditure === 0) {
      console.log('[ma-lobbying] Checking detail pages for expenditure data...');
      const detailLinks = await page.$$eval(
        'a[href*="Detail"], a[href*="detail"], a[href*="View"]',
        els => els.map(el => ({ text: el.textContent.trim(), href: el.href }))
          .filter(l => l.text.length > 2)
          .slice(0, 20)
      );

      for (const link of detailLinks) {
        try {
          await page.goto(link.href, { waitUntil: 'networkidle', timeout: 15000 });
          const pageText = await page.textContent('body');

          // Look for expenditure amounts in the detail page
          const expMatch = pageText.match(/Total\s+Expenditure[s]?\s*[:\s$]*\s*([\d,.$]+)/i) ||
                          pageText.match(/Expenditure[s]?\s+to\s+Officials?\s*[:\s$]*\s*([\d,.$]+)/i);

          if (expMatch) {
            const existing = allRecords.find(r => r.name === link.text || r.detailUrl === link.href);
            if (existing) {
              existing.totalExpenditure = parseMoney(expMatch[1]);
            }
          }
        } catch {
          // Skip detail pages that fail
        }
      }
    }

    console.log(`[ma-lobbying] Scraped ${allRecords.length} records`);
  } catch (err) {
    console.error('[ma-lobbying] Scraping error:', err.message);
  } finally {
    await browser.close();
  }

  return allRecords;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  const warnings = [];
  let records = [];
  let scrapedSuccessfully = false;

  try {
    records = await scrapeLobbyists();
    if (records.length > 0) {
      scrapedSuccessfully = true;
    } else {
      warnings.push('Scraper returned 0 records — site structure may have changed');
    }
  } catch (err) {
    warnings.push(`Scraper failed: ${err?.message || String(err)}`);
  }

  // Sort by total expenditure descending
  records.sort((a, b) => (b.totalExpenditure || 0) - (a.totalExpenditure || 0));

  // If scrape failed, preserve previous data
  const existing = await loadExisting();
  let preservedFromCache = false;
  if (records.length === 0 && existing?.records?.length) {
    records = existing.records;
    preservedFromCache = true;
    warnings.push('Using cached data from previous successful scrape.');
  }

  // Build top 20 summary
  const top20 = records.slice(0, 20).map((r, i) => ({
    rank: i + 1,
    ...r,
  }));

  // Industry summary if we have enough data
  const industryCounts = {};
  for (const r of records) {
    const type = r.type || 'Unknown';
    if (!industryCounts[type]) industryCounts[type] = { count: 0, totalSpend: 0 };
    industryCounts[type].count++;
    industryCounts[type].totalSpend += r.totalExpenditure || 0;
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    source: 'MA Secretary of State — Lobbyist Public Search',
    sourceUrl: 'https://www.sec.state.ma.us/lobbyistpublicsearch/',
    scrapedSuccessfully,
    preservedFromCache,
    warnings,
    totalRecords: records.length,
    top20,
    records,
    industrySummary: Object.entries(industryCounts)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.totalSpend - a.totalSpend),
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  console.log(`[ma-lobbying] Wrote ${records.length} records to ${OUTPUT_PATH}`);
  if (warnings.length) {
    console.log('[ma-lobbying] Warnings:');
    for (const w of warnings) console.log('  - ' + w);
  }
}

main().catch((err) => {
  console.error('[ma-lobbying] Fatal:', err);
  // Write a stub so CI never fails and the site never blanks
  const stub = {
    fetchedAt: new Date().toISOString(),
    source: 'MA Secretary of State — Lobbyist Public Search',
    sourceUrl: 'https://www.sec.state.ma.us/lobbyistpublicsearch/',
    scrapedSuccessfully: false,
    preservedFromCache: false,
    warnings: [`fatal: ${err?.message || String(err)}`],
    totalRecords: 0,
    top20: [],
    records: [],
    industrySummary: [],
  };
  mkdir(dirname(OUTPUT_PATH), { recursive: true })
    .then(() => writeFile(OUTPUT_PATH, JSON.stringify(stub, null, 2) + '\n'))
    .finally(() => process.exit(0));
});
