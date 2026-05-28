# SFI ↔ HHS-MA-DOGE Cross-Reference — Pass 1 (Name)
### Verified survivors beyond Tempus
**Locked v1 · 2026-05-28**

This document records the verified survivors of the **first** cross-reference
pass over the 29,729-filing MA State Ethics SFI bulk release: SFI filer name
matched against the authorized-official name on HHS-MA-DOGE-flagged NPI
records. The Tempus disclosures are covered separately in
[FINDINGS-SFI-LOCKED.md](FINDINGS-SFI-LOCKED.md); this document covers what
survived after every other Pass 1 candidate was either re-classified as a
name collision or kicked to NEEDS_REVIEW.

## What this document is

A list of MA state public-health and mental-health officials whose
**publicly disclosed** state position (per their SFI Q2) **matches the
authorized-official name on one or more NPI registrations** for state-run
or state-contracted healthcare facilities.

Both records are independently sourced:
- **SFI Q2** — the filer's own legally required disclosure of state position
  under G.L. c. 268B. Source: MA State Ethics Commission bulk release.
- **NPI authorized official** — the name listed in the CMS National Plan and
  Provider Enumeration System (NPPES) as the official signatory for the
  NPI registration. Source: HHS-MA-DOGE NPI flag set, derived from the
  CMS NPPES public file.

These are publicly available records. No wrongdoing alleged.

## What this document is NOT

- A claim of conflict of interest. MA state public-health hospitals and
  state-contracted providers are required to have a state-employed
  authorized official on the NPI registration. Senior MA DPH/DMH executives
  appearing on state-facility NPI registrations is the structural
  expectation, not an exception.
- A claim that these individuals personally received money. The
  "NPI total spending" figure is Medicare/Medicaid spending **flowing to
  the NPI's organization** (typically the Commonwealth of Massachusetts
  or a state-affiliated hospital), not to the individual.
- A claim of identity equivalence beyond what the evidence supports. The
  identity inference here is: SFI filer (state role, agency, work email,
  city) + NPI authorized official (same name, same agency or state
  hospital, overlapping years) = same person. We did not pull birth
  certificates.

## Methodology

1. **Pass 1** (`audit-scripts/sfi/04_crossref.py`): every SFI filer's
   normalized name (last, first0) was compared against every
   HHS-MA-DOGE-flagged NPI's authorized_official name. 228 raw hits, 65
   (filer-name, year) groups, 16 unique names.

2. **Automated verification** (`audit-scripts/sfi/12_verify_crossref.py`):
   each candidate's SFI Q2 (state position) was loaded from the extracted
   text. Candidates whose state role was legislative, judicial, transport,
   or education (e.g. UMass President's Office, House of Representatives,
   Suffolk Superior Court) were classified `LIKELY_COLLISION`. Candidates
   whose state role plausibly intersected with the NPI's healthcare
   context were classified `PLAUSIBLE`. Result: 25 PLAUSIBLE, 25
   LIKELY_COLLISION, 15 NEEDS_REVIEW.

3. **PDF re-verification** (`audit-scripts/sfi/13_verify_pass1_pdfs.py`):
   each PLAUSIBLE candidate's SFI PDF was reopened directly with PyMuPDF
   and Q2 was re-extracted from the binary file (not the JSONL cache).
   The agency keyword from the original verification was searched against
   the freshly re-extracted Q2. **Result: 25 / 25 PDF-verified.**

The verification artifacts are:
- `C:\PeoplesAudit\out\crossref\pass1_verified.csv` — every candidate's
  verdict with reason
- `C:\PeoplesAudit\out\crossref\pass1_survivors_verified.csv` — PDF
  re-verification result per (filer, year)
- `C:\PeoplesAudit\out\crossref\VERIFY_SUMMARY.md` — human-readable
  summary

## The 5 verified individuals

### 1. ARCHER, Damian
- **SFI years filed (PDF-verified)**: 2024, 2025 (2 / 2)
- **SFI Q2 disclosed state position**:
  > Public Health Council member · $100,001 or more · 04/03/2025 – 04/02/2031
- **Work email**: damian.archer@mass.gov
- **Matched NPI authorized official**: ARCHER, DAMIAN
- **NPI org(s)**: OUTER CAPE HEALTH SERVICES, INC.
- **NPI cities**: Harwich Port, Provincetown, Wellfleet
- **NPIs**: 3
- **Total Medicare/Medicaid spending to these NPIs**: $15,844,051
- **SFI source**: `2025/Archer__Damian.pdf` from the MA State Ethics bulk release

### 2. DUNN, Cecilia
- **SFI years filed (PDF-verified)**: 2019–2025 (7 / 7)
- **SFI Q2 disclosed state position** (2025 filing):
  > Department of Public Health (DPH) Deputy Director, BIDLS ·
  > $100,001 or more · since 11/22/2020 · 305 South Street, Boston, MA, 02130
- **Earlier role (2019)**: Department of Public Health (DPH) Director of Operations · since 06/19/2011
- **Work email**: ceci.dunn@mass.gov
- **Matched NPI authorized official**: DUNN, CECILIA
- **NPI org**: THE COMMONWEALTH OF MASSACHUSETTS
- **NPI city**: Boston
- **NPIs**: 2
- **Total Medicare/Medicaid spending to these NPIs**: $2,791,821
- **SFI source**: `2025/Dunn__Cecilia.pdf` from the MA State Ethics bulk release

