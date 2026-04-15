#!/usr/bin/env node
/**
 * fetch-ma-lobbying.mjs  (v3 — direct HTTP, no Playwright)
 *
 * Scrapes the MA Secretary of State Lobbyist Public Search using plain
 * HTTP GET/POST instead of a headless browser.  ASP.NET WebForms pages
 * work via form POSTs with hidden __VIEWSTATE / __EVENTVALIDATION tokens.
 *
 * Flow:
 *   1. GET the search page → extract __VIEWSTATE, __EVENTVALIDATION
 *   2. POST the form with search params → get results HTML
 *   3. Parse results with regex (no DOM needed)
 *   4. Paginate if needed (POST with __doPostBack page commands)
 *   5. Optionally fetch detail pages for Lobbyist Entities
 *
 * Runs weekly via GitHub Actions (update-lobbying.yml).
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

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
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

/** Extract a hidden field value from HTML */
function extractField(html, fieldName) {
  const idPattern = new RegExp(`id="${fieldName}"[^>]*value="([^"]*)"`, 'i');
  const idMatch = html.match(idPattern);
  if (idMatch) return idMatch[1];

  const namePattern = new RegExp(`name="${fieldName}"[^>]*value="([^"]*)"`, 'i');
  const nameMatch = html.match(namePattern);
  if (nameMatch) return nameMatch[1];

  return '';
}

/** Parse the results table rows from HTML */
function parseResultsFromHtml(html) {
  const records = [];

  // Match GridItem rows — each has a type span and a name link
  const rowPattern = /<tr\s+class="GridItem">\s*<td>\s*(?:<\/?[^>]+>\s*)*(\w[\w\s]*?)(?:<\/?[^>]+>\s*)*<\/td>\s*<td>\s*(?:<\/?[^>]+>\s*)*<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;

  let match;
  while ((match = rowPattern.exec(html)) !== null) {
    const accountType = cleanText(match[1]);
    const href = match[2];
    const name = cleanText(match[3]);

    if (name && name.length > 1) {
      const detailUrl = href.startsWith('http') ? href : `${BASE_URL}/${href}`;
      records.push({ accountType, name, detailUrl });
    }
  }

  // If strict pattern didn't work, try a more lenient approach
  if (records.length === 0) {
    const lenientPattern = /<tr[^>]*class="GridItem"[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = lenientPattern.exec(html)) !== null) {
      const rowHtml = rowMatch[1];

      // Extract type from span with lblUserType
      const typeMatch = rowHtml.match(/id="[^"]*lblUserType[^"]*"[^>]*>([^<]*)</i);
      const type = typeMatch ? cleanText(typeMatch[1]) : '';

      // Extract name and href from link with hplDisplayName
      const linkMatch = rowHtml.match(/id="[^"]*hplDisplayName[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]*)</i);
      const href = linkMatch ? linkMatch[1] : '';
      const name = linkMatch ? cleanText(linkMatch[2]) : '';

      if (name && name.length > 1) {
        const detailUrl = href.startsWith('http') ? href : href ? `${BASE_URL}/${href}` : '';
        records.push({ accountType: type, name, detailUrl });
      }
    }
  }

  return records;
}

