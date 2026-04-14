#!/usr/bin/env node
/**
 * fetch-ma-nonprofits.mjs
 *
 * Fetches Massachusetts nonprofits from the ProPublica Nonprofit Explorer API
 * (https://projects.propublica.org/nonprofits/api) and writes a searchable
 * index to public/data/ma-nonprofits.json.
 *
 * The ProPublica API has no CORS headers for third-party origins, so the
 * browser-side fetch in NonprofitLookup.jsx fails silently. This script
 * runs server-side (in GitHub Actions) where there are no CORS restrictions,
 * pre-building a local index the frontend can search instantly.
 *
 * Design rules (matching existing scrapers):
 *   - NEVER throw. Always write a valid JSON file.
 *   - If fetching fails, preserve previous cached data so the UI never blanks.
 *   - Respects ProPublica's API with rate limiting between requests.
 *
 * Runs monthly via GitHub Actions (fetch-nonprofits.yml).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'data', 'ma-nonprofits.json');

const API_BASE = 'https://projects.propublica.org/nonprofits/api/v2';
const DELAY_MS = 350;          // delay between API calls (be respectful)
const MAX_PAGES = 1800;        // safety cap (~45,000 orgs at 25/page)
const RESULTS_PER_PAGE = 25;   // ProPublica default

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

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
/* ProPublica API fetcher                                               */
/* ------------------------------------------------------------------ */

async function fetchAllMANonprofits() {
  const allOrgs = [];
  let page = 0;
  let totalResults = null;

  console.log('[ma-nonprofits] Starting ProPublica API fetch for MA nonprofits...');

  while (page < MAX_PAGES) {
    try {
      const url = `${API_BASE}/search.json?state%5Bid%5D=MA&page=${page}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'ThePeoplesAudit/1.0 (transparency project)' },
      });

      if (!response.ok) {
        console.warn(`[ma-nonprofits] API returned ${response.status} on page ${page}, stopping.`);
        break;
      }

      const data = await response.json();

      if (totalResults === null) {
        totalResults = data.total_results || 0;
        console.log(`[ma-nonprofits] API reports ${totalResults} total MA nonprofits (${data.num_pages} pages)`);
      }

      const orgs = data.organizations || [];
      if (orgs.length === 0) {
        console.log(`[ma-nonprofits] Empty page at ${page}, done.`);
        break;
      }

      // Extract only the fields we need for search (keeps file size down)
      for (const org of orgs) {
        allOrgs.push({
          name: org.name || '',
          ein: String(org.ein || ''),
          strein: org.strein || '',
          city: org.city || '',
          state: org.state || 'MA',
          zipcode: org.zipcode || '',
          ntee_code: org.ntee_code || '',
          subseccd: org.subseccd ?? null,
          income_amount: org.income_amount ?? null,
          asset_amount: org.asset_amount ?? null,
        });
      }

      // Progress logging every 50 pages
      if (page % 50 === 0 || page < 3) {
        console.log(`[ma-nonprofits] Page ${page}/${data.num_pages || '?'} — ${allOrgs.length} orgs collected`);
      }

      // Stop if we've gone past the last page
      if (page >= (data.num_pages || 0) - 1) {
        console.log(`[ma-nonprofits] Reached last page (${page}).`);
        break;
      }

      page++;
      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`[ma-nonprofits] Error on page ${page}: ${err.message}`);
      // If we already have substantial data, stop gracefully
      if (allOrgs.length > 100) {
        console.log(`[ma-nonprofits] Stopping with ${allOrgs.length} orgs after error.`);
        break;
      }
      // Otherwise retry once after a longer pause
      await sleep(2000);
      page++;
    }
  }

  console.log(`[ma-nonprofits] Fetched ${allOrgs.length} total organizations.`);
  return { orgs: allOrgs, totalFromApi: totalResults };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  const warnings = [];
  let orgs = [];
  let fetchedSuccessfully = false;
  let totalFromApi = null;

  try {
    const result = await fetchAllMANonprofits();
    orgs = result.orgs;
    totalFromApi = result.totalFromApi;

    if (orgs.length > 0) {
      fetchedSuccessfully = true;
    } else {
      warnings.push('API returned 0 organizations — ProPublica may be down or API changed');
    }
  } catch (err) {
    warnings.push(`Fetch failed: ${err?.message || String(err)}`);
  }

  // If fetch failed, preserve previous data
  const existing = await loadExisting();
  let preservedFromCache = false;
  if (orgs.length === 0 && existing?.organizations?.length) {
    orgs = existing.organizations;
    preservedFromCache = true;
    warnings.push('Fetch returned 0 orgs — preserving data from previous successful run.');
    console.log(`[ma-nonprofits] Preserved ${orgs.length} cached orgs.`);
  }

  // Compute stats for the KPI display
  const totalRevenue = orgs.reduce((sum, o) => sum + (o.income_amount || 0), 0);
  const cities = new Set(orgs.map((o) => o.city).filter(Boolean));
  const nteeCounts = {};
  for (const o of orgs) {
    const major = (o.ntee_code || '').charAt(0) || '?';
    nteeCounts[major] = (nteeCounts[major] || 0) + 1;
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    source: 'ProPublica Nonprofit Explorer API',
    sourceUrl: 'https://projects.propublica.org/nonprofits/api',
    dataOrigin: 'IRS Form 990 filings via ProPublica',
    fetchedSuccessfully,
    preservedFromCache,
    warnings,
    stats: {
      totalOrganizations: orgs.length,
      totalFromApi,
      totalRevenue,
      uniqueCities: cities.size,
      topNteeGroups: Object.entries(nteeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([code, count]) => ({ code, count })),
    },
    organizations: orgs,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  const fileSizeMB = (Buffer.byteLength(JSON.stringify(payload)) / 1024 / 1024).toFixed(1);
  console.log(`[ma-nonprofits] Wrote ${orgs.length} orgs to ${OUTPUT_PATH} (${fileSizeMB} MB)`);
  if (warnings.length) {
    console.log('[ma-nonprofits] Warnings:');
    for (const w of warnings) console.log('  - ' + w);
  }
}

main().catch(async (err) => {
  console.error('[ma-nonprofits] Fatal:', err);
  // Preserve existing data so the site never blanks
  const existing = await loadExisting().catch(() => null);
  if (existing?.organizations?.length) {
    existing.warnings = [`fatal: ${err?.message || String(err)} — preserving previous data`];
    existing.fetchedSuccessfully = false;
    existing.preservedFromCache = true;
    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, JSON.stringify(existing, null, 2) + '\n');
    console.log('[ma-nonprofits] Preserved existing data after fatal error');
    return;
  }
  const stub = {
    fetchedAt: new Date().toISOString(),
    source: 'ProPublica Nonprofit Explorer API',
    sourceUrl: 'https://projects.propublica.org/nonprofits/api',
    fetchedSuccessfully: false,
    preservedFromCache: false,
    warnings: [`fatal: ${err?.message || String(err)}`],
    stats: { totalOrganizations: 0 },
    organizations: [],
  };
  mkdir(dirname(OUTPUT_PATH), { recursive: true })
    .then(() => writeFile(OUTPUT_PATH, JSON.stringify(stub, null, 2) + '\n'))
    .finally(() => process.exit(0));
});
