# The People's Audit

https://duncanburns2013-dot.github.io/The-Peoples-Audit/

**Massachusetts Public Financial Transparency Dashboard**

> 72% of Massachusetts voters demanded a legislative audit. The Legislature said no. So we built this.

## What Is This?

The People's Audit is a citizen-led transparency dashboard that puts every publicly available Massachusetts financial record on display. It pulls live data from official government sources and presents it in an accessible, interactive format for all the world to see.

**No stone (dollar) left unturned.**

## Data Sources

All data comes from publicly available government records:

- **[CTHRU Portal](https://www.macomptroller.org/cthru/)** — Massachusetts Office of the Comptroller's transparency platform
  - Statewide Spending (FY2010–present, updated daily)
  - Statewide Payroll (CY2010–present, normally updated bi-weekly — see Data Freshness note below)
  - Quasi-Government Financial Data (live, FY2010–present)
  - Budget vs. Actual comparisons
  - Revenue data (2009–present)

### Data Freshness

Live data is pulled from official Socrata APIs. As of mid-2026 the MA Comptroller's
**Statewide Spending and Payroll feeds are affected by a publishing outage** and have
not refreshed since ~February 2026 — the dashboard surfaces this automatically via an
in-app banner (`DataFreshnessBanner`) driven by `fetchDataFreshness()`, so visitors are
never shown stale figures as if they were current. **Quasi-Government Financials**
(dataset `j7hg-9qyq`) and **federal** sources are on separate pipelines and remain current.
The previous quasi dataset (`v9tf-ghmw`) was retired by the state in 2017 and has been replaced.
- **[USASpending.gov](https://www.usaspending.gov/)** — Federal spending flowing to Massachusetts
- **[MassOpenBooks](https://massopenbooks.org/)** — Public employee salary and pension data
- **Governor's Budget Recommendations** — Annual budget summaries
- **MA State Ethics Commission — Statements of Financial Interest (SFI).**
  29,729 redacted SFI filings 2019–2025 — every legislator, judge, agency
  head, board member, and designated public employee subject to G.L. c. 268B.
  Bulk-released by the Commission in 2026. Live searchable UI in the
  [Legislator Finances tab](?section=sfi). Sourced facts:
  [`findings/FINDINGS-SFI-LOCKED.md`](findings/FINDINGS-SFI-LOCKED.md).
  Press brief: [`findings/PRESS-BRIEF-SFI-TEMPUS.md`](findings/PRESS-BRIEF-SFI-TEMPUS.md).
  Per-row verification log for the Tempus disclosure aggregation:
  [`data/sfi/verify/tempus_verified.md`](data/sfi/verify/tempus_verified.md).
  Extraction pipeline: [`audit-scripts/sfi/`](audit-scripts/sfi/). Raw PDFs
  attached as GitHub Releases (`sfi-2019` … `sfi-2025`).

## The Audit Story

In November 2024, Massachusetts Ballot Question 1 asked voters whether the State Auditor should have the authority to audit the Legislature. **71.8% voted YES** — a massive, bipartisan mandate.

Despite this, legislative leaders have refused to comply, hiring outside counsel to fight the audit in court. On February 10, 2026, State Auditor Diana DiZoglio filed a complaint with the Massachusetts Supreme Judicial Court to enforce the will of the voters.

This dashboard exists because if the Legislature won't allow a formal audit, the people will audit them with the data that's already public.

## Tech Stack

- **React** + **Vite** — Fast, modern frontend
- **Recharts** — Interactive data visualizations
- **Lucide React** — Clean iconography
- **Socrata SODA API** — Live data from CTHRU
- **USASpending API** — Federal spending data
- **GitHub Pages** — Free, public hosting

## Getting Started

```bash
npm install
npm run dev
```

## Deployment

This site is automatically deployed to GitHub Pages via GitHub Actions on every push to `main`.

## Roadmap

Things we're working toward — contributions on any of these are welcome:

- **Deep-linkable views.** Encode the active tab, year, and filters into the URL so a finding can be shared. (Utilities are in [`src/utils/useUrlState.js`](src/utils/useUrlState.js); wiring is per-tab.)
- **CSV export everywhere.** Helpers in [`src/utils/csv.js`](src/utils/csv.js); each table view should ship a Download button.
- **Data freshness banner.** The build now produces [`public/data/_index.json`](public/data/_index.json) summarizing every snapshot's `fetchedAt`. Wire a small "Last updated" badge into the dashboard header.
- **Mobile pass.** Recharts dashboards need a real device review.
- **Accessibility.** Lighthouse + axe pass; ARIA on charts; keyboard nav on every tab.
- **More data sources.** Municipal CAFRs, MBTA spending, MassDOT contracts, MassHealth managed-care payments. File a Data Source Request issue if you have one in mind.
- **Tests.** A small Vitest suite around `src/services/api.js` so schema changes at CTHRU don't silently break the site.

## Contributing

This is an open-source transparency project. PRs are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). If you have access to additional Massachusetts public financial data, [open a Data Source Request issue](.github/ISSUE_TEMPLATE/data_source_request.md).

## License

MIT — This is public data for the public good.
