#!/usr/bin/env node
/**
 * fetch-state-contracts.mjs
 *
 * Builds a contract-level rollup of Massachusetts state spending from the
 * CTHRU spending dataset. Each row in the source data is a single payment;
 * we aggregate by `encumbrance_id` (the contract / purchase-order reference
 * the Comptroller uses) to surface where the largest dollar flows are
 * actually directed.
 *
 * COMMBUYS itself does not expose a public API and the procurement portal
 * is JSF-rendered (cookie/CSRF-walled like EMMA), so we derive contract
 * activity from the published spending data instead. The result is a
 * payment-weighted view, not a list of every available statewide contract.
 *
 * Output (public/data/ma-contracts.json):
 *   {
 *     fetchedAt: ISO,
 *     fiscalYear: "2026",
 *     count: number,
 *     sources: [{ name, ok, count }],
 *     warnings: [],
 *     items: [
 *       {
 *         encumbranceId: "(PC) 2023TCIT120622ITDWBM",
 *         encumbranceType: "PC",  // GAE | PC | PO | CT | RPO | …
 *         vendor: "...",
 *         department: "...",
 *         cabinetSecretariat: "...",
 *         appropriation: "...",
 *         objectClass: "...",
 *         totalAmount: 1234567.89,
 *         paymentCount: 42,
 *         firstDate: "2025-07-15",
 *         lastDate:  "2026-04-22"
 *       }, ...
 *     ]
 *   }
 *
 * Same resilience rules as the other fetch scripts: never throws, preserves
 * the prior snapshot if the live query fails.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'data', 'ma-contracts.json');

const SOCRATA_BASE = 'https://cthru.data.socrata.com/resource';
const SPENDING_DATASET = 'pegc-naaa';
const TOP_N = 300;

const CURRENT_FY = (() => {
  const now = new Date();
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
})();

/**
 * Ask the dataset which fiscal year most recently has payments posted.
 *
 * The calendar rolls into a new MA fiscal year on July 1, but the Comptroller
 * does not publish that year's spending for months. Querying CURRENT_FY alone
 * meant that every July this fetcher started returning zero rows, fell into the
 * preserve-cache path, and then republished a frozen snapshot every day — with
 * its original fetchedAt — so the workflow looked healthy while the contracts
 * page served months-old data.
 *
 * Returns a year string, or null if discovery itself fails.
 */
async function discoverLatestPopulatedFY() {
  const rows = await socrataQuery({
    $select: 'budget_fiscal_year, SUM(amount) as total',
    $group: 'budget_fiscal_year',
    $order: 'budget_fiscal_year DESC',
    $limit: 30,
  });
  const populated = (rows || [])
    .filter((r) => r.budget_fiscal_year && Number(r.total) > 0)
    .map((r) => String(r.budget_fiscal_year))
    .sort((a, b) => Number(b) - Number(a));
  return populated[0] || null;
}

const USER_AGENT =
  'ThePeoplesAudit/1.0 (+https://github.com/duncanburns2013-dot/The-Peoples-Audit) civic-transparency-bot';

async function socrataQuery(params, { timeoutMs = 60_000 } = {}) {
  const url = new URL(`${SOCRATA_BASE}/${SPENDING_DATASET}.json`);
  for (const [k, v] of Object.entries(params)) url.searchParams.append(k, v);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 180)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// CTHRU prefixes encumbrance ids with a parenthesized type code, e.g.
//   "(PC) 2023TCIT120622ITDWBM" → type "PC", body "2023TCIT120622ITDWBM"
function splitEncumbrance(raw) {
  if (!raw) return { type: '', id: '' };
  const m = String(raw).match(/^\(([A-Z]+)\)\s*(.+)$/);
  return m ? { type: m[1], id: m[2].trim() } : { type: '', id: String(raw).trim() };
}

