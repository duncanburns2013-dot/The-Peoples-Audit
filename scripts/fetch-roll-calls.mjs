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
// Fixed so the sample — and therefore the published estimate — is reproducible.
const SAMPLE_SEED = Number(process.env.ROLLCALL_SEED) || 194;
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

// Deterministic PRNG so the "random" sample is reproducible across runs — a
// fresh sample every night would make the estimate jitter for no reason.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleRandom(pool, n, rnd) {
  const a = pool.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// Existence check for a roll-call PDF.
//
// malegislature.gov answers HEAD with 405, so this has to be a GET. We ask for
// a single byte and discard whatever body comes back, which keeps enumerating
// ~500 roll calls from pulling ~23 MB of PDFs we don't want.
async function headOk(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-0' },
    });
    r.body?.cancel?.();
    return r.ok; // 200 (range ignored) or 206 (range honoured)
  } catch {
    return false;
  }
}

// The authoritative count of recorded votes.
//
// Counting roll-calls by scraping bill action tables badly undercounts them:
// roll-calls cluster on the few bills that reach a floor vote, while a sample
// drawn from the bill index is dominated by bills that died in committee. The
// Clerk publishes every recorded vote at a predictable URL, so enumerate those
// directly and get an exact number instead of an estimate.
async function enumerateRollCalls(chamber) {
  const url = (n) => `${BASE}/RollCall/${GENERAL_COURT}/${chamber}RollCall${n}.pdf`;
  if (!(await headOk(url(1)))) return { chamber, count: 0, highest: 0 };

  // Double to bracket the end, then binary-search the last one that exists.
  let lo = 1;
  let hi = 2;
  while (hi <= 4096 && (await headOk(url(hi)))) {
    lo = hi;
    hi *= 2;
  }
  while (hi - lo > 1) {
    const mid = ((lo + hi) / 2) | 0;
    if (await headOk(url(mid))) lo = mid;
    else hi = mid;
  }
  const highest = lo;

  // Numbering is dense in practice, but verify every number rather than
  // assuming count === highest.
  let count = 0;
  let cursor = 1;
  const worker = async () => {
    while (cursor <= highest) {
      const n = cursor++;
      if (await headOk(url(n))) count++;
      await sleep(REQUEST_DELAY_MS);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { chamber, count, highest };
}

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

  // Exact recorded-vote count, independent of the bill sample.
  let recordedVotes = null;
  try {
    const [house, senate] = await Promise.all([
      enumerateRollCalls('House'),
      enumerateRollCalls('Senate'),
    ]);
    recordedVotes = {
      house: house.count,
      senate: senate.count,
      total: house.count + senate.count,
      highestNumber: { house: house.highest, senate: senate.highest },
      method: `enumerated ${BASE}/RollCall/${GENERAL_COURT}/{House,Senate}RollCall{N}.pdf`,
      exact: true,
    };
    sources.push({ name: 'rollcalls.enumerated', ok: true, count: recordedVotes.total });
  } catch (err) {
    const msg = err?.message || String(err);
    warnings.push(`roll-call enumeration: ${msg}`);
    sources.push({ name: 'rollcalls.enumerated', ok: false, error: msg });
  }

  // A seeded RANDOM sample, not the first N. The bill index is ordered by
  // docket number, so `slice(0, N)` returns the lowest-numbered bills — which
  // are overwhelmingly bills filed at the start of the session that die in
  // committee and never see a decisive action. That biases every rate computed
  // from the sample. Seeded so the estimate is reproducible run to run.
  const rnd = mulberry32(SAMPLE_SEED);
  const houseSample = sampleRandom(housePool, SAMPLE_LIMIT_PER_CHAMBER, rnd);
  const senateSample = sampleRandom(senatePool, SAMPLE_LIMIT_PER_CHAMBER, rnd);
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

  // Rates within the sample. Kept for transparency, but NOT the headline: the
  // sample's roll-call count is an undercount by construction (see
  // enumerateRollCalls), so a share derived from it overstates opacity.
  const sampleDecisive = totals.rollCalls + totals.voicePasses;
  const sampleRatios = {
    rollCallShare: sampleDecisive > 0 ? totals.rollCalls / sampleDecisive : 0,
    voicePassShare: sampleDecisive > 0 ? totals.voicePasses / sampleDecisive : 0,
  };

  // Session-wide figures: an EXACT recorded-vote count from enumeration, and
  // voice passages scaled from the random sample to the full bill population.
  // Both halves now describe the same population, which the previous
  // sample-only ratio did not.
  const scaleFactor = scanned > 0 ? all.length / scanned : 0;
  const voicePassesEstimated = Math.round(totals.voicePasses * scaleFactor);
  const exactRollCalls = recordedVotes?.total ?? null;
  const sessionDecisive =
    exactRollCalls === null ? 0 : exactRollCalls + voicePassesEstimated;
  const sessionEstimate = {
    recordedVotesExact: exactRollCalls,
    voicePassesEstimated,
    decisiveActionsEstimated: sessionDecisive || null,
    scaleFactor: Number(scaleFactor.toFixed(3)),
    basis:
      'recorded votes enumerated exactly; voice passages extrapolated from a ' +
      `seeded random ${scanned}-bill sample of ${all.length}`,
  };

  // Headline ratio is session-wide when enumeration succeeded; otherwise fall
  // back to the sample rate rather than publishing nothing.
  const ratios =
    sessionDecisive > 0
      ? {
          rollCallShare: exactRollCalls / sessionDecisive,
          voicePassShare: voicePassesEstimated / sessionDecisive,
          basis: 'session-wide',
        }
      : { ...sampleRatios, basis: 'sample-only' };

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
    sampleStrategy: `seeded-random-${SAMPLE_LIMIT_PER_CHAMBER}-per-chamber (seed ${SAMPLE_SEED})`,
    budgetTruncated,
    preservedFromCache: false,
    recordedVotes,
    totals,
    sampleRatios,
    sessionEstimate,
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
