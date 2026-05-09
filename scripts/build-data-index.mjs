#!/usr/bin/env node
/**
 * build-data-index.mjs
 *
 * Aggregates every snapshot in public/data/*.json into a single
 * public/data/_index.json so the dashboard can show a "data freshness"
 * banner without fetching each file separately at runtime.
 *
 * Output shape:
 *   {
 *     generatedAt: "2026-05-09T07:56:14.630Z",
 *     snapshots: [
 *       {
 *         file: "ma-disclosures.json",
 *         fetchedAt: "2026-05-09T07:56:14.630Z",
 *         count: 30,
 *         preservedFromCache: false,
 *         sources: [{ name, ok, count }]
 *       },
 *       ...
 *     ]
 *   }
 *
 * Run by:
 *   - Each fetch-* GitHub Action (so the index updates whenever a snapshot does)
 *   - The deploy workflow (so the bundled site always has a fresh index)
 *
 * Never throws. If a snapshot is missing or malformed, it is recorded with
 * an `error` field and the script exits 0.
 */

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'public', 'data');
const OUTPUT_PATH = resolve(DATA_DIR, '_index.json');

async function readSnapshot(filePath) {
  const file = basename(filePath);
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const stats = await stat(filePath);
    return {
      file,
      fetchedAt: parsed.fetchedAt ?? null,
      count: typeof parsed.count === 'number'
        ? parsed.count
        : Array.isArray(parsed.items) ? parsed.items.length : null,
      preservedFromCache: parsed.preservedFromCache ?? false,
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      sizeBytes: stats.size,
    };
  } catch (err) {
    return {
      file,
      error: err?.message || String(err),
    };
  }
}

async function main() {
  let entries;
  try {
    entries = await readdir(DATA_DIR);
  } catch {
    entries = [];
  }

  const snapshotFiles = entries
    .filter((name) => name.endsWith('.json'))
    .filter((name) => name !== '_index.json');

  const snapshots = await Promise.all(
    snapshotFiles.map((name) => readSnapshot(resolve(DATA_DIR, name)))
  );

  // Sort newest-first by fetchedAt; entries without a timestamp go to the bottom.
  snapshots.sort((a, b) => {
    const ta = a.fetchedAt ? Date.parse(a.fetchedAt) : 0;
    const tb = b.fetchedAt ? Date.parse(b.fetchedAt) : 0;
    return tb - ta;
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    snapshots,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`[build-data-index] wrote ${snapshots.length} entries to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('[build-data-index] fatal:', err);
  process.exit(0);
});
