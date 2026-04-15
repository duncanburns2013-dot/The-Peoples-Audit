#!/usr/bin/env node
/**
 * fetch-ma-lobbying.mjs
 * 
 * The MA Secretary of State Lobbyist Public Search site blocks automated access
 * from cloud servers (GitHub Actions). Every scraping approach fails at the
 * search submission step — the page loads but won't return results.
 * 
 * This script simply preserves whatever data is already in the JSON file.
 * To update the data:
 *   1. Go to https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx
 *   2. Set registration year, set "View all results", click Search
 *   3. Ctrl+U (View Source), save the HTML
 *   4. Upload to Claude and have it parse the records into JSON
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(__dirname, '..', 'public', 'data', 'ma-lobbying.json');

console.log('[ma-lobbying] Checking existing data file...');

if (existsSync(dataPath)) {
  try {
    const data = JSON.parse(readFileSync(dataPath, 'utf8'));
    const count = data.records ? data.records.length : 0;
    const year = data.metadata?.registrationYear || 'unknown';
    const lobbyists = data.metadata?.counts?.lobbyist || 0;
    const entities = data.metadata?.counts?.entity || 0;
    const clients = data.metadata?.counts?.client || 0;
    console.log(`[ma-lobbying] Existing data: ${count} records (${year} registration year)`);
    console.log(`[ma-lobbying]   Lobbyists: ${lobbyists}, Entities: ${entities}, Clients: ${clients}`);
    console.log('[ma-lobbying] Data preserved. SOS site blocks automated access — manual update required.');
  } catch (e) {
    console.log(`[ma-lobbying] Warning: Could not parse existing file: ${e.message}`);
  }
} else {
  console.log('[ma-lobbying] No data file found at', dataPath);
  console.log('[ma-lobbying] To populate: download View Source from SOS search and parse with Claude.');
}

console.log('[ma-lobbying] Done.');
