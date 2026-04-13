#!/usr/bin/env node
/**
 * fetch-ma-bond-trades.mjs
 *
 * Pulls the latest Massachusetts bond trade activity from public sources
 * (EMMA QuickSearch, MSRB trade data feeds) and writes them to
 * public/data/ma-bond-trades.json so the React app can render a live snapshot
 * of recent notable trades.
 *
 * No external dependencies — uses only Node 20+ built-in fetch and a small
 * regex-based HTML parser. Runs in GitHub Actions on a schedule.
 *
 * Sources, in priority order:
 *   1. EMMA TradeData search for Massachusetts (HTML-parsed)
 *   2. MSRB public trade activity feeds (if available)
 *
 * Design rules:
 *   - NEVER throw. Always write a valid JSON file. Failures are recorded as
 *     warnings inside the output so the React component can show feed health.
 *   - If a source fails, the previous trades from disk are preserved so the UI
 *     never goes blank.
 *   - Output is sorted newest first and capped at 30 items.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'data', 'ma-bond-trades.json');
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
/* Source 1: EMMA TradeData Search (Massachusetts)                     */
/* ------------------------------------------------------------------ */

async function fetchEmmaTradeData() {
  const url =
    'https://emma.msrb.org/TradeData/Search?searchPhrase=Massachusetts&isAdvancedSearch=false';
  const html = await fetchText(url);
  const trades = [];

  // EMMA's trade data page is largely client-rendered, but the initial HTML
  // may include some trade summary data. We attempt to extract:
  // - issuer names / identifiers
  // - CUSIPs
  // - price, yield, par amounts (if visible in initial page load)
  // - trade dates

  // Look for patterns like:
  // <td>Commonwealth of MA</td> or similar issuer references
  // followed by CUSIP patterns (9-character alphanumeric)
  const issuerMatches = matchAll(html, /(?:issuer|title)[^>]*>([^<]{3,100})</gi);
  const cusipMatches = matchAll(html, /\b([A-Z0-9]{9})\b/g);

  // If we found any trade-related data, parse it
  // Note: If EMMA's page is fully JS-rendered, this may yield nothing.
  // In that case, the fallback preserves cached data.
  for (const m of matchAll(
    html,
    /<tr[^>]*class="[^"]*trade[^"]*"[^>]*>([\s\S]{10,500}?)<\/tr>/gi
  )) {
    const row = m[1];

    // Extract fields from the table row
    const issuerM = row.match(/<td[^>]*>([^<]{3,100})</);
    const cusipM = row.match(/\b([A-Z0-9]{9})\b/);
    const priceM = row.match(/price[^<]*?([0-9.]+)/i);
    const yieldM = row.match(/yield[^<]*?([0-9.]+)/i);
    const parM = row.match(/par[^<]*?([0-9,]+)/i);
    const dateM = row.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/);

    if (!cusipM) continue; // Need a CUSIP to identify a trade

    const issuer = issuerM ? stripTags(issuerM[1]) : 'Unknown Issuer';
    const cusip = cusipM[1];
    const price = priceM ? parseFloat(priceM[1]) : null;
    const yield_ = yieldM ? parseFloat(yieldM[1]) : null;
    const par = parM ? parseInt(parM[1].replace(/,/g, ''), 10) : null;
    const date = dateM ? parseLooseDate(dateM[0]) : null;

    if (price !== null && yield_ !== null) {
      trades.push({
        issuer,
        cusip,
        price,
        yield: yield_,
        par: par || 0,
        tradeDate: date || new Date().toISOString().slice(0, 10),
      });
    }
  }

  return trades;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function loadExisting() {
  try {
    const raw = await readFile(OUTPUT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.trades) ? parsed : null;
  } catch {
    return null;
  }
}

function dedupeTrades(trades) {
  const seen = new Set();
  const out = [];
  for (const t of trades) {
    const key = `${t.cusip}:${t.tradeDate}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function sortByDate(trades) {
  return trades.slice().sort((a, b) => {
    const da = a.tradeDate ? Date.parse(a.tradeDate) : 0;
    const db = b.tradeDate ? Date.parse(b.tradeDate) : 0;
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

  const emmaData = await tryFetch('EMMA TradeData (MA)', fetchEmmaTradeData);

  let merged = dedupeTrades([...emmaData]);
  merged = sortByDate(merged).slice(0, MAX_ITEMS);

  // If every source failed, preserve previous trades so the UI never goes blank.
  const existing = await loadExisting();
  let preservedFromCache = false;
  if (merged.length === 0 && existing?.trades?.length) {
    merged = existing.trades;
    preservedFromCache = true;
    warnings.push('All live sources returned 0 trades — preserving cached trades.');
  }

  const payload = {
    lastRefreshed: new Date().toISOString(),
    source: preservedFromCache
      ? 'Cached snapshot (live fetch failed)'
      : 'Automated snapshot from EMMA / MSRB',
    preservedFromCache,
    sources,
    warnings,
    count: merged.length,
    trades: merged,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  console.log(
    `[ma-bond-trades] wrote ${merged.length} trades to ${OUTPUT_PATH}`
  );
  if (warnings.length) {
    console.log('[ma-bond-trades] warnings:');
    for (const w of warnings) console.log('  - ' + w);
  }
}

main().catch((err) => {
  // Even an unexpected crash should not break CI — write a stub file.
  console.error('[ma-bond-trades] fatal:', err);
  const stub = {
    lastRefreshed: new Date().toISOString(),
    source: 'Error fallback',
    preservedFromCache: false,
    sources: [],
    warnings: [`fatal: ${err?.message || String(err)}`],
    count: 0,
    trades: [],
  };
  mkdir(dirname(OUTPUT_PATH), { recursive: true })
    .then(() => writeFile(OUTPUT_PATH, JSON.stringify(stub, null, 2) + '\n'))
    .finally(() => process.exit(0));
});
