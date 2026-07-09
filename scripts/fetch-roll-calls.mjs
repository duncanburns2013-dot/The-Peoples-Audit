#!/usr/bin/env node
/**
 * fetch-roll-calls.mjs
 *
 * Quantifies a question that defines Massachusetts legislative opacity:
 * what fraction of actions on bills get a recorded (roll-call) vote, vs.
 * pass on a voice vote where no individual legislator's position is on
 * the record?
 *
 * Approach:
 *   1. Hit malegislature.gov's JSON bill index for the current General
 *      Court — one round-trip, ~5000 bills.
 *   2. For a bounded sample of those bills (capped at SAMPLE_LIMIT to keep
 *      the workflow under ~3 minutes), fetch the bill detail HTML and
 *      parse its <tbody> action table.
 *   3. Classify each action row:
 *        - 'roll-call'   if the action text contains "YEAS to ... NAYS"
 *                        or an explicit roll-call number reference
 *        - 'voice-pass'  if it includes a passage/engrossment/adoption
 *                        verb without a yea/nay count
 *        - 'procedural'  for committee referrals, hearings, etc.
 *
 * Output (public/data/ma-roll-calls.json):
 *   {
 *     fetchedAt, generalCourt, billsScanned, billsTotal,
 *     sampleStrategy: "first-{N}-with-bill-number",
 *     totals: { actions, rollCalls, voicePasses, procedural },
 *     ratios: { rollCallShare, voicePassShare },
 *     recentRollCalls: [{ billNumber, title, branch, date, action, yeas, nays }, …],
 *     recentVoicePasses: [{ billNumber, title, branch, date, action }, …],
 *     warnings: [],
 *     sources: [{ name, ok, count }]
 *   }
 *
 * Same resilience rules as the rest of the fetch scripts: never throws,
 * preserves the prior snapshot if every bill request fails.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'data', 'ma-roll-calls.json');

const BASE = 'https://malegislature.gov';
// 194th General Court = 2025-2026 session. Bump when a new court convenes.
const GENERAL_COURT = 194;
// Balanced per-chamber so the sample isn't dominated by one body's docket
// numbering. The 1500-bill total is deliberately large: recorded roll-call
// votes are RARE (~0.6% of decisive actions — ~10 across the whole sample),
// so the sample must be scanned in full or the headline ratio collapses toward
// a misleading 0%. That is why we scan wide + concurrently rather than
// trimming the sample to fit the clock.
const SAMPLE_LIMIT_PER_CHAMBER = 750;
const REQUEST_DELAY_MS = 150;
const RECENT_DISPLAY = 30;
// malegislature.gov renders each bill page slowly (~2s), so a *sequential*
// 1500-bill scan runs ~60 min and blew past the workflow cap — the job was
// cancelled before writing anything, freezing the snapshot. Fix: fetch bill
// pages with bounded concurrency (a full scan then finishes in ~7 min).
const CONCURRENCY = Number(process.env.ROLLCALL_CONCURRENCY) || 8;
// Wall-clock safety net. If a scan somehow can't finish in budget we do NOT
// publish the partial (a truncated scan misses the rare roll-calls and would
// report a false 0%) — we preserve the previous full snapshot instead. Override
// via ROLLCALL_BUDGET_MS (a local run with no CI cap can pass a larger value).
const MAX_RUNTIME_MS = Number(process.env.ROLLCALL_BUDGET_MS) || 15 * 60 * 1000;
const USER_AGENT =
  'ThePeoplesAudit/1.0 (+https://github.com/duncanburns2013-dot/The-Peoples-Audit) civic-transparency-bot';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadExisting() {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

async function fetchBillIndex() {
  // The malegislature.gov API ignores the `Branch` query param — it returns
  // the full combined list regardless. We filter by BillNumber prefix
  // client-side: 'H...' = House, 'S...' = Senate.
  const url = `${BASE}/api/Documents?DocumentType=Bill&GeneralCourtNumber=${GENERAL_COURT}&pageSize=20000`;
  const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } });
  if (!r.ok) throw new Error(`bill index HTTP ${r.status}`);
  return r.json();
}

function stripTags(s) {
  return String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseActionTable(html) {
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return [];
  const rows = [...tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
  return rows.map((rm) => {
    const cells = [...rm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => stripTags(c[1]));
    return { date: cells[0] || '', branch: cells[1] || '', action: cells[2] || '' };
  });
}

// House format:  "153 YEAS to 0 NAYS"
// Senate format: "Yeas 5 to Nays 32"
const ROLL_CALL_RE_HOUSE = /\b(\d+)\s+YEAS?\s+to\s+(\d+)\s+NAYS?\b/i;
const ROLL_CALL_RE_SENATE = /\bYEAS?\s+(\d+)\s+to\s+NAYS?\s+(\d+)\b/i;
const ROLL_CALL_REF_RE = /\bYEA\s+and\s+NAY\b|\bRoll\s+Call\b/i;
const VOICE_VERBS_RE =
  /\b(passed to be (?:engrossed|enacted)|read.*engrossed|adopted|engrossed|enacted|concurred|substituted|ordered to a third reading)\b/i;

function classify(action) {
  const m = action.match(ROLL_CALL_RE_HOUSE) || action.match(ROLL_CALL_RE_SENATE);
  if (m) {
    return {
      kind: 'roll-call',
      yeas: parseInt(m[1], 10),
      nays: parseInt(m[2], 10),
    };
  }
  if (ROLL_CALL_REF_RE.test(action)) return { kind: 'roll-call' };
  if (VOICE_VERBS_RE.test(action)) return { kind: 'voice-pass' };
  return { kind: 'procedural' };
}

async function fetchActions(billNumber, generalCourt) {
  const url = `${BASE}/Bills/${generalCourt}/${billNumber}`;
  const r = await fetch(url, { headers: { Accept: 'text/html', 'User-Agent': USER_AGENT } });
  if (!r.ok) return null;
  return parseActionTable(await r.text());
}

async function main() {
  const sources = [];
  const warnings = [];

  let combined = [];
  try {
    combined = await fetchBillIndex();
    sources.push({ name: 'bills.combined', ok: true, count: combined.length });
  } catch (err) {
    const msg = err?.message || String(err);
    warnings.push(`bill index: ${msg}`);
    sources.push({ name: 'bills.combined', ok: false, error: msg });
  }

  const housePool = combined.filter((b) => b.BillNumber?.startsWith('H'));
  const senatePool = combined.filter((b) => b.BillNumber?.startsWith('S'));
  sources.push({ name: 'bills.House', ok: true, count: housePool.length });
  sources.push({ name: 'bills.Senate', ok: true, count: senatePool.length });

  const houseSample = housePool.slice(0, SAMPLE_LIMIT_PER_CHAMBER);
  const senateSample = senatePool.slice(0, SAMPLE_LIMIT_PER_CHAMBER);
  const all = [...housePool, ...senatePool];
  // Interleave the chambers so that if the wall-clock budget truncates the
  // scan, the sample stays balanced across House and Senate rather than being
  // all-House (which is the raw slice order).
  const sample = [];
  for (let i = 0; i < Math.max(houseSample.length, senateSample.length); i++) {
    if (i < houseSample.length) sample.push(houseSample[i]);
    if (i < senateSample.length) sample.push(senateSample[i]);
  }

  const totals = { actions: 0, rollCalls: 0, voicePasses: 0, procedural: 0 };
  const recentRollCalls = [];
  const recentVoicePasses = [];

  let scanned = 0;
  let scrapeErrors = 0;
  let budgetTruncated = false;
  const startedAt = Date.now();

  // Fold one bill's parsed actions into the running totals. Called from
  // concurrent workers, but runs synchronously (no await inside) so there is
  // no interleaving hazard on the shared accumulators.
  const record = (bill, actions) => {
    scanned++;
    for (const a of actions) {
      totals.actions++;
      const c = classify(a.action);
      if (c.kind === 'roll-call') {
        totals.rollCalls++;
        if (recentRollCalls.length < RECENT_DISPLAY * 4) {
          recentRollCalls.push({
            billNumber: bill.BillNumber,
            title: bill.Title || '',
            branch: a.branch,
            date: a.date,
            action: a.action,
            yeas: c.yeas ?? null,
            nays: c.nays ?? null,
          });
        }
      } else if (c.kind === 'voice-pass') {
        totals.voicePasses++;
        if (recentVoicePasses.length < RECENT_DISPLAY * 4) {
          recentVoicePasses.push({
            billNumber: bill.BillNumber,
            title: bill.Title || '',
            branch: a.branch,
            date: a.date,
            action: a.action,
          });
        }
      } else {
        totals.procedural++;
      }
    }
  };

  // Bounded-concurrency scan: CONCURRENCY workers pull from a shared cursor.
  // There is no await between reading and incrementing `cursor`, so each bill
  // is dispatched exactly once.
  let cursor = 0;
  const worker = async () => {
    while (cursor < sample.length) {
      if (Date.now() - startedAt > MAX_RUNTIME_MS) {
        budgetTruncated = true;
        return;
      }
      const bill = sample[cursor++];
      const actions = await fetchActions(bill.BillNumber, GENERAL_COURT);
      if (actions === null) {
        scrapeErrors++;
      } else {
        record(bill, actions);
      }
      await sleep(REQUEST_DELAY_MS);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  if (budgetTruncated) {
    warnings.push(
      `runtime budget (${Math.round(MAX_RUNTIME_MS / 1000)}s) reached — only ` +
        `${scanned}/${sample.length} bills scanned before cutoff`,
    );
  }

  if (scrapeErrors) {
    warnings.push(`${scrapeErrors} bill detail pages failed to load`);
  }
  sources.push({ name: 'bills.actions', ok: scanned > 0, count: scanned });

  // Sort recent lists newest-first (best-effort — dates are M/D/YYYY).
  const dateKey = (d) => {
    const m = d?.match(/(\d+)\/(\d+)\/(\d+)/);
    if (!m) return 0;
    return Date.UTC(parseInt(m[3], 10), parseInt(m[1], 10) - 1, parseInt(m[2], 10));
  };
  recentRollCalls.sort((a, b) => dateKey(b.date) - dateKey(a.date));
  recentVoicePasses.sort((a, b) => dateKey(b.date) - dateKey(a.date));

  const decisive = totals.rollCalls + totals.voicePasses;
  const ratios = {
    rollCallShare: decisive > 0 ? totals.rollCalls / decisive : 0,
    voicePassShare: decisive > 0 ? totals.voicePasses / decisive : 0,
  };

  // Preserve the previous full snapshot rather than publish a bad one when the
  // scan is unusable:
  //   - totals.actions === 0 → the scan failed outright
  //   - budgetTruncated      → incomplete; the rare roll-calls may be unscanned,
  //                            which would report a false 0% roll-call share
  const incompleteScan = totals.actions === 0 || budgetTruncated;
  if (incompleteScan) {
    const existing = await loadExisting();
    if (existing?.totals?.actions) {
      warnings.push(
        totals.actions === 0
          ? 'No actions parsed — preserving previous snapshot.'
          : `Scan truncated at ${scanned}/${sample.length} bills — preserving previous full snapshot.`,
      );
      const preserved = {
        ...existing,
        fetchedAt: existing.fetchedAt || new Date().toISOString(),
        preservedFromCache: true,
        sources,
        warnings,
      };
      await mkdir(dirname(OUTPUT_PATH), { recursive: true });
      await writeFile(OUTPUT_PATH, JSON.stringify(preserved, null, 2) + '\n', 'utf8');
      console.log('[ma-roll-calls] preserved previous snapshot');
      return;
    }
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    generalCourt: GENERAL_COURT,
    billsScanned: scanned,
    billsTotal: all.length,
    sampleStrategy: `first-${SAMPLE_LIMIT_PER_CHAMBER}-per-chamber-with-BillNumber-interleaved`,
    budgetTruncated,
    preservedFromCache: false,
    totals,
    ratios,
    recentRollCalls: recentRollCalls.slice(0, RECENT_DISPLAY),
    recentVoicePasses: recentVoicePasses.slice(0, RECENT_DISPLAY),
    sources,
    warnings,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(
    `[ma-roll-calls] scanned ${scanned}/${all.length} bills, ` +
      `${totals.actions} actions: ${totals.rollCalls} roll-call, ${totals.voicePasses} voice, ${totals.procedural} procedural`,
  );
  if (warnings.length) {
    console.log('[ma-roll-calls] warnings:');
    for (const w of warnings) console.log('  - ' + w);
  }
}

main().catch((err) => {
  console.error('[ma-roll-calls] fatal:', err);
  const stub = {
    fetchedAt: new Date().toISOString(),
    generalCourt: GENERAL_COURT,
    billsScanned: 0,
    billsTotal: 0,
    preservedFromCache: false,
    totals: { actions: 0, rollCalls: 0, voicePasses: 0, procedural: 0 },
    ratios: { rollCallShare: 0, voicePassShare: 0 },
    recentRollCalls: [],
    recentVoicePasses: [],
    sources: [],
    warnings: [`fatal: ${err?.message || String(err)}`],
  };
  mkdir(dirname(OUTPUT_PATH), { recursive: true })
    .then(() => writeFile(OUTPUT_PATH, JSON.stringify(stub, null, 2) + '\n'))
    .finally(() => process.exit(0));
});