async function loadExisting() {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

async function fetchTopContracts(fy) {
  // Aggregate inside Socrata: group by the fields we need, sort by total,
  // limit to TOP_N. One round-trip beats paginating thousands of rows.
  const rows = await socrataQuery({
    $select:
      'encumbrance_id, vendor, department, cabinet_secretariat, ' +
      'appropriation_name, object_class, ' +
      'SUM(amount) as total, COUNT(*) as payment_count, ' +
      'MIN(date) as first_date, MAX(date) as last_date',
    $where: `budget_fiscal_year='${fy}' AND encumbrance_id IS NOT NULL`,
    $group:
      'encumbrance_id, vendor, department, cabinet_secretariat, appropriation_name, object_class',
    $order: 'total DESC',
    $limit: TOP_N,
  });
  return rows;
}

async function main() {
  const sources = [];
  const warnings = [];

  // Target the newest fiscal year that actually has payments, not whichever
  // year the calendar says we are in.
  let fy = String(CURRENT_FY);
  try {
    const discovered = await discoverLatestPopulatedFY();
    if (discovered) {
      if (discovered !== fy) {
        warnings.push(
          `FY${fy} has no payments posted yet; using FY${discovered} (latest populated).`,
        );
      }
      fy = discovered;
      sources.push({ name: 'cthru.spending.fyDiscovery', ok: true, latestPopulatedFY: fy });
    } else {
      warnings.push('FY discovery returned no populated years; falling back to calendar FY.');
      sources.push({ name: 'cthru.spending.fyDiscovery', ok: false, error: 'no populated years' });
    }
  } catch (err) {
    const msg = err?.message || String(err);
    warnings.push(`cthru.spending.fyDiscovery: ${msg}`);
    sources.push({ name: 'cthru.spending.fyDiscovery', ok: false, error: msg });
  }

  let raw = null;
  try {
    raw = await fetchTopContracts(fy);
    // Zero rows is a failure to report, not a success — see the preserve-cache
    // path below, which is the only correct response to it.
    sources.push({
      name: `cthru.spending.contracts.${fy}`,
      ok: raw.length > 0,
      count: raw.length,
      ...(raw.length === 0 ? { empty: true } : {}),
    });
  } catch (err) {
    const msg = err?.message || String(err);
    warnings.push(`cthru.spending.contracts.${fy}: ${msg}`);
    sources.push({ name: `cthru.spending.contracts.${fy}`, ok: false, error: msg });
  }

  if (!raw || raw.length === 0) {
    const existing = await loadExisting();
    if (existing?.items?.length) {
      warnings.push('Live query returned no rows — preserving previous snapshot.');
      const staleSince = existing.fetchedAt || new Date().toISOString();
      const ageDays = Math.floor(
        (Date.now() - new Date(staleSince).getTime()) / 86_400_000,
      );
      const preserved = {
        ...existing,
        fetchedAt: staleSince,
        preservedFromCache: true,
        // Make the freeze legible. Without these the file kept a June date while
        // the workflow committed a "refresh" every morning, so nothing in the
        // repo or the run history showed the data had stopped moving.
        staleSince,
        staleForDays: ageDays,
        lastAttemptedAt: new Date().toISOString(),
        sources,
        warnings,
      };
      await mkdir(dirname(OUTPUT_PATH), { recursive: true });
      await writeFile(OUTPUT_PATH, JSON.stringify(preserved, null, 2) + '\n', 'utf8');
      console.log(`[ma-contracts] preserved previous snapshot (stale ${ageDays}d)`);
      if (process.env.GITHUB_ACTIONS) {
        console.log(
          `::warning::ma-contracts.json is serving a cached snapshot from ${staleSince} (${ageDays} days old) — FY${fy} returned no rows.`,
        );
      }
      return;
    }
  }

  const items = (raw || []).map((r) => {
    const { type, id } = splitEncumbrance(r.encumbrance_id);
    return {
      encumbranceId: r.encumbrance_id || '',
      encumbranceType: type,
      encumbranceBody: id,
      vendor: r.vendor || '',
      department: r.department || '',
      cabinetSecretariat: r.cabinet_secretariat || '',
      appropriation: r.appropriation_name || '',
      objectClass: r.object_class || '',
      totalAmount: Number(r.total) || 0,
      paymentCount: Number(r.payment_count) || 0,
      firstDate: r.first_date ? r.first_date.slice(0, 10) : null,
      lastDate: r.last_date ? r.last_date.slice(0, 10) : null,
    };
  });

  const payload = {
    fetchedAt: new Date().toISOString(),
    fiscalYear: fy,
    note:
      'Top contracts/encumbrances by total payments, derived from CTHRU spending. ' +
      'COMMBUYS does not expose a public API; this is the closest open-data view of ' +
      'where state contract dollars flow.',
    preservedFromCache: false,
    sources,
    warnings,
    count: items.length,
    items,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`[ma-contracts] wrote ${items.length} contract rollups for FY${fy}`);
  if (warnings.length) {
    console.log('[ma-contracts] warnings:');
    for (const w of warnings) console.log('  - ' + w);
  }
}

main().catch((err) => {
  console.error('[ma-contracts] fatal:', err);
  const stub = {
    fetchedAt: new Date().toISOString(),
    fiscalYear: String(CURRENT_FY),
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
