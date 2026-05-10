#!/usr/bin/env node
/**
 * fetch-ma-sfi.mjs
 *
 * STUB. Statements of Financial Interest (SFIs) are filed annually by every
 * Massachusetts public official with the State Ethics Commission. They are
 * legally public records, but the Commission gates programmatic access — a
 * request must be approved before bulk PDF download is allowed.
 *
 * This script exists today as scaffolding so the dashboard can ship an empty
 * SFI tab and the rest of the pipeline (workflow, freshness index, UI shell)
 * is wired before the real data arrives. When the access request is approved,
 * replace the fetch + parse logic below; the output schema below is what
 * `SfiExplorer.jsx` reads, so keep field names stable.
 *
 * Schema (committed):
 *   {
 *     fetchedAt: ISO,
 *     status: 'awaiting-access' | 'live',
 *     filingsYear: "2025",
 *     count: number,
 *     accessNote: string,
 *     warnings: [],
 *     filings: [
 *       {
 *         legislatorName: "Last, First",
 *         chamber: "Senate" | "House",
 *         district: "Suffolk and Middlesex",
 *         filingYear: "2024",  // covers calendar year 2024, filed in 2025
 *         employers: [{ name, position, incomeBracket, redacted: bool }],
 *         securities: [{ company, type, valueBracket }],
 *         realEstate:  [{ town, type, valueBracket, redactedAddress: bool }],
 *         gifts:       [{ source, description, value }],
 *         spouseEmployers: [...],
 *         sourcePdfUrl: string,
 *         scrapedFromCache: bool
 *       }, ...
 *     ]
 *   }
 *
 * Once SFI bulk download is approved, the parser will need to handle:
 *   - Redactions (mark `redacted: true` rather than dropping the row)
 *   - Income brackets (the form uses ranges like "$5,001-$10,000")
 *   - Multiple-position employers (member of multiple boards)
 *   - Spouse vs. legislator separation (different parts of the form)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'data', 'ma-sfi.json');

const ACCESS_NOTE =
  'Statements of Financial Interest are filed annually with the MA State ' +
  'Ethics Commission. Bulk programmatic access is request-gated and ' +
  'pending approval. Once granted, this script will parse approved PDFs ' +
  'into the structured form below. Redactions (home addresses, account ' +
  'numbers, dependents) will be preserved as `redacted: true` flags.';

async function loadExisting() {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const existing = await loadExisting();
  // If a previous run has real data, preserve it exactly. The stub only
  // writes when the file doesn't exist or is itself a stub.
  if (existing && existing.status === 'live' && Array.isArray(existing.filings) && existing.filings.length) {
    console.log('[ma-sfi] preserving existing live snapshot — nothing to do');
    return;
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    status: 'awaiting-access',
    filingsYear: String(new Date().getUTCFullYear() - 1),
    count: 0,
    accessNote: ACCESS_NOTE,
    warnings: [
      'Awaiting bulk-access approval from the MA State Ethics Commission.',
      'When approved, the SfiExplorer tab will populate automatically on the next fetch.',
    ],
    filings: [],
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log('[ma-sfi] wrote stub awaiting-access snapshot');
}

main().catch((err) => {
  console.error('[ma-sfi] fatal:', err);
  process.exit(0);
});
