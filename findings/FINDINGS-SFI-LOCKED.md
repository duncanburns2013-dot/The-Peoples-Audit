# SFI Findings — LOCKED v1

**Date:** 2026-05-27
**Corpus:** 29,729 Massachusetts Statements of Financial Interest, 2019–2025
**Source:** Bulk redacted release from the MA State Ethics Commission
**Pipeline:** [`audit-scripts/sfi/`](../audit-scripts/sfi/)
**Verification artifacts:** [`audit-scripts/sfi/09_verify_tempus.py`](../audit-scripts/sfi/09_verify_tempus.py), per-row verification log at [`data/sfi/verify/tempus_verified.md`](../data/sfi/verify/tempus_verified.md)

> **Tempus disambiguation.** "Tempus Unlimited, Inc." (Stoughton MA, EIN 04-2239746, 501(c)(3) since 1959) is a Massachusetts disability-services nonprofit that operates as the sole statewide MassHealth Personal Care Attendant Fiscal Intermediary. It is **not** Tempus AI (NASDAQ: TEM), the Chicago-based health-tech / oncology data company. Different entity, different industry, different state.

> **What this document is.** A list of verified facts about disclosures made by Massachusetts public officials on their own annual Statements of Financial Interest. Each row is sourced to either (a) the official's own SFI PDF, (b) a primary public record cited inline, or (c) the live verification artifacts in this repository. No characterization is added beyond what the cited record states.

> **What this document is not.** It is not an accusation, an inference, or a finding of wrongdoing. It does not allege any failure to recuse, any misappropriation, any false statement, or any conflict-of-interest violation. The disclosures cited below are the officials' own filings under penalty of perjury, made in compliance with G.L. c. 268B. Per c. 268B, the MA State Ethics Commission notified every filer at the time of bulk release.

---

## Corpus facts

| Fact | Value | Source |
|---|---:|---|
| Filings 2019–2025 (total) | **29,729** | direct PDF count of the redacted release |
| Unique filers per year (avg) | ~4,200 | extracted manifest |
| Filings — Executive branch | 9,411 (31.7%) | work-email domain classification |
| Filings — "Other" public bodies | 8,681 (29.2%) | work-email domain classification |
| Filings — Judiciary | 4,995 (16.8%) | work-email domain classification |
| Filings — Higher Education | 2,918 (9.8%) | work-email domain classification |
| Filings — MA House | 1,054 (3.5%) | `@mahouse.gov` |
| Filings — MA Senate | 289 (1.0%) | `@masenate.gov` |
| Filings using blind trust (Q40 = YES) | 815 (2.7%) | direct Q40 parse |
| Filings disclosing a lobbyist or interested-party reimbursement / gift / honorarium (any of Q36, Q36.a, Q37, Q37.a, Q38, Q39) | 1,174 distinct filer-years (1,227 individual section rows) | direct Q36–Q39 parse |
| Filings disclosing "interested party with direct interest in a matter before filer's body" reimbursement (Q36.a or Q37.a) | 113 section rows | direct Q36.a / Q37.a parse |

---

## Tempus Unlimited disclosures — verified facts

### What the SFI text says (literal, with primary sources)

Word-boundary substring scan of every SFI filing's Q7 section ("Spouse Business Employment") for the text "Tempus" returned **28 hits** across **8 unique filers** spanning **2019–2025**. Every hit was independently re-verified by live PDF text re-extraction (per-row verification log: [`tempus_verified.md`](https://github.com/duncanburns2013-dot/The-Peoples-Audit/blob/main/data/sfi/verify/tempus_verified.md)).

The 8 unique filers and their disclosure years:

