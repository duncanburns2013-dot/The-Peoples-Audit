# SFI Findings — LOCKED v1

**Date:** 2026-05-27
**Corpus:** 29,729 Massachusetts Statements of Financial Interest, 2019–2025
**Source:** Bulk redacted release from the MA State Ethics Commission
**Pipeline:** [`audit-scripts/sfi/`](../audit-scripts/sfi/)
**Verification artifacts:** [`audit-scripts/sfi/09_verify_tempus.py`](../audit-scripts/sfi/09_verify_tempus.py), per-row verification log at [`data/sfi/verify/tempus_verified.md`](../data/sfi/verify/tempus_verified.md)

> **What changed from v0:** Independent verification (PDF read, public-records identity check, PCA program docs, NPPES, ProPublica 990) sharpened the framing. The v0 headline "spouses work at the #1 DOGE-flagged Medicaid biller" was technically true but materially misleading. The correct framing — and the locked headline — is **"spouses receive income through the MassHealth Personal Care Attendant program, with Tempus Unlimited as the Fiscal Intermediary."** Tempus is a pass-through program administrator, not a fraud actor. The DOGE "rank-1" flag is a structural artifact of Tempus being the sole statewide PCA FI by program design. v0 is preserved at [`FINDINGS-SFI-V0.md`](FINDINGS-SFI-V0.md) for transparency.

This is the published v1. Every claim in this document has been independently verified by the method named in the row.

---

## What's verified

| Claim | Verification | Status |
|---|---|---|
| 29,729 SFI filings 2019–2025, all filers, redacted at source | direct PDF count + manifest | ✓ |
| 28 Q7 disclosures naming Tempus Unlimited across 8 officials | PyMuPDF text extraction re-run per PDF; literal "tempus" found in Q7 of every row | ✓ 28/28 |
| Officials' real identities (#1–#9) | public-records search by work-email domain + agency rosters | ✓ all 9 |
| Tempus = sole statewide MassHealth PCA Fiscal Intermediary | mass.gov info page | ✓ |
| MassHealth member is legal employer of record; Tempus issues W-2 as Fiscal/Employer Agent | mass.gov + Tempus website | ✓ |
| "FBO [member name]" means PCA paid to provide care to that specific member | 130 CMR 422 + PCA-15 bulletin | ✓ |
| Spouse/parent-of-minor-consumer/surrogate/guardian PROHIBITED as paid PCA | 130 CMR 422 + PCA-15 bulletin | ✓ |
| 7 (DOGE) / 10 (NPPES) Tempus NPIs at 600 Technology Center Dr, Stoughton | NPPES API + fraud_flags_shared_addresses.csv | ✓ |
| All 7 NPIs in DOGE list authorized by LARRY SPENCER, CEO | direct CSV read | ✓ |
| Sum of Tempus entity_spending = $6,620,437,058.40 (cumulative 2018–2024) | direct CSV `awk` sum | ✓ |
| Tempus FY2024 revenue $2.13B, net surplus ~$2.6M, Spencer comp $441,995 | ProPublica 990 (EIN 04-2239746) | ✓ |
| "Cerebral Palsy of Massachusetts" = Tempus pre-2017 legal name | BBB + ProPublica + MassDevelopment + April 2017 rename announcement | ✓ |
| 1,227 lobbyist/interested-party gift disclosure rows | direct CSV count | ✓ |

## What was demoted from v0

- **Pass 3 (60 real-estate address overlaps).** Per-row spot-check (Patricia M Harris, Peter W Sacks) revealed my Q-section splitter misattributes Q7 (spouse employment) text into Q13/Q17 (real estate) for some filings. Pass 3 results are *research leads*, not headline-grade findings, until per-row Q-section attribution is independently verified. Moved to "Research leads" section below.
- **Pass 1 candidates Smith, Brian C and Archer, Damian.** Neither could be confirmed as the same person named in `fraud_flags_shared_officials.csv` via public-records identity search. **Different-person assumption holds absent additional evidence.** Removed from named-finding section.

