"""PDF-level re-verification for the 5 PLAUSIBLE Pass 1 survivors.
Same standard as the Tempus verification (09_verify_tempus.py): for each
candidate, open the actual SFI PDF and re-extract the Q2 (state position)
section directly from the file, then confirm the filer's role matches
what we stored in the JSONL extract.

This is to ensure the JSONL we built earlier hadn't lost or scrambled
the position info. If the PDF text still contains the same role at the
same agency, the match holds.

Output: C:/PeoplesAudit/out/crossref/pass1_survivors_verified.csv

Run after 12_verify_crossref.py."""

from __future__ import annotations

import csv
import re
from pathlib import Path

import fitz  # PyMuPDF

SFI_OUT = Path(r"C:\PeoplesAudit\out")
SFI_PDF_ROOT = Path(r"C:\PeoplesAudit\sfi")
CROSSREF = SFI_OUT / "crossref"

# The 5 candidates we expect to survive (from VERIFY_SUMMARY.md / pass1_verified.csv).
# Each: (filer_norm, role_substring_signature). role_substring_signature is what
# we expect to find in the PDF's Q2 to confirm.
# For each survivor, ROLE_KEYWORDS lists alternative phrasings the SFI Q2
# block might use to identify their state agency. We accept ANY match because
# titles drift across years (Acting CEO vs CEO, Director vs Deputy Director).
SURVIVORS = [
    ("ARCHER, DAMIAN",      ["Public Health Council"]),
    ("DUNN, CECILIA",       ["Department of Public Health", "DPH"]),
    ("LIPTAK, VALENDA",     ["Department of Public Health", "DPH"]),
    ("OLSEN-VIEIRA, LYNNE", ["Department of Mental Health", "DMH"]),
    ("DISTEFANO, ANTHONY",  ["Department of Public Health", "DPH"]),
]

def find_pdf_for(filer_norm: str, year: str) -> Path | None:
    """Find PDF under unzipped/{year}/Last__First*.pdf for the candidate."""
    last, first0 = filer_norm.split(",")
    last = last.strip()
    first0 = first0.strip()
    year_dir = SFI_PDF_ROOT / year
    if not year_dir.exists():
        return None
    pattern = f"{last.title()}__{first0.title()}*.pdf"
    matches = list(year_dir.glob(pattern))
    # Some PDFs use different casing
    if not matches:
        matches = [p for p in year_dir.iterdir()
                   if p.suffix == ".pdf"
                   and p.stem.upper().startswith(f"{last}__{first0}")]
    return matches[0] if matches else None


def extract_q2_from_pdf(pdf_path: Path) -> str:
    """Pull just the Q2 'state position' section from the PDF text and
    normalize whitespace (the PDF wraps agency names mid-word with newlines,
    so a literal substring search for 'Department of Public Health' fails
    against the raw extract because what's actually there is
    'Department of\nPublic\nHealth (DPH)')."""
    doc = fitz.open(pdf_path)
    full = "\n".join(p.get_text() for p in doc)
    doc.close()
    m = re.search(
        r"Identify the position you now hold.*?(?=Other than the position|3\.\s+Other)",
        full, flags=re.S,
    )
    block = m.group(0) if m else ""
    # Collapse all whitespace runs (incl. mid-word newlines) to single spaces.
    return re.sub(r"\s+", " ", block).strip()


def main():
    pass1 = list(csv.DictReader((CROSSREF / "pass1_verified.csv").open(encoding="utf-8")))
    plausible = [r for r in pass1 if r["verdict"] == "PLAUSIBLE"]

    out_rows = []
    for r in plausible:
        filer = r["norm_key"]
        year = r["sfi_year"]
        keywords = next((kws for n, kws in SURVIVORS if n == filer), None)
        pdf = find_pdf_for(filer, year)
        if not pdf or not pdf.exists():
            out_rows.append({
                "filer": filer, "year": year, "pdf_found": False,
                "pdf_path": str(pdf) if pdf else "(not found)",
                "q2_re_extracted": "",
                "role_keywords_expected": "; ".join(keywords or []),
                "role_keyword_matched": "",
                "verdict": "NEEDS_REVIEW",
            })
            continue
        q2 = extract_q2_from_pdf(pdf)
        matched = next((k for k in (keywords or []) if k.upper() in q2.upper()), "")
        out_rows.append({
            "filer": filer,
            "year": year,
            "pdf_found": True,
            "pdf_path": str(pdf.relative_to(SFI_PDF_ROOT)),
            "q2_re_extracted": q2[:400],
            "role_keywords_expected": "; ".join(keywords or []),
            "role_keyword_matched": matched,
            "verdict": "PDF_VERIFIED" if matched else "MISMATCH",
        })

    out_path = CROSSREF / "pass1_survivors_verified.csv"
    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
        w.writeheader()
        w.writerows(out_rows)

    print(f"Wrote {out_path}")
    print()
    n_verified = sum(1 for r in out_rows if r["verdict"] == "PDF_VERIFIED")
    n_mismatch = sum(1 for r in out_rows if r["verdict"] == "MISMATCH")
    n_review = sum(1 for r in out_rows if r["verdict"] == "NEEDS_REVIEW")
    print(f"PDF re-verification: {n_verified} verified, {n_mismatch} mismatch, {n_review} needs review (of {len(out_rows)})")
    print()
    # show concise per-filer rollup
    from collections import defaultdict
    by_filer = defaultdict(lambda: {"verified": 0, "mismatch": 0, "review": 0})
    for r in out_rows:
        v = r["verdict"]
        if v == "PDF_VERIFIED": by_filer[r["filer"]]["verified"] += 1
        elif v == "MISMATCH":   by_filer[r["filer"]]["mismatch"] += 1
        else:                   by_filer[r["filer"]]["review"]  += 1
    for filer, c in by_filer.items():
        print(f"  {filer:30}  verified={c['verified']:>2}  mismatch={c['mismatch']:>2}  review={c['review']:>2}")


if __name__ == "__main__":
    main()