/** Check for next page pagination link */
function findNextPagePostback(html, currentPage) {
  const nextPage = currentPage + 1;
  const pagePattern = new RegExp(
    `__doPostBack\\('([^']*grdvSearchResult[^']*)'\\s*,\\s*'Page\\$${nextPage}'\\)`,
    'i'
  );
  const match = html.match(pagePattern);
  if (match) {
    return { eventTarget: match[1].replace(/\\'/g, "'"), eventArgument: `Page$${nextPage}` };
  }

  // Check for "..." continuation
  const dotsPattern = /__doPostBack\('([^']*grdvSearchResult[^']*)'\s*,\s*'Page\$(\d+)'\)[^>]*>\.\.\.</gi;
  const dotsMatch = html.match(dotsPattern);
  if (dotsMatch) {
    const innerMatch = dotsMatch[0].match(/__doPostBack\('([^']*)'\s*,\s*'Page\$(\d+)'\)/);
    if (innerMatch) {
      return { eventTarget: innerMatch[1], eventArgument: `Page$${innerMatch[2]}` };
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* HTTP-based scraper                                                   */
/* ------------------------------------------------------------------ */

async function scrapeLobbyists() {
  const allRecords = [];
  const entityDetails = [];

  try {
    // ---- Step 1: GET the search page to extract ASPX tokens ----
    console.log('[ma-lobbying] Fetching search page...');
    const getResp = await fetch(SEARCH_URL, { headers: HEADERS, redirect: 'follow' });
    if (!getResp.ok) {
      console.log(`[ma-lobbying] GET failed: ${getResp.status} ${getResp.statusText}`);
      return { allRecords, entityDetails };
    }

    let html = await getResp.text();
    console.log(`[ma-lobbying] Got ${html.length} bytes of HTML`);

    const viewState = extractField(html, '__VIEWSTATE');
    const viewStateGen = extractField(html, '__VIEWSTATEGENERATOR');
    const eventValidation = extractField(html, '__EVENTVALIDATION');

    if (!viewState) {
      console.log('[ma-lobbying] ERROR: Could not extract __VIEWSTATE');
      const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || 'N/A';
      console.log(`[ma-lobbying] Page title: ${title}`);
      console.log(`[ma-lobbying] HTML snippet: ${html.substring(0, 500).replace(/\s+/g, ' ')}`);
      return { allRecords, entityDetails };
    }

    console.log(`[ma-lobbying] VIEWSTATE: ${viewState.length} chars | EVENTVALIDATION: ${eventValidation.length} chars`);

    // Capture cookies for session
    const cookies = getResp.headers.getSetCookie?.() || [];
    const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

    // ---- Step 2: POST the search form ----
    console.log('[ma-lobbying] POSTing search (year=2026, type=ALL, pageSize=20000)...');

    const formData = new URLSearchParams();
    formData.append('__EVENTTARGET', '');
    formData.append('__EVENTARGUMENT', '');
    formData.append('__LASTFOCUS', '');
    formData.append('__VIEWSTATE', viewState);
    formData.append('__VIEWSTATEGENERATOR', viewStateGen);
    formData.append('__EVENTVALIDATION', eventValidation);
    formData.append('ctl00$ContentPlaceHolder1$Search', 'rdbSearchByType');
    formData.append('ctl00$ContentPlaceHolder1$ucSearchCriteriaByType$ddlYear', '2026');
    formData.append('ctl00$ContentPlaceHolder1$ucSearchCriteriaByType$txtN_ame', '');
    formData.append('ctl00$ContentPlaceHolder1$ucSearchCriteriaByType$txtName_Watermark_ClientState', '');
    formData.append('ctl00$ContentPlaceHolder1$ucSearchCriteriaByType$lddSearchType$DropDown', '3');
    formData.append('ctl00$ContentPlaceHolder1$ucSearchCriteriaByType$drpType', 'Z');
    formData.append('ctl00$ContentPlaceHolder1$drpPageSize', '20000');
    formData.append('ctl00$ContentPlaceHolder1$btnSearch', 'Search');

    const postHeaders = {
      ...HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://www.sec.state.ma.us',
      'Referer': SEARCH_URL,
    };
    if (cookieHeader) postHeaders['Cookie'] = cookieHeader;

    const postResp = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: postHeaders,
      body: formData.toString(),
      redirect: 'follow',
    });

    if (!postResp.ok) {
      console.log(`[ma-lobbying] POST failed: ${postResp.status} ${postResp.statusText}`);
      return { allRecords, entityDetails };
    }

    html = await postResp.text();
    console.log(`[ma-lobbying] Got ${html.length} bytes of search results`);

    // Update cookies
    const postCookies = postResp.headers.getSetCookie?.() || [];
    const allCookies = [...cookies, ...postCookies].map(c => c.split(';')[0]).join('; ');

    // ---- Step 3: Parse results ----
    let pageNum = 1;
    let hasMore = true;

    while (hasMore) {
      console.log(`[ma-lobbying] Parsing page ${pageNum}...`);
      const pageRecords = parseResultsFromHtml(html);

      if (pageRecords.length === 0 && pageNum === 1) {
        console.log('[ma-lobbying] No results found on first page');
        const hasTable = html.includes('grdvSearchResultByTypeAndCategory');
        const hasGridItem = html.includes('GridItem');
        const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || 'N/A';
        console.log(`[ma-lobbying] Debug: table=${hasTable}, GridItem=${hasGridItem}, title="${title}"`);
        console.log(`[ma-lobbying] Debug: HTML length=${html.length}`);
        break;
      }

      allRecords.push(...pageRecords);
      console.log(`[ma-lobbying]   Page ${pageNum}: ${pageRecords.length} records (${allRecords.length} total)`);

      // Check for next page
      const nextPage = findNextPagePostback(html, pageNum);
      if (nextPage && pageRecords.length > 0 && pageNum < 100) {
        const nextVS = extractField(html, '__VIEWSTATE');
        const nextEV = extractField(html, '__EVENTVALIDATION');
        const nextVSG = extractField(html, '__VIEWSTATEGENERATOR');

        const pageForm = new URLSearchParams();
        pageForm.append('__EVENTTARGET', nextPage.eventTarget);
        pageForm.append('__EVENTARGUMENT', nextPage.eventArgument);
        pageForm.append('__LASTFOCUS', '');
        pageForm.append('__VIEWSTATE', nextVS);
        pageForm.append('__VIEWSTATEGENERATOR', nextVSG);
        pageForm.append('__EVENTVALIDATION', nextEV);
        pageForm.append('ctl00$ContentPlaceHolder1$Search', 'rdbSearchByType');
        pageForm.append('ctl00$ContentPlaceHolder1$ucSearchCriteriaByType$ddlYear', '2026');
        pageForm.append('ctl00$ContentPlaceHolder1$ucSearchCriteriaByType$txtN_ame', '');
        pageForm.append('ctl00$ContentPlaceHolder1$ucSearchCriteriaByType$txtName_Watermark_ClientState', '');
        pageForm.append('ctl00$ContentPlaceHolder1$ucSearchCriteriaByType$lddSearchType$DropDown', '3');
        pageForm.append('ctl00$ContentPlaceHolder1$ucSearchCriteriaByType$drpType', 'Z');
        pageForm.append('ctl00$ContentPlaceHolder1$drpPageSize', '20000');

        const pageHeaders = { ...postHeaders };
        if (allCookies) pageHeaders['Cookie'] = allCookies;

        await sleep(1000);
        const pageResp = await fetch(SEARCH_URL, {
          method: 'POST',
          headers: pageHeaders,
          body: pageForm.toString(),
          redirect: 'follow',
        });

        if (pageResp.ok) {
          html = await pageResp.text();
          pageNum++;
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`[ma-lobbying] Collected ${allRecords.length} total records`);

    // ---- Step 4: Scrape detail pages for Lobbyist Entities ----
    const entities = allRecords.filter(r =>
      r.accountType.toLowerCase().includes('entity') && r.detailUrl
    );
    const entitiesToScrape = entities.slice(0, MAX_DETAIL_PAGES);

    console.log(`[ma-lobbying] Fetching detail pages for ${entitiesToScrape.length} lobbyist entities...`);

    for (let i = 0; i < entitiesToScrape.length; i++) {
      const entity = entitiesToScrape[i];
      try {
        const dh = { ...HEADERS, 'Referer': SEARCH_URL };
        if (allCookies) dh['Cookie'] = allCookies;

        const dr = await fetch(entity.detailUrl, { headers: dh, redirect: 'follow' });
        if (!dr.ok) continue;
        const dHtml = await dr.text();

        const addrMatch = dHtml.match(/Address:\s*([^<]+?)(?:<|Registration)/si);
        const address = addrMatch ? cleanText(addrMatch[1]) : '';

        const salaryMatch = dHtml.match(/Total salaries paid:\s*\$?([\d,.]+)/i);
        const totalSalaries = salaryMatch ? salaryMatch[1] : '0';

        const clients = [];
        const clientPattern = /class="BlueLinks"[^>]*href="Summary\.aspx[^"]*"[^>]*>([^<]+)<\/a>/gi;
        const seenClients = new Set();
        let cm;
        while ((cm = clientPattern.exec(dHtml)) !== null) {
          const cn = cleanText(cm[1]);
          if (cn && !seenClients.has(cn) && cn !== entity.name) {
            seenClients.add(cn);
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
      } catch (err) {
        // skip failed detail pages silently
      }
    }

    console.log(`[ma-lobbying] Scraped ${entityDetails.length} entity detail pages`);

  } catch (err) {
    console.error('[ma-lobbying] Scraping error:', err.message);
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