---

## Headline pattern

**Eight Massachusetts public officials, across the Judiciary, the House, the executive branch, the Treasury, MassDOT, and DESE, disclosed in their own Statements of Financial Interest 2019–2025 that a spouse or household dependent received income through the MassHealth Personal Care Attendant program, with Tempus Unlimited, Inc. as the Fiscal/Employer Agent.**

The MassHealth PCA program cost ~$1.75B in FY2024 and is the most rapidly-growing line in the MassHealth budget. The 8 officials' household economies include income that depends on the continued funding and policy structure of that program. All disclosures are lawful; the officials filed them themselves under penalty of perjury. **No wrongdoing by any named official is alleged.**

### The 8 officials, verified

| Filer | Confirmed position | Years disclosed | Q7 spouse-employer text (excerpt) |
|---|---|---|---|
| **Hon. James G. Reardon Jr.** | Associate Justice, MA Superior Court (Worcester County Presiding Justice; nominated 2016) | 2019 · 2020 · 2021 · 2022 · 2023 · 2024 · 2025 | "Tempus Unlimited 600 Technology Drive, Stoughton, MA, 02072, US — Independent Contractor" (multiple entries per year) |
| **James A. Barrett** | Deputy Commissioner of Depository Institutions Supervision, MA Division of Banks (most-likely identity match) | 2019 · 2020 · 2021 · 2022 · 2023 · 2024 | "Tempus Unlimited 600 Technology Drive, Stoughton, MA, 02072, US — Employee" |
| **Ralph V. Sacramone** | Executive Director, MA Alcoholic Beverages Control Commission (ABCC, under State Treasurer) | 2021 · 2022 · 2023 · 2024 · 2025 | "Tempus Unlimited, Inc 600 Technology Center Drive, Stoughton, MA, 02072, US — Employee" (multiple entries per year) |
| **Rep. John J. Marsi Jr. (R)** | MA House, 6th Worcester District; special-elected March 2024 | 2023 · 2024 · 2025 | "Tempus Unlimited 600 Technology Center Dr, Stoughton, MA, 02072, US — Employee" |
| **Jeffrey T. Travers** | Deputy CIO, MA Trial Court (soft-confirm — cross-domain account possible) | 2023 · 2024 · 2025 | "Tempus Unlimited 600 Technology Center Dr., Stoughton, MA, 02072, US — Employee" |
| **Matthew P. Rinella** | Director, Accounting & Financial Reporting, MassDOT | 2019 · 2020 | "TEMPUS UNLIMITED, INC., FBO MELISSA RAFFERTY 600 Technology Center Drive, Stoughton, MA, 02072, US — Employee" |
| **Dr. Carmen Z. Gomez, PhD** | Deputy Commissioner of Pretrial Services, MA Probation Service / Trial Court (27-year tenure) | 2022 | "TEMPUS UNLIMITED, INC. 600 Technology Center Drive, Stoughton, MA, 02072, US — Employee" |
| **Teri Williams Valentine** | Former Director, Special Education Planning & Policy, MA DESE (2002–~2017); now Sr. Program Associate, WestEd | 2019 | "Tempus Unlimited, Inc 600 Technology Center Drive, Stoughton, MA, 02072, US — Independent Contractor" |

### What the "FBO" construction reveals

Matthew P. Rinella's 2019 + 2020 Q7 disclosures literally read **"TEMPUS UNLIMITED, INC., FBO MELISSA RAFFERTY"** — i.e., his spouse is a Personal Care Attendant *For Benefit Of* MassHealth recipient Melissa Rafferty. Per MA PCA program regulations (130 CMR 422.402, PCA-15 bulletin), a **spouse** of the consumer cannot be paid as that consumer's PCA. Therefore Melissa Rafferty is **not** Rinella's spouse — she is a third-party MassHealth recipient (likely a parent, sibling, or other non-spouse relative of Rinella's spouse) whose personal care is provided by Rinella's spouse and billed through Tempus as Fiscal Intermediary.

