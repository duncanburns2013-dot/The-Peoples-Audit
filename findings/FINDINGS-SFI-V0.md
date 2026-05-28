# SFI v0 Findings — Initial Public Release

**Date:** 2026-05-27
**Corpus:** 29,729 Massachusetts Statements of Financial Interest, 2019–2025
**Source:** Bulk redacted release from the MA State Ethics Commission
**Pipeline:** [`audit-scripts/sfi/`](../audit-scripts/sfi/)

This is the first published cut of the SFI corpus. The data is real,
verifiable, and was just bulk-released after a long approval process. The
findings below are derived from automated cross-reference; **every named
individual finding should be manually verified against the underlying PDF
before being treated as anything more than a research lead**.

## What's in the dataset

| Year | Filings | Unique filers |
|------|--------:|--------------:|
| 2019 | 4,206 | 4,205 |
| 2020 | 4,054 | 4,054 |
| 2021 | 4,356 | 4,356 |
| 2022 | 4,292 | 4,292 |
| 2023 | 4,419 | 4,419 |
| 2024 | 4,317 | 4,316 |
| 2025 | 4,085 | 4,085 |

Filers include state legislators, judges, agency heads, board members, and
designated public employees subject to G.L. c. 268B. Home addresses,
personal phone, and personal email are **redacted at the source**; all
substantive financial-interest disclosures (employers, securities, real
estate, gifts, debts) are preserved.

## Headline pattern: state officials with spouses at Tempus Unlimited

**Tempus Unlimited, Inc.** sits at the top of the
[HHS-MA-DOGE](https://github.com/duncanburns2013-dot/HHS-MA-DOGE)
fraud-flag rankings — **$6.62 billion in Medicaid spending** across 7 NPIs
all registered to a single Stoughton MA address (600 Technology Center Dr).

A word-boundary substring scan of every SFI filing's Q7 section (Spouse
Business Employment) found **nine distinct Massachusetts public officials
across all three branches of state government** who disclosed their spouse
was employed by Tempus Unlimited, in some cases for every year of the
corpus.

| Filer | Branch / Agency (from work email) | Years disclosed |
|---|---|---|
| Reardon, James G | Judiciary (`jud.state.ma.us`) | 2019 · 2020 · 2021 · 2022 · 2023 · 2024 · 2025 |
| Barrett, James A | Executive (`mass.gov`) | 2019 · 2020 · 2021 · 2022 · 2023 · 2024 |
| Sacramone, Ralph V | Treasury (`tre.state.ma.us`) | 2021 · 2022 · 2023 · 2024 · 2025 |
| Marsi Jr, John J | House (`mahouse.gov`) | 2023 · 2024 · 2025 |
| Rinella, Matthew P | MassDOT (`dot.state.ma.us`) | 2019 · 2020 |
| Travers, Jeffrey T | Executive (`mass.gov`) | 2023 · 2024 · 2025 |
| Gomez, Carmen Z | Judiciary (`jud.state.ma.us`) | 2022 |
| Valentine, Teri W | DOE (`doe.mass.edu`) | 2019 |

These disclosures were **verified by direct PDF read** — the Q7 text in
each filing explicitly lists "Tempus Unlimited" with the Stoughton address.

### Adjacent finding: Cerebral Palsy of Massachusetts at the same building

Reardon, James G's 2024 Q7 also lists his spouse as an independent
contractor for **Cerebral Palsy of Massachusetts** at "600 Technology
Center Drive, Sroughton [sic], MA, 02072" — the **exact same building** as
Tempus Unlimited. This is the address-sharing pattern HHS-MA-DOGE flags as
a fraud signal; it merits a follow-up check of MA Secretary-of-State
corporate filings to see whether the two entities are common-controlled.

### What this is, and what it is not

These are **disclosed spousal employment ties** — the officials filed
them; this dataset just makes the pattern visible. The disclosures
themselves are lawful and may have nothing to do with the Medicaid
spending concentration at the same address. **No fraud or wrongdoing by
the named officials is alleged.**

What it IS:

- A previously-unsearchable pattern made searchable
- A starting point for journalists / researchers / oversight to ask:
  - Do these officials' duties touch Medicaid policy, MassHealth
    contracting, or oversight of Tempus's business line?
  - Have they recused themselves from related decisions?
  - Are Tempus and Cerebral Palsy of Massachusetts related entities?

## Broader DOGE cross-reference

See [`data/sfi/crossref/`](../data/sfi/crossref/) for the full machine
output and [`public/data/ma-sfi-doge-crossref.json`](../public/data/ma-sfi-doge-crossref.json)
for the UI-consumable version.

- **Pass 1 — SFI filer name ≡ DOGE authorized official.** 65 (name, year)
  candidate matches. **Most of these are NOT validated same-person matches**
  — the `name_commonness_in_sfi` column flags entries where the same
  first+last appears across multiple unrelated state filers. Manual
  verification required before public claims.
- **Pass 2 — Top DOGE entity names in SFI section text.** 28 disclosures,
  all Tempus Unlimited (see headline pattern above).
- **Pass 3 — SFI real-estate-ownership addresses sharing street + number +
  ZIP with DOGE-flagged Medicaid billing addresses.** 60 hits. The match
  requires street number, normalized street name, and ZIP5 to match. False
  positives still possible in mixed-use buildings.

## Methodology

```
encrypted bulk release  ──┐
                          ├──► EasyLock decrypt to local disk
                          │     (manual, GUI password entry)
zips per year ────────────┘
   │
   │ 01_unzip_rename.py
   ▼
{year}/{Last}__{First}.pdf  (29,729 PDFs, ~7 GB on disk)
   │
   │ 02_extract_text.py  (PyMuPDF text extraction, ~5 min)
   ▼
sfi_master.csv (29,729 × 49 cols)
sfi_text.jsonl (per-question section text — 625 MB, kept local)
   │
   │ 04_crossref.py
   ▼
crossref/pass[1-3]_*.csv
   │
   │ 05_build_site_json.py
   ▼
public/data/ma-sfi*.json
```

Every step is reproducible from the scripts in
[`audit-scripts/sfi/`](../audit-scripts/sfi/). The encrypted source is not
redistributed in this repo; the decrypted PDF corpus is published as
GitHub Releases (`sfi-2019` … `sfi-2025`) at ~1 GB per year.

## Known limitations

1. **Pass 1 false-positive risk.** Name-only matching against
   `fraud_flags_shared_officials.csv` cannot tell a state employee named
   "John Smith" apart from a Medicaid-NPI authorized official named "John
   Smith." Use `name_commonness_in_sfi` to filter before any individual
   claim.
2. **Section-level granularity.** The current extractor flags WHICH sections
   are filled; it does not yet pull individual employer / address / creditor
   rows into structured tables. That's the next pass.
3. **Tempus-only Pass 2 today.** Pass 2 only scanned the top ~150 DOGE
   entities. Expanding to every flagged entity will surface more matches.
4. **Redaction acceptance.** Home addresses are redacted at the source. We
   do not attempt to deredact and treat the redactions as ground truth.