### 3. LIPTAK, Valenda
- **SFI years filed (PDF-verified)**: 2019–2025 (7 / 7)
- **SFI Q2 disclosed state position** (2025 filing):
  > Department of Public Health (DPH) Chief Executive Officer at Western
  > Massachusetts Hospital · $100,001 or more · since 09/22/2014 ·
  > 91 East Mountain Road, Westfield, MA, 01085 · plus Department of
  > Public Health (DPH) Bureau Director of the Public Health Hospitals ·
  > $100,001 or more · since 11/21/2021 · 250 Washington Street, Boston, MA
- **Work email**: valenda.liptak@massmail.state.ma.us
- **Matched NPI authorized official**: LIPTAK, VALENDA
- **NPI org**: THE COMMONWEALTH OF MASSACHUSETTS
- **NPI cities**: Jamaica Plain, Tewksbury
- **NPIs**: 5
- **Total Medicare/Medicaid spending to these NPIs**: $1,751,681
- **SFI source**: `2025/Liptak__Valenda_M.pdf` from the MA State Ethics bulk release

(Note for the record: Jamaica Plain is the location of Lemuel Shattuck
Hospital and Tewksbury is the location of Tewksbury State Hospital —
both are DPH-operated public health hospitals under her bureau director
role.)

### 4. OLSEN-VIEIRA, Lynne
- **SFI years filed (PDF-verified)**: 2022–2025 (4 / 4)
- **SFI Q2 disclosed state position** (2025 filing):
  > Department of Mental Health (DMH) Chief Operating Officer ·
  > $100,001 or more · since 09/25/2023 · 60 Hodges Ave, Taunton, MA, 02780
- **Work email**: lynne.olsen-vieira@mass.gov
- **Matched NPI authorized official**: OLSEN-VIEIRA, LYNNE
- **NPI org**: THE COMMONWEALTH OF MASSACHUSETTS
- **NPI city**: Fall River
- **NPIs**: 2
- **Total Medicare/Medicaid spending to these NPIs**: $143,679
- **SFI source**: `2025/Olsen-Vieira__Lynne_A.pdf` from the MA State Ethics bulk release

### 5. DiSTEFANO, Anthony
- **SFI years filed (PDF-verified)**: 2021–2025 (5 / 5)
- **SFI Q2 disclosed state position** (2025 filing):
  > Department of Public Health (DPH) CEO at Western Massachusetts Hospital ·
  > $100,001 or more · since 03/18/2022 · 91 East Mountain Rd, Westfield, MA, 01085
- **Work email**: Anthony.DiStefano@mass.gov
- **Matched NPI authorized official**: DISTEFANO, ANTHONY
- **NPI org**: WESTERN MASSACHUSETTS HOSPITAL
- **NPI city**: Westfield
- **NPIs**: 2
- **Total Medicare/Medicaid spending to these NPIs**: $29,553
- **SFI source**: `2025/DiStefano__Anthony_R.pdf` from the MA State Ethics bulk release

## Pass 1 candidates excluded (LIKELY_COLLISION)

Eleven name-matched candidates were excluded after Q2 review because the
SFI filer's actual state role did not plausibly intersect with the NPI's
healthcare context. Examples:

- **Collins, Michael** — Univ. of Massachusetts President's Office, SVP for Health Sciences (a UMass administrator, not the Emerson/Morton hospital authorized official named Michael Collins)
- **Sullivan, William** — Suffolk Superior Court Justice (a judge, not the Avon/North Andover healthcare authorized official)
- **Moran, John** — Mass. House of Representatives (a state representative, not the Horace Mann Educational Assoc. authorized official)
- **Brennan, James** — Office of the Commissioner of Probation (not the AFC Physicians of Massachusetts authorized official)
- **Anderson, James** — UMass Dartmouth Vice Chancellor (not the Foot Specialists of New England authorized official)
- **Phillips, Mary** — Woburn District Court Associate Justice (not the South Suburban Gastroenterology authorized official)

Full exclusion table is in `pass1_verified.csv`.

## Pass 3 (address overlap) — open

The third cross-reference pass (street-number + street-name + ZIP overlap
between SFI-disclosed addresses and HHS-MA-DOGE-flagged organization
addresses) produced 60 candidate hits across 28 unique filers. None has
been promoted to PUBLISHED status. Address overlap alone is too noisy:
many of the matched addresses are multi-tenant medical office buildings,
state-owned buildings shared by multiple agencies, or street numbers that
coincidentally repeat across unrelated towns. These remain NEEDS_REVIEW
pending per-hit reading of the SFI section in context.

## Methodology files

- Pass 1 (name match): [`audit-scripts/sfi/04_crossref.py`](../audit-scripts/sfi/04_crossref.py)
- Verifier (Q2 vs NPI org): [`audit-scripts/sfi/12_verify_crossref.py`](../audit-scripts/sfi/12_verify_crossref.py)
- PDF re-verifier (25 / 25): [`audit-scripts/sfi/13_verify_pass1_pdfs.py`](../audit-scripts/sfi/13_verify_pass1_pdfs.py)

Raw verification artifacts are in `C:\PeoplesAudit\out\crossref\` on the
extraction machine. PDFs for each cited filing are reattached as GitHub
Releases under the matching `sfi-YYYY` tag on this repository.

## Disambiguation

These records concern individual MA state employees by name. None of the
five individuals named in this document is alleged to have done anything
wrong. All five make their state-employment disclosures every year in
compliance with G.L. c. 268B, and the NPI authorized-official role is
typically a routine ministerial signature for state-operated healthcare
facilities. This document exists because the SFI bulk release made
year-over-year cross-referencing against the NPI registry possible for
the first time, and because the same word-boundary scan that produced the
Tempus finding also surfaces this smaller set — also publicly
sourceable, also worth recording on the public ledger.