| Filer (as printed on SFI) | Years SFI text names Tempus in Q7 | Verified identity | Identity source |
|---|---|---|---|
| Reardon, James G | 2019 · 2020 · 2021 · 2022 · 2023 · 2024 · 2025 | Hon. James Gavin Reardon Jr., Associate Justice, MA Superior Court — Worcester County Presiding Justice (nominated by Gov. Baker 2016) | [mass.gov 2016 judicial nomination press release](https://www.mass.gov/news/governor-baker-nominates-three-to-the-massachusetts-superior-court) |
| Barrett, James A | 2019 · 2020 · 2021 · 2022 · 2023 · 2024 | Deputy Commissioner of Depository Institutions Supervision, MA Division of Banks (most-likely identity match by work-email domain `@mass.gov`) | [mass.gov 2024 DOB announcement](https://www.mass.gov/news/massachusetts-division-of-banks-appoints-deputy-commissioner-and-general-counsel-0) |
| Sacramone, Ralph V | 2021 · 2022 · 2023 · 2024 · 2025 | Executive Director, MA Alcoholic Beverages Control Commission (under State Treasurer) | [mass.gov ABCC staff directory](https://www.mass.gov/info-details/alcoholic-beverages-control-commission-staff-directory-abcc) |
| Marsi Jr, John J | 2023 · 2024 · 2025 | Rep. John J. Marsi Jr. (R), MA House — 6th Worcester District (special-elected March 5, 2024) | [malegislature.gov member page](https://malegislature.gov/Legislators/Profile/JJM1/District) |
| Travers, Jeffrey T | 2023 · 2024 · 2025 | Deputy CIO, Executive Office of the MA Trial Court (soft-confirm — cross-domain account possible) | [LinkedIn / Trial Court history (via RocketReach)](https://rocketreach.co/jeff-travers-email_82831322) |
| Rinella, Matthew P | 2019 · 2020 | Director, Accounting & Financial Reporting, MassDOT Finance / Office of the CFO | [MassDOT directory (via RocketReach)](https://rocketreach.co/massdot-management_b5d20011f42e3b8a) |
| Gomez, Carmen Z | 2022 | Dr. Carmen Z. Gomez, PhD, Deputy Commissioner of Pretrial Services, MA Probation Service / MA Trial Court (27-year tenure) | [mass.gov 2022 appointment announcement](https://www.mass.gov/news/carmen-gomez-is-appointed-deputy-commissioner-of-pretrial-services-for-the-massachusetts-probation-service) |
| Valentine, Teri W | 2019 | Teri Williams Valentine, former Director Special Education Planning & Policy, MA DESE (2002–~2017); now Sr. Program Associate, WestEd | [wested.org staff page](https://www.wested.org/personnel/teri-williams-valentine/) |

### Literal Q7 excerpts (selected — full set in [`tempus_verified.md`](https://github.com/duncanburns2013-dot/The-Peoples-Audit/blob/main/data/sfi/verify/tempus_verified.md))

> **Barrett, James A · 2024 SFI Q7:** "Tempus Unlimited / 600 Technology Drive, Stoughton, MA, 02072, US / Employee / N/A"

> **Reardon, James G · 2024 SFI Q7:** "Tempus Unlimited / 600 Technology Drive, Stoughton, MA, 02072, US / Independent Contractor / N/A" (lists Tempus multiple times in same year's section)

> **Marsi Jr, John J · 2024 SFI Q7:** "Tempus Unlimited / 600 Technology Center Dr, Stoughton, MA, 02072, US / Employee / N/A"

> **Sacramone, Ralph V · 2024 SFI Q7:** "Tempus Unlimited, Inc / 600 Technology Center Drive, Stoughton, MA, 02072, US / Employee / N/A"

> **Rinella, Matthew P · 2019 SFI Q7:** "TEMPUS UNLIMITED, INC., FBO MELISSA RAFFERTY / 600 TECHNOLOGY CENTER DRIVE, STOUGHTON, MA, 02072, US / Employee / N/A"

### Tempus Unlimited, Inc. — corporate facts (primary sources)

| Fact | Value | Primary source |
|---|---|---|
| Legal name | Tempus Unlimited, Inc. | [ProPublica EIN 042239746](https://projects.propublica.org/nonprofits/organizations/42239746) |
| Former legal name | "Cerebral Palsy of Massachusetts, Inc." | [April 10, 2017 rename announcement, signed by CEO Larry Spencer](https://www.facebook.com/MASSCP/posts/1640418735988146/) |
| Board rename approval | December 2016 | rename announcement (above) |
| EIN | 04-2239746 | ProPublica |
| Tax-exempt status | 501(c)(3) since April 1959 | ProPublica |
| Incorporated | June 20, 1952 | BBB Boston business record |
| Principal office | 600 Technology Center Drive, Stoughton, MA 02072 | [tempusunlimited.org](https://tempusunlimited.org/) + ProPublica |
| States of operation | Massachusetts; Pennsylvania | tempusunlimited.org |
| Mission text (verbatim) | "exists to provide a continuum of community based services that support the efforts of children and adults with disabilities to live as independently as possible in the least restrictive environment" | tempusunlimited.org |
| NTEE classification | "Diseases, Disorders, Medical Disciplines / Birth Defects and Genetic Diseases" | ProPublica |
| FY2024 total revenue | $2,127,242,202 | ProPublica 990 |
| FY2024 total expenses | $2,124,669,486 | ProPublica 990 |
| FY2024 net surplus | $2,572,716 (0.12% of revenue) | ProPublica 990 |
| FY2024 program-services revenue share | 99.9% | ProPublica 990 |
| CEO | Larry Spencer | tempusunlimited.org + ProPublica |
| CEO FY2024 reported compensation | $441,995 | ProPublica 990 |
| Role with MassHealth | Sole statewide MassHealth Personal Care Attendant Fiscal Intermediary | [mass.gov PCA FI program page](https://www.mass.gov/info-details/masshealth-personal-care-attendant-pca-fiscal-intermediary-tempus) |
| Medicaid-billing NPIs at the Stoughton address (DOGE flagged-address index) | 7 NPIs | [`fraud_flags_shared_addresses.csv`](https://github.com/duncanburns2013-dot/HHS-MA-DOGE/blob/gh-pages/fraud_flags_shared_addresses.csv) |
| Tempus organization NPIs at the Stoughton address (NPPES live) | 10 NPIs | [NPPES API query](https://npiregistry.cms.hhs.gov/api/?version=2.1&organization_name=TEMPUS*&state=MA) |
| Authorized official across all 7 DOGE-listed NPIs | Larry Spencer (CEO / CHIEF EXECUTIVE OFFICER) | fraud_flags_shared_addresses.csv |
| Cumulative Medicaid-program pass-through 2018–2024 across those 7 NPIs | $6,620,437,058.40 | direct sum of `entity_spending` column |
| MA MassHealth PCA program annual spend (FY2024) | ~$1.75B | [GBH News, Feb 10, 2025](https://www.wgbh.org/news/health/2025-02-10/healey-seeks-controls-as-home-care-costs-soar-for-personal-care-assistants) |

### MassHealth PCA program structural facts (primary sources)

| Fact | Source |
|---|---|
| MassHealth member (the "consumer") is the legal employer of record for their Personal Care Attendant. Tempus, as Fiscal/Employer Agent, issues W-2s on the member's behalf. | [mass.gov Tempus FI page](https://www.mass.gov/info-details/masshealth-personal-care-attendant-pca-fiscal-intermediary-tempus); [tempusunlimited.org Fiscal Intermediary page](https://tempusunlimited.org/fiscal-intermediary/) |
| Per 130 CMR 422.402 and the PCA-15 bulletin: adult children, parents of adult children, sons-in-law, and daughters-in-law of the consumer **may** be paid PCAs. The consumer's spouse, the parent of a minor consumer, a surrogate, and a legally responsible relative (including court-appointed guardian) **are prohibited** from being paid as that consumer's PCA. | [130 CMR 422](https://www.mass.gov/doc/personal-care-attendant-services-regulations/download); [PCA-15 bulletin](https://www.mass.gov/doc/pca-15-revised-regulations-about-the-definition-of-family-member-and-personal-care-management-0/download) |
| The "FBO [name]" construction names the MassHealth consumer for whose benefit the PCA payment is made. | program documentation (above) |

### What "Cerebral Palsy of Massachusetts" means in the SFI corpus

Reardon, James G's 2024 SFI Q7 also lists "Cerebral Palsy of Massachusetts" at "600 Technology Center Drive, Sroughton [sic], MA, 02072, US". This is the **pre-2017 legal name of the same entity** described above — same EIN (04-2239746), same address, same CEO across the rename. The Board approved the name change in December 2016 and announced it publicly on April 10, 2017. Sources cited in the corporate-facts table above.

---

## Other corpus facts cited verbatim from aggregates

### Blind-trust usage by branch

| Branch | Filers using blind trust (Q40 = YES) | % of branch's filings |
|---|---:|---:|
| Judiciary | 217 | 4.3% |
| House | 33 | 3.1% |
| MBTA | 14 | 2.8% |
| Executive | 244 | 2.6% |
| Higher Ed | 65 | 2.2% |
| MassDOT | 4 | 1.0% |
| (others) | <14 each | varies |

Source: direct Q40 parse of all 29,729 filings.

### Lobbyist and interested-party reimbursement / gift / honoraria disclosures (2019–2025, totals)

| Category | Section rows | Source |
|---|---:|---|
| Self — reimbursement from a lobbyist | 399 | direct Q36 parse |
| Self — gift / honorarium from interested party | 291 | direct Q38 parse |
| Spouse — reimbursement from a lobbyist | 243 | direct Q37 parse |
| Spouse — gift / honorarium from interested party | 181 | direct Q39 parse |
| Self — reimbursement from person with direct interest in a matter before filer's body | 76 | direct Q36.a parse |
| Spouse — reimbursement from person with direct interest in a matter before filer's body | 37 | direct Q37.a parse |
| **Total** | **1,227** | sum |

Full structured data: [`data/sfi/sfi_lobbyist_gifts.csv`](https://github.com/duncanburns2013-dot/The-Peoples-Audit/blob/main/data/sfi/sfi_lobbyist_gifts.csv).

### Most-frequent filers in the Q36–Q39 sections (filers with 7+ section rows across 7 years)

| Filer | Total Q36–Q39 section rows | Public identity |
|---|---:|---|
| Keenan, John F | 12 | State Senator (D-Quincy) |
| Pimentel, Carmen | 10 | — |
| Grant, Lisa Ann | 9 | — |
| Anderson, Michael D | 8 | — |
| Fiola, Carole A | 8 | State Rep (D-Fall River) |
| Finegold, Barry R | 8 | State Senator (D-Andover) |
| Bergeron, Ian D / Berman, Richard C / Black, Mary R / Blodgett, Ruth P / Cafazzo, Terri / Campbell, Cathleen / Cruz, Timothy J / Deacon, Matthew / Doherty, Michael J / Dougan, Jeffrey L / Fields, Robert G / Hackshaw, Eron L / Henry, Christopher N / Hogan, Maureen B / Hogberg, Eric / Landers, Patrick F / McMurtry, Paul / Moudios, Nickolas / Muller, Michael M | 7 each | various (see SFI per-filer for identity) |

---

## Karyn E. Polito — Q17 (Real Estate Transferred) — 2019 SFI

Polito's 2019 SFI Q17 discloses family-controlled LLCs holding/transferring real estate at multiple addresses, including:

- 1279 Providence Turnpike / Providence Road, Whitinsville, MA — Fairway Financial Realty LLC, Uxbridge Woods Realty Trust, Robinson Pasture Realty Trust, Olde Canal Realty Trust
- 370 Main Street, Worcester, MA 01608 — Cobblestone Properties LLC
- 370 Main Street, 11th Floor, Worcester, MA 01608 — Uxbridge Farms LLC

[`fraud_flags_shared_addresses.csv`](https://github.com/duncanburns2013-dot/HHS-MA-DOGE/blob/gh-pages/fraud_flags_shared_addresses.csv) records that 370 Main Street, Worcester is the listed address of a Medicaid-billing NPI authorized by "AUGUSTUS SEALY" with $1,031,532 cumulative entity_spending in the DOGE dataset window. The two records (Polito's family-LLC ownership disclosure and the Sealy NPI's address) share the same street address and ZIP5.

The relationship between the Polito family LLCs and the Sealy NPI (landlord/tenant, co-tenant, no relationship, or other) is not established in the records cited above and is not asserted by this document.

Polito's verified public identity: Karyn E. Polito, 72nd Lieutenant Governor of Massachusetts (Jan 8, 2015 – Jan 5, 2023). Source: [Wikipedia](https://en.wikipedia.org/wiki/Karyn_Polito) corroborated by [Clean Harbors press release](https://ir.cleanharbors.com/news-releases/news-release-details/clean-harbors-appoints-former-massachusetts-lieutenant-governor).

---

## Pass 1 (filer name = DOGE authorized official) — candidates only

A normalized "LASTNAME, FIRSTINITIAL" intersection between the SFI filer list and the DOGE [`fraud_flags_shared_officials.csv`](https://github.com/duncanburns2013-dot/HHS-MA-DOGE/blob/gh-pages/fraud_flags_shared_officials.csv) returned 65 name-collision candidates across (filer, year) pairs.

Two of the lowest-name-commonness candidates were checked for same-person identity by public-records search:

- **Smith, Brian C** — name_commonness_in_sfi = 1. Public-records identity search did not confirm same-person match against any Medicaid-NPI authorized "Brian Smith." **Different-person assumption holds; not a match.**
- **Archer, Damian** — name_commonness_in_sfi = 2. Dr. Damian K.L. Archer is CEO of Outer Cape Health Services (since Dec 2023). Whether the SFI's `damian.archer@mass.gov` is the same person was **not directly evidenced by any public state-staff page checked.** No same-person confirmation; not a match.

Full candidate file (research dataset, not findings): [`pass1_filer_vs_doge_official_grouped.csv`](https://github.com/duncanburns2013-dot/The-Peoples-Audit/blob/main/data/sfi/crossref/pass1_filer_vs_doge_official_grouped.csv).

---

## Pass 3 (SFI real-estate-section address overlap with DOGE-flagged addresses) — research dataset only

A `(street_number, normalized_street_name, ZIP5)` intersection between SFI real-estate sections (Q13–Q20) and `fraud_flags_shared_addresses.csv` returned 60 hits. Per-row spot-checks (Patricia M. Harris, Peter W. Sacks) showed that some hits originate from Q7 (spouse business employment) text that the section-splitter attributed to Q13 / Q17. The Polito 370 Main Street record above is the only one that survived per-row verification and was confirmed as actually originating in Q17.

The full Pass 3 candidate file remains available for downstream per-row verification: [`pass3_sfi_addr_in_doge.csv`](https://github.com/duncanburns2013-dot/The-Peoples-Audit/blob/main/data/sfi/crossref/pass3_sfi_addr_in_doge.csv).

---

## What this dataset does not contain

| Category of record | Why not in this dataset |
|---|---|
| G.L. c. 268A § 23(b)(3) appearance-disclosure filings | Filed separately from SFIs with the SEC; not part of the bulk SFI release. |
| Per-official recusal records | Internal to each office (judiciary disqualifications, legislative-vote recusals, agency screening logs). |
| Roll-call votes / court dockets / agency decisions | Each official's office or branch maintains these as separate public records. |
| OCPF campaign-finance receipts for the named officials | Available at [ocpf.us](https://www.ocpf.us/); not joined in this dataset. |
| MA SOS lobbyist registrations + client-payment disclosures | Available at [SOS Lobbyist Public Search](https://www.sec.state.ma.us/lobbyistpublicsearch/); not joined in this dataset. |
| CTHRU vendor-payment records for entities named in SFIs | Available at [cthru.data.socrata.com](https://cthru.data.socrata.com/); not joined in this dataset. |
| Tempus's contractual relationship with EOHHS / MassHealth | Available via public-records request to EOHHS; not in this dataset. |
| MA AG / MFCU enforcement-action history for any named entity | Available via the AG's office; not in this dataset. |

The records above would be required for any individual finding to move beyond "filer disclosed X" to "filer participated in a matter affecting X." This document does not make any such individual finding.

---

## How to verify any claim above

Every claim links to a primary source. To independently verify any specific row:

1. Find the filer's name in [`data/sfi/sfi_master.csv`](https://github.com/duncanburns2013-dot/The-Peoples-Audit/blob/main/data/sfi/sfi_master.csv).
2. Note the year and the `rel_path` column (e.g., `2024/Reardon__James_G.pdf`).
3. Download the year-specific zip from [GitHub Releases](https://github.com/duncanburns2013-dot/The-Peoples-Audit/releases) (`sfi-2024.zip` for 2024).
4. Open the PDF. The relevant section (Q7, Q13, Q17, Q40, Q36.a, etc.) will be on the labeled page of the form.

For the Tempus disclosures specifically, the per-row excerpt is also pinned in [`tempus_verified.md`](https://github.com/duncanburns2013-dot/The-Peoples-Audit/blob/main/data/sfi/verify/tempus_verified.md) alongside the verdict and the source PDF path.

---

## Provenance

Bulk SFI release obtained from the MA State Ethics Commission. Per [G.L. c. 268B](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIV/Chapter268B), the Commission notified every individual whose SFI was released in the bulk-release process. Filers whose disclosures appear in this document have already been on notice from the Commission's process.

29,729 raw PDFs are attached as GitHub Releases (`sfi-2019` … `sfi-2025`) for direct download and independent verification.
