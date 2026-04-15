#!/usr/bin/env node
/**
 * fetch-ma-lobbying.mjs - FINAL FIXED VERSION
 * Uses Playwright + native ASPX __doPostBack to scrape all lobbyist records
 * Outputs to public/data/ma-lobbying.json exactly like before
 */

import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'fs';

const OUTPUT_PATH = './public/data/ma-lobbying.json';
const SOURCE_URL = 'https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx';

async function main() {
  console.log('[ma-lobbying] Starting MA Lobbyist scraper (v5 - ASPX fixed)...');

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
    });
    const page = await context.newPage();

    // ====================== NAVIGATE ======================
    console.log('[ma-lobbying] Navigating to Lobbyist Public Search...');
    await page.goto(SOURCE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000); // ASPX needs time for scripts

    const htmlLength = (await page.content()).length;
    console.log(`[ma-lobbying] Page loaded: ${htmlLength} bytes`);

    const hasViewstate = await page.evaluate(() => !!document.querySelector('input[name="__VIEWSTATE"]'));
    const hasSearchBtn = await page.evaluate(() => !!document.querySelector('#ContentPlaceHolder1_btnSearch, input[name$="btnSearch"]'));
    console.log(`[ma-lobbying] VIEWSTATE=${hasViewstate}, SearchButton=${hasSearchBtn}`);

    // ====================== SET "VIEW ALL RESULTS" ======================
    console.log('[ma-lobbying] Setting page size to "View all results"...');
    await page.evaluate(() => {
      const select = document.querySelector('#ContentPlaceHolder1_drpPageSize');
      if (!select) return;
      const allOption = Array.from(select.options).find(opt =>
        opt.text.includes('View all') || parseInt(opt.value) >= 1000
      );
      if (allOption) {
        select.value = allOption.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // ====================== SUBMIT SEARCH VIA NATIVE POSTBACK ======================
    console.log('[ma-lobbying] Submitting search via __doPostBack...');
    await page.evaluate(() => {
      if (typeof __doPostBack === 'function') {
        __doPostBack('ctl00$ContentPlaceHolder1$btnSearch', '');
      } else {
        // fallback
        const form = document.querySelector('form');
        if (form) form.submit();
      }
    });

    // Wait for the postback to finish
    await page.waitForTimeout(10000);
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {
      console.log('[ma-lobbying] networkidle timeout (normal for ASPX)');
    });

    const resultsHtmlLength = (await page.content()).length;
    console.log(`[ma-lobbying] Results page loaded: ${resultsHtmlLength} bytes`);

    // ====================== PARSE RESULTS TABLE ======================
    console.log('[ma-lobbying] Parsing results table...');
    const records = await page.evaluate(() => {
      const table = document.querySelector('#ContentPlaceHolder1_ucSearchResultByTypeAndCategory_grdvSearchResultByTypeAndCategory');
      if (!table) return [];

      const rows = table.querySelectorAll('tr.GridItem, tr.AlternatingGridItem');
      console.log(`[ma-lobbying] Found ${rows.length} GridItem rows`);

      return Array.from(rows).map(row => {
        const cells = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
        // Column order based on your earlier HTML paste + typical layout
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

    // ====================== WRITE OUTPUT ======================
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
    // Preserve old data on failure (same as your original script)
    if (existsSync(OUTPUT_PATH)) {
      console.log('[ma-lobbying] Preserving data from previous successful run.');
    }
  } finally {
    if (browser) await browser.close();
  }
}

main().catch(console.error);
