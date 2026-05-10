#!/usr/bin/env node
/**
 * generate-og-image.mjs
 *
 * Renders public/images/og-preview.png — the 1200x630 social-share card
 * used by Twitter/X, LinkedIn, Facebook, Discord, etc. (referenced from
 * index.html's og:image and twitter:image meta tags).
 *
 * The card is composed in SVG (for crisp text) then rasterized via
 * @resvg/resvg-js. Run this once when copy or composition changes; the
 * PNG output is committed and served from /public.
 *
 *   npm run og
 */

import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'images', 'og-preview.png');

const W = 1200;
const H = 630;

// XML-escape so user-editable strings can't break the SVG.
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const KPIs = [
  { value: '$60.9B', label: 'State Budget' },
  { value: '$22.9B', label: 'Federal Funds' },
  { value: '18',     label: 'Quasi Agencies' },
  { value: '$24.7B', label: 'AGI Outflow' },
];

function buildSvg() {
  const cardW = 240;
  const cardGap = 24;
  const cardsTotalW = KPIs.length * cardW + (KPIs.length - 1) * cardGap;
  const cardsStartX = (W - cardsTotalW) / 2;
  const cardsY = 470;
  const cardH = 110;

  const cards = KPIs.map((k, i) => {
    const x = cardsStartX + i * (cardW + cardGap);
    return `
      <rect x="${x}" y="${cardsY}" width="${cardW}" height="${cardH}" rx="14" ry="14"
            fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
      <text x="${x + cardW / 2}" y="${cardsY + 50}" text-anchor="middle"
            font-family="Inter, -apple-system, sans-serif" font-weight="800" font-size="36"
            fill="#FFFFFF">${esc(k.value)}</text>
      <text x="${x + cardW / 2}" y="${cardsY + 82}" text-anchor="middle"
            font-family="Inter, -apple-system, sans-serif" font-weight="500" font-size="16"
            fill="#9ca0b8" letter-spacing="0.5">${esc(k.label.toUpperCase())}</text>
    `;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#1a1d2e"/>
      <stop offset="50%"  stop-color="#1e2540"/>
      <stop offset="100%" stop-color="#162038"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FFC72C"/>
      <stop offset="100%" stop-color="#FF9D2C"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Subtle grid lines for that "data dashboard" feel -->
  <g stroke="rgba(255,255,255,0.04)" stroke-width="1">
    ${Array.from({ length: 12 }, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="${H}"/>`).join('')}
    ${Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${i * 100}" x2="${W}" y2="${i * 100}"/>`).join('')}
  </g>

  <!-- Top eyebrow badge -->
  <g>
    <rect x="437" y="64" width="326" height="32" rx="16" ry="16"
          fill="rgba(104, 10, 29, 0.4)" stroke="rgba(255, 199, 44, 0.4)" stroke-width="1"/>
    <text x="600" y="86" text-anchor="middle"
          font-family="Inter, -apple-system, sans-serif" font-weight="700" font-size="14"
          fill="#FFC72C" letter-spacing="2.5">PUBLIC FINANCIAL TRANSPARENCY DASHBOARD</text>
  </g>

  <!-- Title -->
  <text x="600" y="200" text-anchor="middle"
        font-family="Inter, -apple-system, sans-serif" font-weight="900" font-size="92"
        fill="#FFFFFF" letter-spacing="-2">The People's Audit</text>

  <!-- Subtitle -->
  <text x="600" y="248" text-anchor="middle"
        font-family="Inter, -apple-system, sans-serif" font-weight="400" font-size="22"
        fill="#c9cdd9">Massachusetts. Every public dollar on display.</text>

  <!-- 71.8% callout box -->
  <g>
    <rect x="240" y="294" width="720" height="120" rx="14" ry="14"
          fill="rgba(255, 199, 44, 0.07)" stroke="rgba(255, 199, 44, 0.35)" stroke-width="1"/>

    <!-- Big percentage on left -->
    <text x="320" y="378" text-anchor="start"
          font-family="Inter, -apple-system, sans-serif" font-weight="900" font-size="78"
          fill="url(#goldGrad)" letter-spacing="-2">71.8%</text>

    <!-- Two-line stat label on right -->
    <text x="495" y="350"
          font-family="Inter, -apple-system, sans-serif" font-weight="700" font-size="22"
          fill="#FFFFFF">of Massachusetts voters said YES</text>
    <text x="495" y="382"
          font-family="Inter, -apple-system, sans-serif" font-weight="400" font-size="18"
          fill="#9ca0b8">to auditing the legislature &#8226; Question 1, 2024</text>
    <text x="495" y="404"
          font-family="Inter, -apple-system, sans-serif" font-weight="600" font-size="16"
          fill="#FF6B6B">The legislature said no. So we built this.</text>
  </g>

  <!-- KPI cards -->
  ${cards}

  <!-- Footer URL -->
  <text x="600" y="610" text-anchor="middle"
        font-family="Inter, -apple-system, sans-serif" font-weight="500" font-size="14"
        fill="#6b7189" letter-spacing="1">duncanburns2013-dot.github.io/The-Peoples-Audit</text>
</svg>`;
}

async function main() {
  const svg = buildSvg();
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: {
      // resvg's default fallback handles missing fonts gracefully — Inter
      // isn't bundled but the system fallback used at render time produces
      // a clean modern result.
      loadSystemFonts: true,
    },
  });
  const pngData = resvg.render().asPng();
  await writeFile(OUTPUT_PATH, pngData);
  console.log(`[og-image] wrote ${pngData.length.toLocaleString()} bytes to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('[og-image] fatal:', err);
  process.exit(1);
});
