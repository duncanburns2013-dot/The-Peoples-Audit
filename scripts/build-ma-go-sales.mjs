#!/usr/bin/env node
/**
 * build-ma-go-sales.mjs
 *
 * Builds public/data/ma-go-sales.json from public/data/ma-go-sales-source.csv.
 *
 * The CSV is hand-verified research: every row is a reoffering yield read from an
 * Official Statement (Massachusetts and AAA-rated states) or a FRED Treasury yield,
 * with its source URL and retrieval date. It replaces the old "bond trades" panel,
 * whose eight trades were seed data that the EMMA fetch never replaced.
 *
 * Question it answers: do investors charge Massachusetts more than AAA states?
 * Spread = Massachusetts yield minus a AAA state's yield on a GO sale within 7 days,
 * same maturity year. Matches graded "weak" (different coupon or call terms) are
 * kept in the file but left out of the summary.
 *
 * Re-run after adding a new sale to the CSV:  node scripts/build-ma-go-sales.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '..', 'public', 'data', 'ma-go-sales-source.csv');
const OUT = resolve(__dirname, '..', 'public', 'data', 'ma-go-sales.json');
const SUMMARY_SINCE = '2023-01-01'; // Healey took office Jan 5, 2023

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const num = s => (s === '' ? null : Number(s));
const median = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const rows = parseCsv(await readFile(SRC, 'utf8'));
const byType = t => rows.filter(r => r.record_type === t);

// AAA comparators keyed by MA sale date + tenor + yield (the spread note quotes the yield)
const aaa = byType('AAA_state_GO');
const findAaa = (maDate, tenor, y) =>
  aaa.find(r => r.matched_ma_sale_date === maDate && r.tenor === tenor && Math.abs(num(r.yield_pct) - y) < 0.0005);

const sales = new Map();
for (const r of byType('MA_GO')) {
  const s = sales.get(r.date) ?? {
    date: r.date,
    series: r.series,
    ratings: { moodys: r.rating_moodys, sp: r.rating_sp, fitch: r.rating_fitch },
    tenors: {},
  };
  s.tenors[r.tenor] = {
    maturity: num(r.maturity_year), coupon: num(r.coupon), yield: num(r.yield_pct),
    source: r.source_url, retrieved: r.retrieved, comparators: [],
  };
  sales.set(r.date, s);
}
for (const r of byType('UST_context')) {
  const t = sales.get(r.matched_ma_sale_date)?.tenors[r.tenor];
  if (t) t.treasury = num(r.yield_pct);
}
for (const r of byType('spread_bps')) {
  const t = sales.get(r.matched_ma_sale_date)?.tenors[r.tenor];
  const m = r.note.match(/minus ([A-Z]{2}) ([\d.]+)%/);
  if (!t || !m) continue;
  const comp = findAaa(r.matched_ma_sale_date, r.tenor, Number(m[2]));
  t.comparators.push({
    state: m[1],
    issuer: comp?.issuer ?? m[1],
    saleDate: comp?.date ?? null,
    coupon: comp ? num(comp.coupon) : null,
    yield: Number(m[2]),
    spreadBps: num(r.spread_bps),
    match: r.match_quality.startsWith('weak') ? 'rough' : 'like-for-like',
    matchNote: r.match_quality,
    source: comp?.source_url ?? null,
  });
}

const list = [...sales.values()].sort((a, b) => b.date.localeCompare(a.date));
const summarise = tenor => {
  const s = list.filter(x => x.date >= SUMMARY_SINCE).flatMap(x => (x.tenors[tenor]?.comparators ?? []).filter(c => c.match === 'like-for-like').map(c => c.spreadBps));
  return { tenor, matches: s.length, medianBps: s.length ? median(s) : null, within10Bps: s.filter(v => Math.abs(v) <= 10).length };
};
const retrieved = rows.map(r => r.retrieved).filter(Boolean).sort().at(-1);
const latest = list[0];

const out = {
  fetchedAt: `${retrieved}T00:00:00Z`,
  source: 'Official Statements (Massachusetts via massbondholder.com; AAA states via their own sites) and FRED Treasury yields',
  count: list.length,
  method: 'Spread = Massachusetts GO reoffering yield minus a AAA-rated state GO yield, same maturity year, sold within 7 days. "Rough" matches (different coupon or call terms) are shown but left out of the summary. Treasury yields are taxable and shown for context only.',
  summarySince: SUMMARY_SINCE,
  ratingsLatest: { date: latest.date, ...latest.ratings },
  summary: [summarise('10y'), summarise('20y')],
  sourceCsv: 'ma-go-sales-source.csv',
  sales: list,
};
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`[ma-go-sales] ${list.length} sales; 10y since ${SUMMARY_SINCE}:`, out.summary[0]);
