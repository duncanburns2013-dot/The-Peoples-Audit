#!/usr/bin/env node
/**
 * fetch-ma-disclosures.mjs
 *
 * Pulls the latest Massachusetts bond / debt disclosures from public sources
 * and writes them to public/data/ma-disclosures.json so the React app can
 * render them as a live feed.
 *
 * No external dependencies — uses only Node 20+ built-in fetch and a small
 * regex-based HTML parser. Runs in GitHub Actions on a schedule.
 *
 * Sources, in priority order:
 *   1. EMMA QuickSearch results for Massachusetts (HTML)
 *   2. Mass.gov "Debt Management" organization news/press releases (HTML)
 *   3. Mass.gov "Office of the Treasurer" news (HTML)
 *
 * Design rules:
 *   - NEVER throw. Always write a valid JSON file. Failures are recorded as
 *     warnings inside the output so the React component can show feed health.
 *   - If a source fails, the previous items from disk are preserved so the UI
 *     never goes blank.
 *   - Output is sorted newest first and capped at 30 items.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'data', 'ma-disclosures.json');
const MAX_ITEMS = 30;

const USER_AGENT =
  'ThePeoplesAudit/1.0 (+https://github.com/duncanburns2013-dot/The-Peoples-Audit) civic-transparency-bot';

/* ------------------------------------------------------------------ */
/* Tiny HTML helpers (no cheerio dep)                                  */
/* ------------------------------------------------------------------ */