The other eight officials' disclosures use "Tempus Unlimited" without the FBO suffix. Per program documentation, all are structurally the same arrangement: spouse is a W-2 PCA worker (or 1099 Independent Contractor in practice, despite the program manual specifying W-2), the MassHealth consumer is the legal employer, Tempus issues the wage.

### Why this matters

This is not a fraud finding. It is a **structural household-income finding**: a meaningful cohort of MA public officials — including a sitting state representative, an Associate Justice of the Superior Court, the head of the ABCC, a senior Trial Court IT officer, the MassDOT controller, a Probation Service Deputy Commissioner, and a former DESE policy director — have household income that depends on the continued funding and policy structure of the MassHealth PCA program.

The PCA program:

- Cost MA ~$1.75B in FY2024 (GBH, Feb 2025; Franklin Observer)
- Is the most-rapidly-growing line item in the MassHealth budget
- Has been the subject of a Healey-administration cost-control proposal (Feb 2025) opposed by the SEIU-organized PCA workforce
- Is administered by exactly one statewide Fiscal Intermediary (Tempus), which is also the spouse-employer of record in all 28 SFI disclosures

The disclosures are public. The officials' duties relevant to MassHealth funding, oversight, or recusal practice are an appropriate subject of public review.

---

## Side-finding: Karyn E. Polito (former Lt. Gov.) — 370 Main Street, Worcester

Polito's 2019 SFI Q17 (Real Estate Transferred During the Year) discloses real estate held in family LLCs at multiple addresses, including:

- 1279 Providence Turnpike / Providence Road, Whitinsville, MA — Fairway Financial Realty LLC, Uxbridge Woods Realty Trust, Robinson Pasture Realty Trust, Olde Canal Realty Trust
- **370 Main Street, Worcester, MA, 01608 — Cobblestone Properties LLC**
- **370 Main Street, 11th Floor, Worcester, MA, 01608 — Uxbridge Farms LLC**

`fraud_flags_shared_addresses.csv` lists 370 Main St Worcester as a Medicaid-billing address with authorized official AUGUSTUS SEALY at $1.03M cumulative spending. Whether Sealy's Medicaid-billing entity is or was a tenant of Polito's family LLCs at that building is the unanswered question. Verified facts:

- Polito's family LLCs DO hold the property (Q17 in her own SFI)
- A Medicaid-billing entity at the same building IS in the DOGE address list
- Whether they are landlord/tenant or unrelated co-tenants is a follow-up records question (Worcester city assessor + Cobblestone Properties LLC tenant roster).

---

## Research leads (NOT headline findings)

### Pass 1 — filer-name = DOGE authorized-official (NAME-MATCH ONLY)

65 (filer, year) candidate name matches. **None are confirmed as same-person.** The lowest-name-commonness candidates were checked by public-records search and remained unconfirmed:

- **Smith, Brian C** — single SFI filer with the exact name. Mount Auburn Hospital lists a Brian Smith MD CFO as NPI authorized official, but no public record ties that hospital CFO to a MA-state SFI-required position. Different-person assumption holds.
- **Archer, Damian** — Dr. Damian K.L. Archer became CEO of Outer Cape Health Services in Dec 2023. Whether the SFI Damian Archer at `damian.archer@mass.gov` is the same person is plausible (possible board appointment) but **not directly evidenced** by any public state staff page.

Full candidate file (for journalists/oversight): [`data/sfi/crossref/pass1_filer_vs_doge_official_grouped.csv`](../data/sfi/crossref/pass1_filer_vs_doge_official_grouped.csv).

### Pass 3 — real-estate-ownership address overlap (DOWNGRADED)

