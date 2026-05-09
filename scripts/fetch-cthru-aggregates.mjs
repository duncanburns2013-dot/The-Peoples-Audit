#!/usr/bin/env node
/**
 * fetch-cthru-aggregates.mjs
 *
 * Pre-aggregates CTHRU (Massachusetts Comptroller transparency) data so the
 * dashboard can render the default views from a single ~50KB JSON snapshot
 * instead of firing eight live Socrata queries on every page load.
 *
 * Output (public/data/cthru-aggregates.json):
 *   {
 *     fetchedAt: ISO,
 *     years: ["2024", "2025", "2026"],
 *     sources: [{ name, ok, count }],
 *     warnings: [],
 *     spendingByDepartment: { "2026": [{ name, value }, ...], ... },
 *     spendingByVendor:     { "2026": [{ name, value }, ...], ... },
 *     spendingOverTime:     [{ year, total }, ...],
 *     payrollByDepartment:  { "2025": [{ name, value }, ...], ... },
 *     topEarners:           { "2025": [{ name, department, title, totalPay }, ...], ... },
 *     payrollOverTime:      [{ year, totalPayroll }, ...],
 *     quasiByAgency:        [{ name, value }, ...]
 *   }
 *
 * Design rules (same as the other fetch scripts):
 *   - Never throw. Each Socrata call is wrapped in tryFetch() that records
 *     ok/error in `sources` rather than blowing up CI.
 *   - On total failure, preserve the previous JSON from disk so the live
 *     site never goes blank.
 *   - Sleeps 800ms between calls to stay under unauthenticated rate limits.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'data', 'cthru-aggregates.json');

const SOCRATA_BASE = 'https://cthru.data.socrata.com/resource';
const DATASETS = {
  spending: 'pegc-naaa',
  payroll: '9ttk-7vz6',
  quasi: 'v9tf-ghmw',
};

// Pull the current FY plus the two prior FYs. The dashboard's default
// views always land on the most recent year and rarely scroll back further.
const CURRENT_FY = (() => {
  // MA fiscal year runs July 1 → June 30; FY26 = Jul 1 2025 → Jun 30 2026.
  const now = new Date();
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
})();
const YEARS = [String(CURRENT_FY - 2), String(CURRENT_FY - 1), String(CURRENT_FY)];

const USER_AGENT =
  'ThePeoplesAudit/1.0 (+https://github.com/duncanburns2013-dot/The-Peoples-Audit) civic-transparency-bot';

async function socrataQuery(datasetId, params, { timeoutMs = 30_000 } = {}) {
  const url = new URL(`${SOCRATA_BASE}/${datasetId}.json`);
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Spending aggregations                                              */
/* ------------------------------------------------------------------ */

async function fetchSpendingByDepartment(fy) {
  const rows = await socrataQuery(DATASETS.spending, {
    $select: 'department, SUM(amount) as total',
    $where: `budget_fiscal_year='${fy}'`,
    $group: 'department',
    $order: 'total DESC',
    $limit: 50,
  });
  return rows.map((r) => ({
    name: r.department || 'Unknown',
    value: Number(r.total) || 0,
  }));
}

async function fetchSpendingByVendor(fy) {
  const rows = await socrataQuery(DATASETS.spending, {
    $select: 'vendor, SUM(amount) as total',
    $where: `budget_fiscal_year='${fy}'`,
    $group: 'vendor',
    $order: 'total DESC',
    $limit: 50,
  });
  return rows.map((r) => ({
    name: r.vendor || 'Unknown',
    value: Number(r.total) || 0,
  }));
}

async function fetchSpendingOverTime() {
  const rows = await socrataQuery(DATASETS.spending, {
    $select: 'budget_fiscal_year, SUM(amount) as total',
    $group: 'budget_fiscal_year',
    $order: 'budget_fiscal_year ASC',
    $limit: 30,
  });
  return rows.map((r) => ({
    year: r.budget_fiscal_year,
    total: Number(r.total) || 0,
  }));
}

/* ------------------------------------------------------------------ */
/* Payroll aggregations                                               */
/* ------------------------------------------------------------------ */

async function fetchPayrollByDepartment(year) {
  const rows = await socrataQuery(DATASETS.payroll, {
    $select:
      'department_division, SUM(pay_total_actual) as total, COUNT(*) as employees',
    $where: `year='${year}'`,
    $group: 'department_division',
    $order: 'total DESC',
    $limit: 50,
  });
  // Shape matches what fetchPayrollByDepartment in api.js returns so the
  // snapshot can be served as-is.
  return rows.map((r) => ({
    department: r.department_division || 'Unknown',
    totalPay: Number(r.total) || 0,
    employees: Number(r.employees) || 0,
  }));
}