function stripTags(html) {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function* matchAll(html, regex) {
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const re = new RegExp(regex.source, flags);
  let m;
  while ((m = re.exec(html)) !== null) yield m;
}

function absUrl(href, base) {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function parseLooseDate(s) {
  if (!s) return null;
  const cleaned = String(s).trim();
  // Try ISO first
  const iso = Date.parse(cleaned);
  if (!Number.isNaN(iso)) return new Date(iso).toISOString().slice(0, 10);
  // Try "Month D, YYYY"
  const m = cleaned.match(/([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const d = Date.parse(`${m[1]} ${m[2]}, ${m[3]}`);
    if (!Number.isNaN(d)) return new Date(d).toISOString().slice(0, 10);
  }
  return null;
}

async function fetchText(url, { timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/* ------------------------------------------------------------------ */
/* Source 1: EMMA QuickSearch (Massachusetts)                          */
/* ------------------------------------------------------------------ */

async function fetchEmma() {
  const url =
    'https://emma.msrb.org/QuickSearch/Results?quickSearchText=MASSACHUSETTS';
  const html = await fetchText(url);
  const items = [];

  // EMMA's results page is largely Angular-rendered, but the initial HTML
  // does include any anchors to /Security/Details/{cusip} or
  // /IssuerHomePage/Issuer?id=... that happen to be present. Extract them.
  for (const m of matchAll(
    html,
    /<a[^>]+href="(\/(?:Security\/Details|IssuerHomePage\/Issuer)[^"]+)"[^>]*>([^<]{3,200})<\/a>/gi
  )) {
    const href = absUrl(m[1], 'https://emma.msrb.org');
    const title = stripTags(m[2]);
    if (!href || !title) continue;
    items.push({
      id: `emma:${href}`,
      title,
      issuer: 'Massachusetts (EMMA)',
      type: href.includes('Security/Details')
        ? 'Security Detail'
        : 'Issuer Page',
      date: null,
      url: href,
      summary: 'Direct link from EMMA QuickSearch results.',
      source: 'EMMA',
    });
  }

  return items;
}

/* ------------------------------------------------------------------ */
/* Source 2 & 3: Mass.gov organization news pages                      */
/* ------------------------------------------------------------------ */

async function fetchMassGovOrgNews(orgPath, label) {
  const base = 'https://www.mass.gov';
  const url = `${base}${orgPath}`;
  const html = await fetchText(url);
  const items = [];

  // Mass.gov press release / news cards typically look like:
  //   <a href="/news/..." ...><h3>Title</h3>...<time datetime="2026-04-08">...</time></a>
  // We capture each <a href="/news/..."> ... </a> block and pull title + date.
  const blockRe =
    /<a[^>]+href="(\/(?:news|info-details|service-details)\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const m of matchAll(html, blockRe)) {
    const href = absUrl(m[1], base);
    const inner = m[2];
    if (!href) continue;

    // Title: first heading-ish chunk inside the block
    const titleMatch =
      inner.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i) ||
      inner.match(/>([^<]{10,200})</);
    const title = titleMatch ? stripTags(titleMatch[1]) : null;
    if (!title) continue;

    // Date: <time datetime="..."> or visible text date
    const timeMatch =
      inner.match(/<time[^>]*datetime="([^"]+)"/i) ||
      inner.match(
        /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/
      );
    const date = parseLooseDate(timeMatch ? timeMatch[1] : null);

    // Filter to bond / debt / treasury / financing relevance
    const haystack = `${title}`.toLowerCase();
    const relevant =
      /bond|debt|borrow|treasur|fiscal|disclos|gan|refund|issuance|financing|capital|notes|moody|s&p|fitch|rating/i.test(
        haystack
      );
    if (!relevant) continue;

    items.push({
      id: `massgov:${href}`,
      title,
      issuer: label,
      type: 'News / Disclosure',
      date,
      url: href,
      summary: '',
      source: `mass.gov · ${label}`,
    });
  }

  return items;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function loadExisting() {
  try {
    const raw = await readFile(OUTPUT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.items) ? parsed : null;
  } catch {
    return null;
  }
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = it.id || it.url || it.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function sortByDate(items) {
  return items.slice().sort((a, b) => {
    const da = a.date ? Date.parse(a.date) : 0;
    const db = b.date ? Date.parse(b.date) : 0;
    return db - da;
  });
}

async function main() {
  const warnings = [];
  const sources = [];

  const tryFetch = async (name, fn) => {
    try {
      const items = await fn();
      sources.push({ name, ok: true, count: items.length });
      return items;
    } catch (err) {
      const msg = err?.message || String(err);
      warnings.push(`${name}: ${msg}`);
      sources.push({ name, ok: false, error: msg });
      return [];
    }
  };

  const [emma, debtMgmt, treasurer] = await Promise.all([
    tryFetch('EMMA QuickSearch (MA)', fetchEmma),
    tryFetch('mass.gov · Debt Management', () =>
      fetchMassGovOrgNews('/orgs/debt-management', 'Debt Management')
    ),
    tryFetch('mass.gov · Office of the Treasurer', () =>
      fetchMassGovOrgNews(
        '/orgs/office-of-the-state-treasurer-and-receiver-general',
        'Office of the Treasurer'
      )
    ),
  ]);

  let merged = dedupe([...debtMgmt, ...treasurer, ...emma]);
  merged = sortByDate(merged).slice(0, MAX_ITEMS);

  // If every source failed, preserve previous items so the UI never goes blank.
  const existing = await loadExisting();
  let preservedFromCache = false;
  if (merged.length === 0 && existing?.items?.length) {
    merged = existing.items;
    preservedFromCache = true;
    warnings.push('All live sources returned 0 items — preserving cached items.');
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    preservedFromCache,
    sources,
    warnings,
    count: merged.length,
    items: merged,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  console.log(
    `[ma-disclosures] wrote ${merged.length} items to ${OUTPUT_PATH}`
  );
  if (warnings.length) {
    console.log('[ma-disclosures] warnings:');
    for (const w of warnings) console.log('  - ' + w);
  }
}

main().catch((err) => {
  // Even an unexpected crash should not break CI — write a stub file.
  console.error('[ma-disclosures] fatal:', err);
  const stub = {
    fetchedAt: new Date().toISOString(),
    preservedFromCache: false,
    sources: [],
    warnings: [`fatal: ${err?.message || String(err)}`],
    count: 0,
    items: [],
  };
  mkdir(dirname(OUTPUT_PATH), { recursive: true })
    .then(() => writeFile(OUTPUT_PATH, JSON.stringify(stub, null, 2) + '\n'))
    .finally(() => process.exit(0));
});
