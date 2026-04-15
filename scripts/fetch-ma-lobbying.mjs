#!/usr/bin/env node
/**
 * fetch-ma-lobbying.mjs
 *
 * Scrapes the MA Secretary of State Lobbyist Public Search
 * (https://www.sec.state.ma.us/lobbyistpublicsearch/) using Playwright
 * and writes results to public/data/ma-lobbying.json.
 *
 * The SOS site is an ASP.NET WebForms app. The search returns a
 * two-column table (Account type | Name) with clickable detail links.
 * Detail pages show entity info, lobbyists, clients, and expenditures.
 *
 * Design rules (matching existing scrapers):
 *   - NEVER throw. Always write a valid JSON file.
 *   - If scraping fails, preserve previous cached data so the UI never blanks.
 *   - Be respectful: delay between page loads, limit detail page visits.
 *
 * Runs weekly via GitHub Actions (update-lobbying.yml).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'data', 'ma-lobbying.json');
const DELAY_MS = 800;        // delay between detail page visits
const MAX_DETAIL_PAGES = 150; // cap detail scraping to avoid hammering

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadExisting() {
  try {
    const raw = await readFile(OUTPUT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Playwright scraper                                                   */
/* ------------------------------------------------------------------ */

async function scrapeLobbyists() {
  const { chromium } = await import('playwright');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const allRecords = [];       // all entities from the search results
  const entityDetails = [];    // detail data for Lobbyist Entities

  try {
    // ---- Step 1: Load the search page ----
    console.log('[ma-lobbying] Navigating to Lobbyist Public Search...');
    await page.goto('https://www.sec.state.ma.us/lobbyistpublicsearch/', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // ---- Step 2: Configure search and submit ----
    // Set results per page to 100
    const perPageSelect = await page.$('select[name*="PageSize"], select[id*="PageSize"], select[name*="pageSize"]');
    if (perPageSelect) {
      await perPageSelect.selectOption('100');
      console.log('[ma-lobbying] Set 100 results per page');
    }

    // Ensure "Lobbyist, Lobbyist Entity, or Client" radio is selected (default)
    const entityRadio = await page.$('input[type="radio"][value*="Entity"], input[type="radio"]:first-of-type');
    if (entityRadio) {
      await entityRadio.check();
    }

    // Click Search with empty name to get all records
    console.log('[ma-lobbying] Submitting search for all records...');
    const searchBtn = await page.$('input[type="submit"][value*="Search"], button:has-text("Search"), input[type="button"][value*="Search"]');
    if (searchBtn) {
      await searchBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // ---- Step 3: Parse results table (all pages) ----
    let pageNum = 1;
    let hasMore = true;

    while (hasMore) {
      console.log(`[ma-lobbying] Parsing results page ${pageNum}...`);

      // Find all rows in the results table
      const rows = await page.$$eval('table tr', (trs) =>
        trs.map(tr => {
          const cells = tr.querySelectorAll('td');
          if (cells.length < 2) return null;
          const type = cells[0]?.textContent?.trim() || '';
          const nameEl = cells[1]?.querySelector('a') || cells[1];
          const name = nameEl?.textContent?.trim() || '';
          const href = cells[1]?.querySelector('a')?.href || '';
          return { type, name, href };
        }).filter(Boolean)
      );

      // Filter out header rows and empty results
      const dataRows = rows.filter(r =>
        r.name &&
        r.name.length > 1 &&
        !r.name.toLowerCase().includes('account type') &&
        !r.type.toLowerCase().includes('account')
      );

      if (dataRows.length === 0 && pageNum === 1) {
        console.log('[ma-lobbying] No results found on first page');
        break;
      }

      for (const row of dataRows) {
        allRecords.push({
          accountType: row.type,
          name: row.name,
          detailUrl: row.href,
        });
      }

      console.log(`[ma-lobbying]   Page ${pageNum}: ${dataRows.length} records (${allRecords.length} total)`);

      // Check for next page link
      const nextLink = await page.$('a:has-text("Next"), a:has-text("next"), a:has-text(">>"), a[href*="Page$Next"]');
      if (nextLink && dataRows.length > 0) {
        await nextLink.click();
        await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(1500);
        pageNum++;
      } else {
        hasMore = false;
      }

      // Safety cap
      if (pageNum > 100) {
        console.log('[ma-lobbying] Hit page cap, stopping pagination');
        break;
      }
    }

    console.log(`[ma-lobbying] Collected ${allRecords.length} total records from search`);

    // ---- Step 4: Scrape detail pages for Lobbyist Entities ----
    const entities = allRecords.filter(r =>
      r.accountType.toLowerCase().includes('entity') && r.detailUrl
    );
    const entitiesToScrape = entities.slice(0, MAX_DETAIL_PAGES);

    console.log(`[ma-lobbying] Scraping detail pages for ${entitiesToScrape.length} lobbyist entities...`);

    for (let i = 0; i < entitiesToScrape.length; i++) {
      const entity = entitiesToScrape[i];
      try {
        const detailPage = await context.newPage();
        await detailPage.goto(entity.detailUrl, {
          waitUntil: 'networkidle',
          timeout: 15000,
        });

        const detail = await detailPage.evaluate(() => {
          const text = document.body.innerText;

          // Parse address
          const addrMatch = text.match(/Address:\s*(.+?)(?:\n|Registration)/s);
          const address = addrMatch ? addrMatch[1].trim() : '';

          // Parse clients — look for "Client information" section
          const clients = [];
          const clientSection = text.indexOf('Client information');
          if (clientSection !== -1) {
            // Find client names (they're typically links in the HTML)
            const clientLinks = document.querySelectorAll('a[href*="Summary"]');
            const clientInfoSection = document.querySelector('table') || document.body;
            // Get text after "Client information"
            const afterClient = text.substring(clientSection);
            // Simple parsing: look for lines with dollar amounts
            const lines = afterClient.split('\n');
            let currentClient = null;
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('$') || trimmed.match(/^\$[\d,.]+$/)) {
                if (currentClient) {
                  currentClient.amount = trimmed;
                }
              } else if (trimmed.length > 2 &&
                         !trimmed.startsWith('Employed') &&
                         !trimmed.startsWith('Terminated') &&
                         !trimmed.startsWith('Details') &&
                         !trimmed.startsWith('Client info') &&
                         !trimmed.startsWith('Amount') &&
                         !trimmed.match(/^\d{2}\/\d{2}\/\d{4}/) &&
                         trimmed.length < 200) {
                // Check if it looks like an entity name
                if (!trimmed.includes('lobbyist') &&
                    !trimmed.includes('Total salaries') &&
                    !trimmed.includes('Lobbyist info')) {
                  currentClient = { name: trimmed, amount: '$0.00', details: '' };
                  clients.push(currentClient);
                }
              }
              // Capture lobbying details
              if (currentClient && trimmed.length > 20 &&
                  (trimmed.toLowerCase().includes('lobby') ||
                   trimmed.toLowerCase().includes('legislation') ||
                   trimmed.toLowerCase().includes('matters related') ||
                   trimmed.toLowerCase().includes('advocacy'))) {
                currentClient.details = trimmed;
              }
            }
          }

          // Parse total salaries
          const salaryMatch = text.match(/Total salaries paid:\s*\$?([\d,.]+)/);
          const totalSalaries = salaryMatch ? salaryMatch[1] : '0';

          // Parse lobbyist names
          const lobbyistSection = text.indexOf('Lobbyist information');
          const lobbyists = [];
          if (lobbyistSection !== -1) {
            const lobbyistText = text.substring(lobbyistSection, clientSection > -1 ? clientSection : undefined);
            const lobbyistLinks = Array.from(document.querySelectorAll('a')).filter(a => {
              const rect = a.getBoundingClientRect();
              return rect.top > 0;
            });
          }

          return {
            address,
            clients: clients.filter(c => c.name.length > 1).slice(0, 50),
            totalSalaries,
          };
        });

        entityDetails.push({
          name: entity.name,
          accountType: entity.accountType,
          address: detail.address,
          clients: detail.clients,
          totalSalaries: parseMoney(detail.totalSalaries),
          totalExpenditure: detail.clients.reduce((sum, c) => sum + parseMoney(c.amount), 0) + parseMoney(detail.totalSalaries),
        });

        await detailPage.close();

        if (i % 20 === 0) {
          console.log(`[ma-lobbying]   Scraped ${i + 1}/${entitiesToScrape.length} entity details`);
        }
        await sleep(DELAY_MS);
      } catch (err) {
        // Skip failed detail pages
        if (i % 20 === 0) {
          console.log(`[ma-lobbying]   Error on entity "${entity.name}": ${err.message}`);
        }
      }
    }

    console.log(`[ma-lobbying] Scraped ${entityDetails.length} entity detail pages`);

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

  // Build categorized lists
  const clients = allRecords.filter(r => r.accountType.toLowerCase() === 'client');
  const lobbyists = allRecords.filter(r => r.accountType.toLowerCase() === 'lobbyist');
  const entities = allRecords.filter(r => r.accountType.toLowerCase().includes('entity'));

  // Sort entity details by expenditure
  entityDetails.sort((a, b) => (b.totalExpenditure || 0) - (a.totalExpenditure || 0));

  // Build top 20 for backward compatibility with existing UI
  const top20 = entityDetails.slice(0, 20).map((r, i) => ({
    rank: i + 1,
    name: r.name,
    totalExpenditure: r.totalExpenditure,
    clients: r.clients.map(c => c.name).join(', '),
    clientCount: r.clients.length,
    focus: r.clients.slice(0, 3).map(c => c.details).filter(Boolean).join('; ').slice(0, 200),
    yearFounded: '',
  }));

  // If scrape failed, preserve previous data
  const existing = await loadExisting();
  let preservedFromCache = false;
  if (allRecords.length === 0 && (existing?.records?.length || existing?.top20?.length)) {
    top20.push(...(existing.top20 || []));
    preservedFromCache = true;
    warnings.push('Scraper returned 0 records — preserving data from previous successful run.');
  }

  // Industry summary from clients
  const industryCounts = {};
  for (const r of allRecords) {
    const type = r.accountType || 'Unknown';
    if (!industryCounts[type]) industryCounts[type] = { count: 0 };
    industryCounts[type].count++;
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    source: 'MA Secretary of State — Lobbyist Public Search',
    sourceUrl: 'https://www.sec.state.ma.us/lobbyistpublicsearch/',
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
    sourceUrl: 'https://www.sec.state.ma.us/lobbyistpublicsearch/',
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