async function fetchTopEarners(year) {
  // One person can have multiple position rows per year. Sum across each
  // (last, first, department) tuple to get true annual compensation.
  const rows = await socrataQuery(DATASETS.payroll, {
    $select:
      'name_last, name_first, department_division, position_title, SUM(pay_total_actual) as total',
    $where: `year='${year}'`,
    $group: 'name_last, name_first, department_division, position_title',
    $order: 'total DESC',
    $limit: 100,
  });
  // Collapse to top 50 by name (in case the same person shows under multiple
  // titles — keep the highest-paid title row).
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const key = `${r.name_last}|${r.name_first}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: `${r.name_first || ''} ${r.name_last || ''}`.trim() || 'Unknown',
      department: r.department_division || '',
      title: r.position_title || '',
      totalPay: Number(r.total) || 0,
    });
    if (out.length >= 50) break;
  }
  return out;
}

async function fetchPayrollOverTime() {
  const rows = await socrataQuery(DATASETS.payroll, {
    $select: 'year, SUM(pay_total_actual) as total, COUNT(*) as headcount',
    $group: 'year',
    $order: 'year ASC',
    $limit: 30,
  });
  return rows.map((r) => ({
    year: r.year,
    totalPayroll: Number(r.total) || 0,
    headcount: Number(r.headcount) || 0,
  }));
}

/* ------------------------------------------------------------------ */
/* Quasi-government aggregations                                      */
/* ------------------------------------------------------------------ */

async function fetchQuasiByAgency() {
  const rows = await socrataQuery(DATASETS.quasi, {
    $select: 'quasi_agency_name, SUM(amount) as total',
    $group: 'quasi_agency_name',
    $order: 'total DESC',
    $limit: 30,
  });
  return rows.map((r) => ({
    name: r.quasi_agency_name || 'Unknown',
    value: Number(r.total) || 0,
  }));
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function loadExisting() {
  try {
    const raw = await readFile(OUTPUT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function main() {
  const sources = [];
  const warnings = [];

  const tryFetch = async (name, fn) => {
    try {
      const v = await fn();
      const count = Array.isArray(v) ? v.length : Object.keys(v || {}).length;
      sources.push({ name, ok: true, count });
      return v;
    } catch (err) {
      const msg = err?.message || String(err);
      warnings.push(`${name}: ${msg}`);
      sources.push({ name, ok: false, error: msg });
      return null;
    }
  };

  // Spending — three years × three queries.
  const spendingByDepartment = {};
  const spendingByVendor = {};
  for (const fy of YEARS) {
    spendingByDepartment[fy] = await tryFetch(
      `spending.byDepartment.${fy}`,
      () => fetchSpendingByDepartment(fy),
    );
    await sleep(800);
    spendingByVendor[fy] = await tryFetch(
      `spending.byVendor.${fy}`,
      () => fetchSpendingByVendor(fy),
    );
    await sleep(800);
  }
  const spendingOverTime = await tryFetch('spending.overTime', fetchSpendingOverTime);
  await sleep(800);

  // Payroll — payroll year is calendar year, not FY.
  const PAYROLL_YEARS = [String(CURRENT_FY - 2), String(CURRENT_FY - 1)];
  const payrollByDepartment = {};
  const topEarners = {};
  for (const year of PAYROLL_YEARS) {
    payrollByDepartment[year] = await tryFetch(
      `payroll.byDepartment.${year}`,
      () => fetchPayrollByDepartment(year),
    );
    await sleep(800);
    topEarners[year] = await tryFetch(
      `payroll.topEarners.${year}`,
      () => fetchTopEarners(year),
    );
    await sleep(800);
  }
  const payrollOverTime = await tryFetch('payroll.overTime', fetchPayrollOverTime);
  await sleep(800);

  // Quasi-government.
  const quasiByAgency = await tryFetch('quasi.byAgency', fetchQuasiByAgency);

  const failedAll = sources.filter((s) => s.ok).length === 0;
  if (failedAll) {
    const existing = await loadExisting();
    if (existing) {
      warnings.push('All Socrata queries failed — preserving previous snapshot.');
      const preserved = {
        ...existing,
        fetchedAt: existing.fetchedAt || new Date().toISOString(),
        preservedFromCache: true,
        sources,
        warnings,
      };
      await mkdir(dirname(OUTPUT_PATH), { recursive: true });
      await writeFile(OUTPUT_PATH, JSON.stringify(preserved, null, 2) + '\n', 'utf8');
      console.log('[cthru-aggregates] preserved previous snapshot');
      return;
    }
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    years: YEARS,
    payrollYears: PAYROLL_YEARS,
    preservedFromCache: false,
    sources,
    warnings,
    spendingByDepartment,
    spendingByVendor,
    spendingOverTime: spendingOverTime || [],
    payrollByDepartment,
    topEarners,
    payrollOverTime: payrollOverTime || [],
    quasiByAgency: quasiByAgency || [],
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  const okCount = sources.filter((s) => s.ok).length;
  console.log(`[cthru-aggregates] wrote snapshot (${okCount}/${sources.length} sources OK)`);
  if (warnings.length) {
    console.log('[cthru-aggregates] warnings:');
    for (const w of warnings) console.log('  - ' + w);
  }
}

main().catch((err) => {
  console.error('[cthru-aggregates] fatal:', err);
  // Stub a minimal valid file so the freshness index never breaks.
  const stub = {
    fetchedAt: new Date().toISOString(),
    years: YEARS,
    preservedFromCache: false,
    sources: [],
    warnings: [`fatal: ${err?.message || String(err)}`],
    spendingByDepartment: {},
    spendingByVendor: {},
    spendingOverTime: [],
    payrollByDepartment: {},
    topEarners: {},
    payrollOverTime: [],
    quasiByAgency: [],
  };
  mkdir(dirname(OUTPUT_PATH), { recursive: true })
    .then(() => writeFile(OUTPUT_PATH, JSON.stringify(stub, null, 2) + '\n'))
    .finally(() => process.exit(0));
});