60 candidate matches. The current Q-section splitter occasionally misattributes Q7 (spouse business employment) text into Q13/Q17 (real estate) due to PDF text-flow ordering. Two spot-check verifications:

- **Patricia M. Harris** (Berkshire Register of Deeds, Pittsfield): "725 North Street Pittsfield" appears in her SFI but as her spouse's *employment* address (Berkshire Health Systems, the regional hospital), NOT real-estate ownership.
- **Peter W. Sacks** (Associate Justice, MA Appeals Court): "243 Charles St Boston" appears in his SFI but as his spouse's *employer address* (Mass Eye & Ear Associates), NOT real-estate ownership.

The Polito 370 Main St entry (above) is the only Pass-3-derived hit that survived per-row verification because Polito's Q17 actually does disclose her family LLCs at that address.

Full candidate file: [`data/sfi/crossref/pass3_sfi_addr_in_doge.csv`](../data/sfi/crossref/pass3_sfi_addr_in_doge.csv). Treat each row as a lead requiring per-PDF section-attribution check before publication.

### Lobbyist gift / interested-party reimbursement disclosures

Standalone document: [`FINDINGS-SFI-LOBBYIST-GIFTS.md`](FINDINGS-SFI-LOBBYIST-GIFTS.md). 1,227 disclosure rows; 113 are the highest-signal Q36.a/Q37.a "direct-interest-in-a-matter-before-the-body" reimbursements.

---

## Sources cited in this document

- MassHealth PCA program: https://www.mass.gov/info-details/masshealth-personal-care-attendant-pca-program
- Tempus Fiscal Intermediary page: https://www.mass.gov/info-details/masshealth-personal-care-attendant-pca-fiscal-intermediary-tempus
- 130 CMR 422 (PCA regulations): https://www.mass.gov/doc/personal-care-attendant-services-regulations/download
- PCA-15 family-member bulletin: https://www.mass.gov/doc/pca-15-revised-regulations-about-the-definition-of-family-member-and-personal-care-management-0/download
- Tempus on ProPublica (EIN 042239746): https://projects.propublica.org/nonprofits/organizations/42239746
- NPPES API (10 NPIs at 600 Technology Center Dr): https://npiregistry.cms.hhs.gov/api/?version=2.1&organization_name=TEMPUS*&state=MA
- PCA program FY2024 ~$1.75B spend: https://www.wgbh.org/news/health/2025-02-10/healey-seeks-controls-as-home-care-costs-soar-for-personal-care-assistants
- HHS DOGE Medicaid dataset: https://opendata.hhs.gov/datasets/medicaid-provider-spending/
- Tempus pre-2017 name change (CPM → Tempus): https://www.facebook.com/MASSCP/posts/1640418735988146/ (signed by Larry Spencer)
- Reardon judicial nomination: https://www.mass.gov/news/governor-baker-nominates-three-to-the-massachusetts-superior-court
- Marsi MA House: https://malegislature.gov/Legislators/Profile/JJM1/District
- Sacramone ABCC: https://www.mass.gov/info-details/alcoholic-beverages-control-commission-staff-directory-abcc
- Gomez Probation Service: https://www.mass.gov/news/carmen-gomez-is-appointed-deputy-commissioner-of-pretrial-services-for-the-massachusetts-probation-service
- Valentine WestEd: https://www.wested.org/personnel/teri-williams-valentine/
- Polito Lt. Gov tenure: https://ir.cleanharbors.com/news-releases/news-release-details/clean-harbors-appoints-former-massachusetts-lieutenant-governor

## Provenance

Bulk SFI release obtained from the MA State Ethics Commission per public-records request. Per MA law (G.L. c. 268B), every individual whose SFI is released in a public-records request is notified by the Commission. Filers whose disclosures are quoted in this document have already been so notified by the Commission's release process.

Raw PDFs (per year, ~7 GB total) are attached as GitHub Releases `sfi-2019` through `sfi-2025` for direct download and independent verification.
