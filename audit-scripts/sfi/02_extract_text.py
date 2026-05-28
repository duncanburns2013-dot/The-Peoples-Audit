"""Extract text + structured fields from one or many MA SFI PDFs.

Usage:
    python 02_extract_text.py <pdf_path>                 # single, dump to stdout
    python 02_extract_text.py --sample N                  # N random PDFs, dump
    python 02_extract_text.py --all                       # run over full corpus

Output (for --all):
    out/sfi_master.csv   : one row per filing (summary booleans + key fields)
    out/sfi_text.jsonl   : one JSON per filing with per-page text
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import re
import sys
import time
from pathlib import Path

import fitz  # PyMuPDF

SFI_ROOT = Path(r"C:\PeoplesAudit\sfi")
OUT = Path(r"C:\PeoplesAudit\out")

# Questions whose "filer reported none" status we track. Q numbers map to a
# short slug used as column name in the master CSV.
QUESTIONS = {
    "1":   "candidate",
    "2":   "public_positions",
    "3":   "other_public_positions",
    "4":   "spouse_public_positions",
    "5":   "own_business_employment",
    "6":   "own_leave_of_absence",
    "7":   "spouse_business_employment",
    "8":   "own_business_ownership",
    "9":   "spouse_business_ownership",
    "10":  "stock_transfer_to_family",
    "11":  "own_officer_director",
    "12":  "spouse_officer_director",
    "13":  "own_real_estate",
    "14":  "spouse_real_estate",
    "15":  "own_trust_real_estate",
    "16":  "spouse_trust_real_estate",
    "17":  "own_real_estate_transferred",
    "18":  "spouse_real_estate_transferred",
    "19":  "own_lien_mortgage_receivable",
    "20":  "spouse_lien_mortgage_receivable",
    "21":  "own_ma_bonds",
    "22":  "spouse_ma_bonds",
    "23":  "own_trust_ma_bonds",
    "24":  "spouse_trust_ma_bonds",
    "25":  "own_financial_investments",
    "26":  "spouse_financial_investments",
    "27":  "own_trust_financial_investments",
    "28":  "spouse_trust_financial_investments",
    "29":  "primary_residence_mortgage",
    "30":  "other_property_mortgage",
    "31":  "spouse_other_mortgage",
    "32":  "own_nonmortgage_debt",
    "33":  "spouse_nonmortgage_debt",
    "34":  "own_debt_forgiven",
    "35":  "spouse_debt_forgiven",
    "36":   "own_lobbyist_reimbursements",
    "36.a": "own_interested_party_reimbursements",
    "37":   "spouse_lobbyist_reimbursements",
    "37.a": "spouse_interested_party_reimbursements",
    "38":  "own_gifts_honoraria",
    "39":  "spouse_gifts_honoraria",
    "40":  "blind_trust",
}

# Section header text → tuple of question numbers that immediately follow.
# We slice the full document text between these headers to assign content to
# the right Qn. The form numbers Q1..Q40 sequentially, so we simply split on
# "<num>. " line starts.
QUESTION_RE = re.compile(r"^\s*(\d{1,2}(?:\.[a-z])?)\.?\s+(?=[A-Z])", re.MULTILINE)
NONE_RE = re.compile(r"\bFiler\s+reported\s+none\.", re.IGNORECASE)


def extract_filer_name(pdf_path: Path) -> tuple[str, str]:
    """Return (last, first_middle) parsed from the canonical filename slug.

    Filenames look like "Abati__Richard.pdf" or "Allard-Madaus__Michael_G.pdf".
    The "__" separates last from first; underscores within each side are spaces.
    """
    stem = pdf_path.stem
    # Strip duplicate-filing suffix if present.
    stem = re.sub(r"__dup\d+$", "", stem)
    if "__" in stem:
        last_raw, first_raw = stem.split("__", 1)
    else:
        last_raw, first_raw = stem, ""
    last = last_raw.replace("_", " ").strip()
    first = first_raw.replace("_", " ").strip()
    return last, first


def extract_submission_date(last_page_text: str) -> str:
    m = re.search(r"Submitted:\s*(\d{2}/\d{2}/\d{4})", last_page_text)
    return m.group(1) if m else ""


def extract_work_email(page1_text: str) -> str:
    # Pull the first email-looking token from page 1.
    m = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", page1_text)
    return m.group(0) if m else ""


def split_by_question(full_text: str) -> dict[str, str]:
    """Split form text into a {qnum: body_text} dict.

    Treats every line starting with "<n>. " or "<n>a. " as a Q boundary.
    """
    # Find all (qnum, start_index) positions.
    # The form only ever uses Q1..Q40 plus Q36.a and Q37.a. Anything else (e.g.
    # a "75 Cypress Waters Blvd." line) is a false hit from a street number or
    # dollar amount at line start.
    VALID_Q = set(str(i) for i in range(1, 41)) | {"36.a", "37.a"}

    matches = [m for m in QUESTION_RE.finditer(full_text) if m.group(1) in VALID_Q]
    out: dict[str, str] = {}
    # First-occurrence wins. The certification page (page 14) repeats "1."/"2."/"3."
    # as numbered instructions; we don't want those clobbering the real sections.
    for idx, m in enumerate(matches):
        qn = m.group(1)
        if qn in out:
            continue
        start = m.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(full_text)
        out[qn] = full_text[start:end]
    return out


def per_question_summary(sections: dict[str, str]) -> dict[str, bool]:
    """Return {slug: has_content_bool} for every tracked question."""
    out: dict[str, bool] = {}
    for qn, slug in QUESTIONS.items():
        body = sections.get(qn, "")
        has_content = bool(body.strip()) and not NONE_RE.search(body)
        out[slug] = has_content
    return out


def extract_pdf(path: Path) -> dict:
    """Run extraction on one PDF and return a record dict."""
    doc = fitz.open(path)
    try:
        pages = [p.get_text("text") for p in doc]
    finally:
        doc.close()

    full = "\n".join(pages)
    sections = split_by_question(full)
    summary = per_question_summary(sections)

    last, first = extract_filer_name(path)
    submitted = extract_submission_date(pages[-1]) if pages else ""
    work_email = extract_work_email(pages[0]) if pages else ""

    return {
        "path": str(path),
        "year": path.parent.name,
        "last_name": last,
        "first_name": first,
        "work_email": work_email,
        "submitted": submitted,
        "n_pages": len(pages),
        "pages": pages,
        "sections": sections,
        "summary": summary,
    }


def write_master_row(record: dict, w: csv.DictWriter) -> None:
    row = {
        "year": record["year"],
        "last_name": record["last_name"],
        "first_name": record["first_name"],
        "work_email": record["work_email"],
        "submitted": record["submitted"],
        "n_pages": record["n_pages"],
        "rel_path": str(Path(record["path"]).relative_to(SFI_ROOT)),
    }
    for slug in QUESTIONS.values():
        row[slug] = "1" if record["summary"].get(slug) else "0"
    w.writerow(row)


def run_all() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    master_path = OUT / "sfi_master.csv"
    jsonl_path = OUT / "sfi_text.jsonl"

    fields = [
        "year", "last_name", "first_name", "work_email", "submitted",
        "n_pages", "rel_path",
    ] + list(QUESTIONS.values())

    n_total = 0
    n_err = 0
    t0 = time.time()
    last_print = t0

    with master_path.open("w", newline="", encoding="utf-8") as mf, \
         jsonl_path.open("w", encoding="utf-8") as jf:
        w = csv.DictWriter(mf, fieldnames=fields)
        w.writeheader()

        for year_dir in sorted(SFI_ROOT.iterdir()):
            if not year_dir.is_dir():
                continue
            for pdf in sorted(year_dir.glob("*.pdf")):
                try:
                    rec = extract_pdf(pdf)
                except Exception as e:
                    n_err += 1
                    print(f"ERR {pdf}: {e}", file=sys.stderr)
                    continue
                write_master_row(rec, w)
                # JSONL: omit raw pages/sections from master row but write them in jsonl
                jf.write(json.dumps({
                    "rel_path": str(pdf.relative_to(SFI_ROOT)),
                    "year": rec["year"],
                    "last_name": rec["last_name"],
                    "first_name": rec["first_name"],
                    "work_email": rec["work_email"],
                    "submitted": rec["submitted"],
                    "summary": rec["summary"],
                    "sections": rec["sections"],
                }, ensure_ascii=False) + "\n")
                n_total += 1
                now = time.time()
                if now - last_print > 5:
                    rate = n_total / (now - t0)
                    print(f"  {n_total} extracted, {rate:.1f}/s ({n_err} errors)", flush=True)
                    last_print = now

    dt = time.time() - t0
    print(f"DONE: {n_total} PDFs in {dt:.1f}s ({n_total/max(dt,1):.1f}/s), {n_err} errors")
    print(f"  master:  {master_path}")
    print(f"  jsonl :  {jsonl_path}")
    return 0


def run_one(path: Path) -> int:
    rec = extract_pdf(path)
    print(f"== {path}")
    print(f"name      : {rec['last_name']}, {rec['first_name']}")
    print(f"email     : {rec['work_email']}")
    print(f"submitted : {rec['submitted']}")
    print(f"pages     : {rec['n_pages']}")
    print("summary (only non-empty Q's):")
    for slug, val in rec["summary"].items():
        if val:
            print(f"  + {slug}")
    return 0


def run_sample(n: int) -> int:
    all_pdfs = list(SFI_ROOT.rglob("*.pdf"))
    sample = random.sample(all_pdfs, min(n, len(all_pdfs)))
    for p in sample:
        run_one(p)
        print()
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--sample", type=int, default=0)
    ap.add_argument("pdf", nargs="?", type=Path)
    args = ap.parse_args()

    if args.all:
        return run_all()
    if args.sample:
        return run_sample(args.sample)
    if args.pdf:
        return run_one(args.pdf)
    ap.error("supply a pdf path, --sample N, or --all")


if __name__ == "__main__":
    raise SystemExit(main())
