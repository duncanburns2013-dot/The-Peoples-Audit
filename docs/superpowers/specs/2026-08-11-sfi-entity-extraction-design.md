# Fix SFI entity extraction

**Status:** approved 2026-08-11
**Prerequisite for:** SFI ↔ roll-call conflict screening (separate spec)

## Problem

The SFI pipeline reports column headers and street addresses where it should report
entity names. On the live site, the **TOP EMPLOYERS** column is wrong for essentially
every filing.

Measured across the committed `public/data/ma-sfi.json` (29,729 filings):

| Metric | Value |
|---|---|
| Non-empty `ownTopEmployer` values | 5,556 |
| …that are the literal string `"Income"` | 5,289 (**95.2%**) |
| Legislator filings with a header-artifact employer | 454 of 459 (**98.9%**) |

The remaining values are mostly fragments of addresses — `Paul X. Tivnan Drive,`,
`Brussels Street,`, `Post Office Square`.

The correct data is present and cleanly readable in the source PDFs. Joan Lovely's
2019 Q5 reads:

```
Business Name          Address                          Position   Income
Lovely Law Group LLP   Ten Federal Street, Salem, MA    Manager    $10,001 to 20,000
```

Site shows `Income`. Truth is `Lovely Law Group LLP`.

## Root causes

All four confirmed against source PDFs, not inferred.

1. **Bare header not skipped.** `first_business_name()` in `11_enhance_sfi_json.py`
   skips `"Amount of Income"` but not bare `"Income"`, so it returns the header cell of
   the Q5 table.

2. **Line heuristics vs. tables.** The extractor takes "the first non-trivial line that
   looks like an entity name". The real structure is a table whose cells wrap across
   several lines, so a line is rarely a whole field. This is what surfaces address
   fragments as employers.

3. **Certification bleed.** `QUESTION_RE` (`^\s*(\d{1,2}(?:\.[a-z])?)\.?\s+(?=[A-Z])`)
   also matches the `IMPORTANT: 1. 2. 3.` list inside the trailing CERTIFICATION block.
   Parsing `Allie__Dan.pdf` yields the marker sequence `1..40, 1, 2, 3`, so sections
   Q1–Q3 are overwritten with certification boilerplate.

4. **"Filer reported none" not honoured uniformly.** `ma-sfi-gifts.json` lists
   Dan Allie (2019) as disclosing a gift. His PDF reads
   `38. Identify any Gifts and/or Honoraria… Filer reported none.` The 1,174-row gifts
   dataset and the `hasLobbyistGifts` flag both inherit this.

## Design

### One shared parser module

New `audit-scripts/sfi/sfi_parse.py`, imported by the extractor and both enhancers, so
there is a single implementation instead of per-script heuristics.

**`split_sections(text) -> dict[str, str]`**
Truncate the document at `CERTIFICATION` before matching, then require the marker
sequence to be monotonically increasing. Out-of-order markers are rejected rather than
allowed to overwrite an earlier section. This addresses cause 3 with a structural
invariant rather than a pattern special-case.

**`parse_table(section, schema) -> list[dict]`**
Each question declares its column schema, e.g.

```python
Q5 = ["Business Name", "Address", "Position", "Income", "Self-employed"]
```

Records are delimited by anchors that survive line wrapping:

- income bands — `$1 to $1,000` … `$100,001 or more`
- address tails — `<STATE>, <ZIP>, US`

The prompt prose preceding the header row is discarded by locating the header, not by
guessing at line counts. This addresses causes 1 and 2: header cells are consumed as
the schema, so they can never be emitted as values.

**`is_none(section) -> bool`**
`Filer reported none` (case-insensitive) means zero rows, applied at one place for every
question. Addresses cause 4.

### Outputs

| File | Contents |
|---|---|
| `data/sfi/sfi_entities.csv` | `(year, slug, question, row_index, field, value)` — the full extracted entity table |
| `public/data/ma-sfi.json` | regenerated; correct `ownTopEmployer`, `spouseTopEmployer`, real estate, creditors |
| `public/data/ma-sfi-gifts.json` | regenerated without false positives |

`sfi_entities.csv` is the durable artifact. The vote-conflict analysis consumes it
directly, rather than re-deriving entities from summary fields.

## Validation

This defect reached production and stayed there because nothing checked it. The fix
ships with checks that would have caught it immediately.

**Corpus invariants** — run over the full output, fail the build on violation:

1. No extracted entity value may equal a known column header
   (`Income`, `Position`, `Address`, `Business Name`, `Self-employed`, `Employer`,
   `Creditor Name`, `Obligor`, …). *This one assertion catches 95% of the current bug.*
2. A section where `is_none()` holds must produce zero rows.
3. Every parsed section's marker must be in monotonic order — no Q1 after Q40.

**Golden fixtures** — ~30 hand-verified filings committed under
`audit-scripts/sfi/fixtures/`, chosen to cover each question type, filings that report
none, multi-row tables, and the accented/apostrophe names that break naive parsing.
Expected extractions stored alongside as JSON.

**Extraction-rate report** — per-question fill rates printed on every run, so a future
regression appears as a rate change rather than silently wrong strings. Compare against
the committed `data/sfi/fill_rates_by_year.csv` where the questions overlap.

## Sequencing

1. **Parser + fixtures**, validated against the **1,343 legislator filings**
   (House + Senate). Small enough to hand-check, and it is what unblocks the
   vote-conflict analysis.
2. **Full corpus re-extraction** — all 29,729 filings, in GitHub Actions, reading the
   bulk `sfi-<YYYY>.zip` release assets. Chunked by year. Regenerates `ma-sfi.json` and
   `ma-sfi-gifts.json`, fixing the live site.
3. The roll-call pipeline (separate spec).

Steps 1 and 2 share all code; step 2 is the same parser over more input.

## Decisions taken

Recorded so they can be overridden deliberately rather than by accident.

- **Full corpus is re-extracted, not just legislators.** The employer column is wrong
  site-wide for ~29,000 filings; fixing only the 1,343 legislator rows would leave a
  known-wrong dataset published. Cost is ~7.7 GB of zip downloads and a pypdf pass,
  estimated 1–2 hours in Actions, chunked by year.
- **The gifts correction is published, not silent.** `lobbyistGiftFilingsCount` is
  expected to move once false positives are removed. A transparency project that
  silently revises its own numbers undermines the thing it exists to do, so the change
  is recorded in `findings/`. *Duncan's call to override — this is an editorial
  decision, not a technical one.*
- **Extraction is byte-faithful to the PDFs.** Where a filing is genuinely ambiguous or
  unparseable, the row is emitted as empty and counted in the rate report. No inference,
  no filling gaps from other sources.

## Out of scope

- Any change to `SfiExplorer.jsx`. The component reads the same field names; correcting
  the data is sufficient.
- The roll-call fetch, vote parsing, and conflict matching — separate spec.
- The per-file PDF release backfill, which is already running.
