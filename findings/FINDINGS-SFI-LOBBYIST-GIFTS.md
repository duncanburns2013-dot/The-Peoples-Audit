# SFI Findings — Lobbyist & Interested-Party Reimbursements / Gifts / Honoraria

**Date:** 2026-05-27
**Source:** 29,729 MA SFI filings 2019–2025
**Pipeline:** [`audit-scripts/sfi/08_lobbyist_gifts.py`](../audit-scripts/sfi/08_lobbyist_gifts.py)
**Raw data:** [`data/sfi/sfi_lobbyist_gifts.csv`](../data/sfi/sfi_lobbyist_gifts.csv) · [`public/data/ma-sfi-gifts.json`](../public/data/ma-sfi-gifts.json)

The State Ethics Commission's SFI form has six questions that public officials must answer about benefits they (or their household) received from regulated parties:

| Q | Subject | Source of benefit |
|---|---|---|
| 36   | Self     | Reimbursement >$100 from a lobbyist (legislative or executive agent) |
| 36.a | Self     | Reimbursement >$100 from a person with a **direct interest** in a matter before the filer's body |
| 37   | Spouse   | Reimbursement >$100 from a lobbyist |
| 37.a | Spouse   | Reimbursement >$100 from a person with a direct interest |
| 38   | Self     | Gift or honorarium >$100 from a person with a direct interest |
| 39   | Spouse   | Gift or honorarium >$100 from a person with a direct interest |

## Aggregate

**1,227 disclosure rows across 1,174 filer-years.** Out of 29,729 filings, ~4% reported at least one such benefit.

| Subject | Kind | Rows |
|---|---|---:|
| Self | Lobbyist reimbursement (Q36) | **399** |
| Self | Gift / honorarium (Q38) | 291 |
| Spouse | Lobbyist reimbursement (Q37) | 243 |
| Spouse | Gift / honorarium (Q39) | 181 |
| Self | **Interested-party reimbursement (Q36.a)** | **76** |
| Spouse | **Interested-party reimbursement (Q37.a)** | **37** |

Q36.a and Q37.a are the highest-signal categories: the filer is disclosing a reimbursement from someone with a **direct interest in a matter before the official's own governmental body**. 113 such disclosures over 7 years.

## How to read this dataset

Each row in `sfi_lobbyist_gifts.csv` is one (filer, year, question, body-text) tuple. The `body` field is the cleaned raw text of that question's section in the SFI PDF. The SFI form templates the answer as a flat table — "Name of Source / Address of Source / Amount of Reimbursement" — which collapses to a single line in the extracted text. A future extraction pass should regex-extract structured `(source_name, source_address, amount)` triples; v0 ships the raw text so journalists/researchers can scan it directly.

Examples of sources that appear in early samples (raw, not yet structured):

- Women in Government
- NECTA (New England Cable & Telecommunications Association)
- NASTAD (National Alliance of State & Territorial AIDS Directors)
- American Traffic Solutions
- MDAR (MA Dept of Agricultural Resources)
- State Legislative Leaders Foundation

These are real organizations actively engaging public officials; cross-referencing them against [`public/data/ma-lobbying.json`](../public/data/ma-lobbying.json) (this repo's lobbying-registration snapshot) would surface direct registered-lobbyist-to-official benefit flows.

## What to investigate from here

1. **Q36.a / Q37.a entries** are the highest-value. 113 rows total. Each describes a public official (or spouse) accepting a benefit from someone with a direct interest in a matter before the official's body. These should be examined one by one.
2. **Recurring source organizations.** Build a histogram of the source-name column once it's structured. Recurring sources across multiple legislators are the lobbying-network hubs.
3. **Crossref against MA lobbying registrations** (`ma-lobbying.json`) to verify which sources are formally registered lobbyists vs. trade associations vs. nonprofits.
4. **Crossref against OCPF campaign-finance data** for the named source organizations — pattern-match against the existing pay-to-play analyses in the repo.

## Caveats

- Sources may include nonprofits and policy organizations whose contact with the official has no direct pay-to-play significance (e.g., professional-development trip reimbursement from a national policy body).
- The "direct interest in a matter before the governmental body" threshold is interpreted by the filer; some entries are clearly conservative-disclosure (filer disclosed out of caution).
- Body text is currently raw extracted text. Structured (name, address, amount) extraction is a v1 task.
