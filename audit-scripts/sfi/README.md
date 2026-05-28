# SFI Extraction Pipeline

Python pipeline that turns the bulk MA Statement-of-Financial-Interest PDF
release into structured, searchable data.

## What this pipeline does

Inputs **29,729 redacted SFI PDFs** (2019–2025, all filers — legislators,
judges, agency heads, board members, designated public employees) and
produces:

- `data/sfi/manifest.csv` — original-zip → canonical-PDF-path mapping
- `data/sfi/sfi_master.csv` — one row per filing with name, year, work email,
  submission date, and a boolean flag for every one of the 42 disclosure
  questions ("did this filer have content for Q7 spouse employment", etc.)
- `data/sfi/fill_rates_by_year.csv` — per-year question-fill-rate aggregates
- `data/sfi/crossref/pass[1-3]_*.csv` — DOGE cross-reference outputs
- `public/data/ma-sfi.json` — the live snapshot consumed by `SfiExplorer.jsx`
- `public/data/ma-sfi-tempus.json` — headline disclosure pattern
- `public/data/ma-sfi-doge-crossref.json` — broader DOGE matches

## Prereqs

- Python 3.10+ with `pymupdf` (`pip install pymupdf`)
- The encrypted source release decrypted to a local folder (the bulk corpus
  is not redistributed in this repo; see `findings/FINDINGS-SFI-V0.md` for
  provenance).

## Steps

```bash
# 1. Unzip + canonicalize filenames (Lastname__Firstname.pdf per year)
python 01_unzip_rename.py

# 2. Extract structured text + question-fill flags
python 02_extract_text.py --all   # ~5 min for 30K PDFs

# 3. Aggregate per-year question fill rates and top-domain stats
python 03_summary_stats.py

# 4. Cross-reference against HHS-MA-DOGE flagged Medicaid billers
python 04_crossref.py

# 5. Build site-facing JSON snapshots
python 05_build_site_json.py
```

Edit the path constants at the top of each script if your local paths differ
from `C:\PeoplesAudit\…`.

## Notes on accuracy

- The MA SEC SFI form is a stable templated PDF. The text extractor splits
  on `^N. ` and `^N.a ` line patterns and validates `N ∈ 1..40 | 36.a | 37.a`
  so dollar amounts and street numbers at line start are not mistaken for
  question boundaries.
- The certification page (page 14) repeats numbered instructions; first-
  occurrence-wins in the question splitter prevents those from clobbering
  real question content.
- Cross-reference Pass 1 is name-based and includes a `name_commonness`
  column — high values mean the match could be a different person with the
  same first+last name. Manual verification required before any individual
  finding goes public.
