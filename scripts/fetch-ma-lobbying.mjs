#!/usr/bin/env node
/**
 * fetch-ma-lobbying.mjs
 *
 * Scrapes the MA Secretary of State Lobbyist Public Search
 * (https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx) using Playwright
 * and writes results to public/data/ma-lobbying.json.
 *
 * The SOS site is an ASP.NET WebForms app with UpdatePanels.
 * 
 * KEY ELEMENT IDS (from page source):
 *   Search button:  #ContentPlaceHolder1_btnSearch
 *   Page size:      #ContentPlaceHolder1_drpPageSize
 *   Year dropdown:  #ContentPlaceHolder1_ucSearchCriteriaByType_ddlYear
 *   Type dropdown:  #ContentPlaceHolder1_ucSearchCriteriaByType_drpType
 *   Results table:  #ContentPlaceHolder1_ucSearchResultByTypeAndCategory_grdvSearchResultByTypeAndCategory
 *   Account type:   span[id*="lblUserType"]
 *   Name links:     a[id*="hplDisplayName"]
 *   Pagination:     __doPostBack('ctl00$ContentPlaceHolder1$ucSearchResultByTypeAndCategory$grdvSearchResultByTypeAndCategory','Page$N')
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

// ---- ASPX Element IDs (discovered from page source) ----
const SELECTORS = {
  searchBtn:    '#ContentPlaceHolder1_btnSearch',
  pageSizeDdl:  '#ContentPlaceHolder1_drpPageSize',
  yearDdl:      '#ContentPlaceHolder1_ucSearchCriteriaByType_ddlYear',
  typeDdl:      '#ContentPlaceHolder1_ucSearchCriteriaByType_drpType',
  resultsTable: '#ContentPlaceHolder1_ucSearchResultByTypeAndCategory_grdvSearchResultByTypeAndCategory',
  resultRows:   '#ContentPlaceHolder1_ucSearchResultByTypeAndCategory_grdvSearchResultByTypeAndCategory tr.GridItem',
  typeSpans:    'span[id*="lblUserType"]',
  nameLinks:    'a[id*="hplDisplayName"]',
};

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
    await page.goto('https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // ---- Step 2: Configure search and submit ----
    // Set "View all results" (value 20000) to avoid pagination entirely
    const pageSizeDdl = await page.$(SELECTORS.pageSizeDdl);
    if (pageSizeDdl) {
      await pageSizeDdl.selectOption('20000');
      console.log('[ma-lobbying] Set "View all results" page size');
      // Wait for any ASPX postback triggered by the dropdown change
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);
    } else {
      console.log('[ma-lobbying] WARNING: Could not find page size dropdown');
    }

    // Ensure type = ALL (value "Z") — should be default but be safe
    const typeDdl = await page.$(SELECTORS.typeDdl);
    if (typeDdl) {
      await typeDdl.selectOption('Z');
      console.log('[ma-lobbying] Set type = ALL');
    }

    // Click Search button by its specific ASPX ID
    console.log('[ma-lobbying] Submitting search for all records...');
    const searchBtn = await page.$(SELECTORS.searchBtn);
    if (searchBtn) {
      await searchBtn.click();
      console.log('[ma-lobbying] Clicked search button, waiting for results...');
      // Wait for the results table to appear
      await page.waitForSelector(SELECTORS.resultsTable, { timeout: 60000 }).catch(() => {
        console.log('[ma-lobbying] WARNING: Results table not found after search click');
      });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);
    } else {
      console.log('[ma-lobbying] WARNING: Could not find search button — trying to parse existing results');
    }

    // ---- Step 3: Parse results table (all pages) ----
    let pageNum = 1;
    let hasMore = true;

    while (hasMore) {
      console.log(`[ma-lobbying] Parsing results page ${pageNum}...`);

      // Target the SPECIFIC results table by its ASPX ID, only GridItem rows
      const rows = await page.$$eval(
        `${SELECTORS.resultsTable} tr.GridItem`,
        (trs) => trs.map(tr => {
          const cells = tr.querySelectorAll('td');
          if (cells.length < 2) return null;

          // Account type is in a <span> with id containing "lblUserType"
          const typeSpan = cells[0]?.querySelector('span[id*="lblUserType"]');
          const type = typeSpan?.textContent?.trim() || cells[0]?.textContent?.trim() || '';

          // Name is in an <a> with id containing "hplDisplayName"
          const nameLink = cells[1]?.querySelector('a[id*="hplDisplayName"]');
          const name = nameLink?.textContent?.trim() || cells[1]?.textContent?.trim() || '';
          const href = nameLink?.href || '';

          return { type, name, href };
        }).filter(Boolean)
      ).catch(() => []);

      // If the specific GridItem selector didn't work, try fallback
      let dataRows = rows.filter(r => r.name && r.name.length > 1);

      if (dataRows.length === 0 && pageNum === 1) {
        console.log('[ma-lobbying] No GridItem rows found, trying fallback selectors...');
        
        // Fallback: try any tr in the results table with 2+ td cells
        const fallbackRows = await page.$$eval(
          `${SELECTORS.resultsTable} tr`,
          (trs) => trs.map(tr => {
            const cells = tr.querySelectorAll('td');
            if (cells.length < 2) return null;
            const type = cells[0]?.textContent?.trim() || '';
            const nameEl = cells[1]?.querySelector('a') || cells[1];
            const name = nameEl?.textContent?.trim() || '';
            const href = cells[1]?.querySelector('a')?.href || '';
            return { type, name, href };
          }).filter(Boolean)
        ).catch(() => []);

        dataRows = fallbackRows.filter(r =>
          r.name &&
          r.name.length > 1 &&
          !r.name.toLowerCase().includes('account type') &&
          !r.type.toLowerCase().includes('account')
        );

        if (dataRows.length === 0) {
          // Last resort: check if the table even exists
          const tableExists = await page.$(SELECTORS.resultsTable);
          console.log(`[ma-lobbying] Results table exists: ${!!tableExists}`);
          
          // Log what we can see for debugging
          const pageTitle = await page.title();
          const bodyText = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => 'N/A');
          console.log(`[ma-lobbying] Page title: ${pageTitle}`);
          console.log(`[ma-lobbying] Page preview: ${bodyText.substring(0, 300)}`);
          break;
        }
      }

      for (const row of dataRows) {
        allRecords.push({
          accountType: row.type,
          name: row.name,
          detailUrl: row.href,
        });
      }

      console.log(`[ma-lobbying]   Page ${pageNum}: ${dataRows.length} records (${allRecords.length} total)`);

      // Check for next page — ASPX uses __doPostBack for pagination, not simple links
      // The pagination row has <td> elements with page numbers as links
      const nextPageNum = pageNum + 1;
      const nextPageLink = await page.$(`${SELECTORS.resultsTable} tr:last-child a`);
      
      // Check if there's a link for the next page number or "..."
      const hasNextPage = await page.evaluate((tableSelector, nextNum) => {
        const table = document.querySelector(tableSelector);
        if (!table) return false;
        const lastRow = table.querySelector('tr:last-child');
        if (!lastRow) return false;
        const links = lastRow.querySelectorAll('a');
        for (const link of links) {
          const text = link.textContent.trim();
          if (text === String(nextNum) || text === '...') return true;
        }
        return false;
      }, SELECTORS.resultsTable, nextPageNum).catch(() => false);

      if (hasNextPage && dataRows.length > 0) {
        // Click the next page number using __doPostBack
        const clicked = await page.evaluate((tableSelector, nextNum) => {
          const table = document.querySelector(tableSelector);
          if (!table) return false;
          const lastRow = table.querySelector('tr:last-child');
          if (!lastRow) return false;
          const links = lastRow.querySelectorAll('a');
          for (const link of links) {
            if (link.textContent.trim() === String(nextNum)) {
              link.click();
              return true;
            }
          }
          // Try "..." link if exact page not found
          for (const link of links) {
            if (link.textContent.trim() === '...') {
              link.click();
              return true;
            }
          }
          return false;
        }, SELECTORS.resultsTable, nextPageNum).catch(() => false);

        if (clicked) {
          await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
          await page.waitForTimeout(1500);
          pageNum++;
        } else {
          hasMore = false;
        }
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
            const afterClient = text.substring(clientSection);
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
                if (!trimmed.includes('lobbyist') &&
                    !trimmed.includes('Total salaries') &&
                    !trimmed.includes('Lobbyist info')) {
                  currentClient = { name: trimmed, amount: '$0.00', details: '' };
                  clients.push(currentClient);
                }
              }
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

  // Industry summary from account types
  const industryCounts = {};
  for (const r of allRecords) {
    const type = r.accountType || 'Unknown';
    if (!industryCounts[type]) industryCounts[type] = { count: 0 };
    industryCounts[type].count++;
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    source: 'MA Secretary of State — Lobbyist Public Search',
    sourceUrl: 'https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx',
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
    sourceUrl: 'https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx',
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
