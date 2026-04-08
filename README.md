# The People's Audit

**Massachusetts Public Financial Transparency Dashboard**

> 72% of Massachusetts voters demanded a legislative audit. The Legislature said no. So we built this.

## What Is This?

The People's Audit is a citizen-led transparency dashboard that puts every publicly available Massachusetts financial record on display. It pulls live data from official government sources and presents it in an accessible, interactive format for all the world to see.

**No stone (dollar) left unturned.**

## Data Sources

All data comes from publicly available government records:

- **[CTHRU Portal](https://www.macomptroller.org/cthru/)** — Massachusetts Office of the Comptroller's transparency platform
  - Statewide Spending (FY2010–present, updated daily)
  - Statewide Payroll (CY2010–present, updated bi-weekly)
  - Quasi-Government Financial Data
  - Budget vs. Actual comparisons
  - Revenue data (2009–present)
- **[USASpending.gov](https://www.usaspending.gov/)** — Federal spending flowing to Massachusetts
- **[MassOpenBooks](https://massopenbooks.org/)** — Public employee salary and pension data
- **Governor's Budget Recommendations** — Annual budget summaries

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

## Contributing

This is an open-source transparency project. PRs are welcome. If you have access to additional Massachusetts public financial data, please open an issue.

## License

MIT — This is public data for the public good.
