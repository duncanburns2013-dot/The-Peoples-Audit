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
    const entities = data.top20?.length || 0;
    const lobbyists = data.keyIndividuals?.length || data.uniqueLobbyists || 0;
    const clients = data.clients?.length || data.uniqueClients || 0;
    const years = (data.registrationYears || []).join(', ') || 'unknown';
    console.log(`[ma-lobbying] Existing data: ${entities} entities, ${lobbyists} lobbyists, ${clients} clients (${years})`);
    console.log(`[ma-lobbying]   Total records: ${data.totalRecords || 'unknown'}`);
    console.log('[ma-lobbying] Data preserved. SOS site blocks automated access — manual update required.');
  } catch (e) {
    console.log(`[ma-lobbying] Warning: Could not parse existing file: ${e.message}`);
  }
} else {
  console.log('[ma-lobbying] No data file found at', dataPath);
  console.log('[ma-lobbying] To populate: download View Source from SOS search and parse with Claude.');
}

console.log('[ma-lobbying] Done.');
