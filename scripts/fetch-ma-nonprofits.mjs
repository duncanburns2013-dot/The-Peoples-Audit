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

/**
 * ProPublica caps pagination at ~10,000 results per query.
 * MA has ~40,000+ nonprofits, so a single query misses most small orgs.
 *
 * Strategy: Query each NTEE category (1–10) separately, plus a no-NTEE
 * catch-all. Each bucket gets its own 10K cap → up to 110K total coverage.
 * Deduplicate by EIN at the end.
 */
const NTEE_CATEGORIES = [
  { id: 1,  label: 'Arts, Culture & Humanities' },
  { id: 2,  label: 'Education' },
  { id: 3,  label: 'Environment & Animals' },
  { id: 4,  label: 'Health' },
  { id: 5,  label: 'Human Services' },
  { id: 6,  label: 'International' },
  { id: 7,  label: 'Public, Societal Benefit' },
  { id: 8,  label: 'Religion' },
  { id: 9,  label: 'Mutual/Membership Benefit' },
  { id: 10, label: 'Unknown/Unclassified' },
];

async function fetchCategoryPage(nteeId, page) {
  const nteeParam = nteeId ? `&ntee%5Bid%5D=${nteeId}` : '';
  const url = `${API_BASE}/search.json?state%5Bid%5D=MA${nteeParam}&page=${page}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ThePeoplesAudit/1.0 (transparency project)' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function extractOrg(org) {
  return {
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
  };
}

async function fetchAllMANonprofits() {
  const seenEins = new Set();
  const allOrgs = [];
  let grandTotal = 0;

  // Queries: each NTEE category (1-10) + one catch-all (no NTEE filter)
  const queries = [
    ...NTEE_CATEGORIES.map((c) => ({ nteeId: c.id, label: c.label })),
    { nteeId: null, label: 'No NTEE filter (catch-all)' },
  ];

  console.log(`[ma-nonprofits] Starting ProPublica API fetch across ${queries.length} category queries...`);

  for (const query of queries) {
    let page = 0;
    let categoryTotal = 0;
    let numPages = null;

    console.log(`[ma-nonprofits] --- Category: ${query.label} ---`);

    while (page < MAX_PAGES) {
      try {
        const data = await fetchCategoryPage(query.nteeId, page);

        if (numPages === null) {
          numPages = data.num_pages || 0;
          categoryTotal = data.total_results || 0;
          grandTotal += categoryTotal;
          console.log(`[ma-nonprofits]   ${categoryTotal} orgs across ${numPages} pages`);
        }

        const orgs = data.organizations || [];
        if (orgs.length === 0) break;

        let newInBatch = 0;
        for (const org of orgs) {
          const ein = String(org.ein || '');
          if (ein && !seenEins.has(ein)) {
            seenEins.add(ein);
            allOrgs.push(extractOrg(org));
            newInBatch++;
          }
        }

        // Progress every 100 pages
        if (page % 100 === 0 && page > 0) {
          console.log(`[ma-nonprofits]   Page ${page}/${numPages} — ${allOrgs.length} unique orgs so far`);
        }

        if (page >= numPages - 1) break;

        page++;
        await sleep(DELAY_MS);
      } catch (err) {
        console.error(`[ma-nonprofits]   Error on page ${page}: ${err.message}`);
        if (page > 0) break; // had some data, move to next category
        await sleep(2000);
        page++;
      }
    }

    console.log(`[ma-nonprofits]   Done — ${allOrgs.length} unique orgs total`);
  }

  console.log(`[ma-nonprofits] Fetched ${allOrgs.length} unique organizations (API reported ~${grandTotal} total across categories).`);
  return { orgs: allOrgs, totalFromApi: grandTotal };
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
