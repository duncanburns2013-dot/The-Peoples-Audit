/**
 * CSV export utilities.
 *
 * Usage:
 *   import { downloadCSV } from './utils/csv.js';
 *   downloadCSV('top-vendors-2025.csv', topVendors); // [{ name, value, ... }, ...]
 *
 * Or build the string yourself:
 *   const text = toCSV(rows, ['Vendor', 'Total Paid'], (r) => [r.name, r.value]);
 */

const NEEDS_QUOTING = /[",\r\n]/;

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : String(value);
  return NEEDS_QUOTING.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Convert an array of plain objects (or anything via mapper) into a CSV string.
 *
 *   toCSV(rows)
 *     -> headers come from the keys of the first row
 *
 *   toCSV(rows, ['Vendor', 'Total Paid'], (r) => [r.name, r.value])
 *     -> explicit headers and row mapper
 */
export function toCSV(rows, headers, rowMapper) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return headers ? headers.map(escapeCell).join(',') + '\r\n' : '';
  }

  let resolvedHeaders = headers;
  let resolvedMapper = rowMapper;

  if (!resolvedHeaders) {
    resolvedHeaders = Object.keys(rows[0] ?? {});
  }
  if (!resolvedMapper) {
    resolvedMapper = (row) => resolvedHeaders.map((key) => row?.[key]);
  }

  const lines = [resolvedHeaders.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(resolvedMapper(row).map(escapeCell).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

/**
 * Trigger a browser download of `rows` as a CSV file.
 * Adds a UTF-8 BOM so Excel opens it without mangling non-ASCII characters.
 */
export function downloadCSV(filename, rows, headers, rowMapper) {
  if (typeof document === 'undefined') return;

  const csv = toCSV(rows, headers, rowMapper);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Revoke after a tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
