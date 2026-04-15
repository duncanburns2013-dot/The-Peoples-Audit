#!/usr/bin/env node
/**
 * fetch-ma-lobbying.mjs - v7 - BUTTON CLICK + DEBUG
 */

import { chromium } from 'playwright';
import { writeFileSync, existsSync } from 'fs';

const OUTPUT_PATH = './public/data/ma-lobbying.json';
const SOURCE_URL = 'https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx';

async function main() {
  console.log('[ma-lobbying] Starting MA Lobbyist scraper (v7 - button click + debug)...');

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
    });
    const page = await context.newPage();

    console.log('[ma-lobbying] Navigating to Lobbyist Public Search...');
    await page.goto(SOURCE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    const htmlLength = (await page.content()).length;
    console.log(`[ma-lobbying] Page loaded: ${htmlLength} bytes`);

    const hasViewstate = await page.evaluate(() => !!document.querySelector('input[name="__VIEWSTATE"]'));
    const hasSearchBtn = await page.evaluate(() => !!document.querySelector('#ContentPlaceHolder1_btnSearch'));
    console.log(`[ma-lobbying] VIEWSTATE=${hasViewstate}, SearchButton=${hasSearchBtn}`);

    // ====================== SUBMIT SEARCH WITH REAL BUTTON CLICK ======================
    console.log('[ma-lobbying] Clicking Search button...');
    await page.click('#ContentPlaceHolder1_btnSearch');

    // Wait for ASPX postback
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
      console.log('[ma-lobbying] networkidle timeout (normal for ASPX)');
    });
    await page.waitForTimeout(5000);

    const resultsLength = (await page.content()).length;
    const title = await page.title();
    console.log(`[ma-lobbying] Results page loaded: ${resultsLength} bytes`);
    console.log(`[ma-lobbying] Page title after search: "${title}"`);

    // Debug: show first 600 chars so we can see if it's an error page
    const snippet = (await page.content()).substring(0, 600);
    console.log(`[ma-lobbying] HTML snippet: ${snippet}...`);

    // ====================== PARSE RESULTS ======================
    console.log('[ma-lobbying] Parsing results table...');
    const records = await page.evaluate(() => {
      const table = document.querySelector('#ContentPlaceHolder1_ucSearchResultByTypeAndCategory_grdvSearchResultByTypeAndCategory');
      if (!table) {
        console.log('[ma-lobbying] Results table NOT found');
        return [];
      }

      const rows = table.querySelectorAll('tr.GridItem, tr.AlternatingGridItem');
      console.log(`[ma-lobbying] Found ${rows.length} GridItem rows`);

      return Array.from(rows).map(row => {
        const cells = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
        return {
          client: cells[0] || '',
          lobbyist: cells[1] || '',
          address: cells[2] || '',
          registration: cells[3] || '',
          detailsUrl: row.querySelector('a') ? row.querySelector('a').href : '',
          raw: cells.join(' | ')
        };
      });
    });

    console.log(`[ma-lobbying] Collected ${records.length} total records`);

    const output = {
      fetchedAt: new Date().toISOString(),
      source: "MA Secretary of State — Lobbyist Public Search",
      sourceUrl: SOURCE_URL,
      scrapedSuccessfully: records.length > 0,
      records: records,
      totalRecords: records.length
    };

    writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
    console.log(`[ma-lobbying] Wrote ${records.length} records to ${OUTPUT_PATH}`);

    if (records.length === 0) {
      console.warn('[ma-lobbying] WARNING: 0 records — preserving previous data');
    }

  } catch (err) {
    console.error('[ma-lobbying] Scraping error:', err.message);
    if (existsSync(OUTPUT_PATH)) {
      console.log('[ma-lobbying] Preserving data from previous successful run.');
    }
  } finally {
    if (browser) await browser.close();
  }
}

main().catch(console.error);
