# Contributing to The People's Audit

Thanks for your interest in helping audit the Massachusetts Legislature. This is a citizen-led project and outside contributions are welcome.

## Ways to contribute

- **Report a bug** — open a GitHub issue using the Bug Report template.
- **Suggest a feature** — open a GitHub issue using the Feature Request template.
- **Suggest a new data source** — open an issue using the Data Source Request template. Public records that are machine-readable (JSON/CSV/XML) are easiest to integrate.
- **Submit a pull request** — fork, branch, and PR against `main`. The deploy workflow will build automatically.

## Development setup

```bash
git clone https://github.com/duncanburns2013-dot/The-Peoples-Audit.git
cd The-Peoples-Audit
npm install
npm run dev
```

Open http://localhost:5173 (or whatever port Vite reports).

## Project layout

```
.
├── src/
│   ├── App.jsx                # Top-level dashboard, tab routing
│   ├── components/            # Per-feature dashboards (DisclosuresFeed, PacDashboard, etc.)
│   ├── services/api.js        # Live API calls (Socrata SODA, USASpending, Treasury)
│   └── utils/                 # Small utilities (CSV export, URL state)
├── public/data/               # Pre-fetched JSON snapshots committed by GitHub Actions
├── scripts/                   # Node scripts that produce the snapshots above
├── .github/workflows/         # Scheduled fetch + deploy
└── api.js                     # Legacy root-level API helpers
```

## How data snapshots work

Some sources (bond disclosures, lobbying, nonprofits, municipal debt) are scraped on a schedule by GitHub Actions and committed to `public/data/*.json`. The pattern, in `scripts/fetch-ma-*.mjs`:

- **Never throw.** Failures are recorded as `warnings` inside the JSON output.
- **Preserve the cache** if every live source returns 0 items, so the UI never goes blank.
- Output shape: `{ fetchedAt, sources, warnings, count, items }`.

If you add a new snapshot script, follow the same shape so it gets picked up by `scripts/build-data-index.mjs` and surfaces in the freshness banner.

## Available utilities

- `src/utils/csv.js` — `toCSV(rows)` and `downloadCSV(filename, rows)`. Use these to add an Export button to any table view.
- `src/utils/useUrlState.js` — `useUrlState(key, defaultValue)` keeps a piece of state in `?key=value` so users can share filtered views.

## Style and conventions

- React 19, function components, hooks only.
- Charts use Recharts. Animations use Framer Motion (respect `prefers-reduced-motion`).
- Money formatting goes through `formatMoney` / `formatMoneyFull` in `App.jsx`.
- Run `npm run lint` before pushing.

## Filing a good issue

Tell us:
- What you saw vs. what you expected.
- Browser + OS if it's a UI bug.
- A link to the dashboard view that demonstrates it (deep links coming soon).

## Code of conduct

Be civil. This is a transparency tool, not a partisan one. Disagreements about scope and methodology are welcome; personal attacks are not.

## License

All contributions are MIT-licensed. By submitting a PR you agree your work can be redistributed under that license.
