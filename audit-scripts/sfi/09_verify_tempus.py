"""Independent verification of every Tempus Q7 hit.

For each row in pass2_doge_entity_in_sfi.csv:
  - Open the actual PDF.
  - Independently extract Q7 text from the live PDF (not from the cached JSONL).
  - Grep for case-insensitive "tempus".
  - Report verdict: VERIFIED / NO-MATCH / FILE-MISSING.
  - Capture a 200-char excerpt around the Tempus hit.

Outputs:
  out/verify/tempus_verified.csv     one row per (filer, year, verdict, excerpt)
  out/verify/tempus_verified.md      human-readable per-filer summary
"""
from __future__ import annotations

import csv
import re
from pathlib import Path

import fitz  # PyMuPDF

OUT = Path(r"C:\PeoplesAudit\out\verify")
OUT.mkdir(parents=True, exist_ok=True)

SFI_ROOT = Path(r"C:\PeoplesAudit\sfi")
PASS2_CSV = Path(r"C:\PeoplesAudit\out\crossref\pass2_doge_entity_in_sfi.csv")

# Same Q-split regex as 02_extract_text.py — keep in lockstep.
QUESTION_RE = re.compile(r"^\s*(\d{1,2}(?:\.[a-z])?)\.?\s+(?=[A-Z])", re.MULTILINE)
VALID_Q = set(str(i) for i in range(1, 41)) | {"36.a", "37.a"}


def extract_q7_text(pdf_path: Path) -> str:
    """Return Q7 section body, fresh from the PDF (no JSONL cache)."""
    doc = fitz.open(pdf_path)
    try:
        full = "\n".join(p.get_text("text") for p in doc)
    finally:
        doc.close()
    matches = [m for m in QUESTION_RE.finditer(full) if m.group(1) in VALID_Q]
    sections = {}
    for idx, m in enumerate(matches):
        qn = m.group(1)
        if qn in sections:
            continue
        start = m.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(full)
        sections[qn] = full[start:end]
    return sections.get("7", "")


def make_excerpt(text: str, needle: str = "tempus", width: int = 220) -> str:
    idx = text.lower().find(needle.lower())
    if idx < 0:
        return ""
    start = max(0, idx - 40)
    end = min(len(text), idx + width)
    excerpt = text[start:end]
    return re.sub(r"\s+", " ", excerpt).strip()


def main() -> int:
    rows: list[dict] = []
    with PASS2_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if "TEMPUS" not in row["doge_entity"].upper():
                continue
            pdf = SFI_ROOT / row["sfi_path"]
            if not pdf.exists():
                rows.append({
                    "year": row["sfi_year"],
                    "filer": f"{row['sfi_last']}, {row['sfi_first']}",
                    "email": row["sfi_email"],
                    "pdf": row["sfi_path"],
                    "verdict": "FILE-MISSING",
                    "excerpt": "",
                })
                continue
            try:
                q7 = extract_q7_text(pdf)
            except Exception as e:
                rows.append({
                    "year": row["sfi_year"],
                    "filer": f"{row['sfi_last']}, {row['sfi_first']}",
                    "email": row["sfi_email"],
                    "pdf": row["sfi_path"],
                    "verdict": f"EXTRACT-ERROR: {e}",
                    "excerpt": "",
                })
                continue
            verdict = "VERIFIED" if "tempus" in q7.lower() else "NO-MATCH-Q7"
            rows.append({
                "year": row["sfi_year"],
                "filer": f"{row['sfi_last']}, {row['sfi_first']}",
                "email": row["sfi_email"],
                "pdf": row["sfi_path"],
                "verdict": verdict,
                "excerpt": make_excerpt(q7),
            })

    # Write CSV
    csv_out = OUT / "tempus_verified.csv"
    with csv_out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    # Write human-readable MD
    md_out = OUT / "tempus_verified.md"
    with md_out.open("w", encoding="utf-8") as f:
        # Summary
        from collections import Counter
        verdicts = Counter(r["verdict"] for r in rows)
        f.write(f"# Tempus Q7 verification report\n\n")
        f.write(f"Total Pass-2 Tempus rows checked: {len(rows)}\n\n")
        for v, n in verdicts.most_common():
            f.write(f"- {v}: {n}\n")
        f.write("\n## Per-row verdicts\n\n")
        # Group by filer
        by_filer: dict[str, list] = {}
        for r in rows:
            by_filer.setdefault(r["filer"], []).append(r)
        for filer in sorted(by_filer):
            f.write(f"### {filer}\n")
            for r in sorted(by_filer[filer], key=lambda x: x["year"]):
                badge = "✓" if r["verdict"] == "VERIFIED" else "✗"
                f.write(f"- {badge} **{r['year']}** ({r['verdict']}) — `{r['pdf']}`\n")
                if r["excerpt"]:
                    f.write(f"  > {r['excerpt']}\n")
            f.write("\n")

    print(f"wrote {csv_out}")
    print(f"wrote {md_out}")
    print()
    from collections import Counter
    for v, n in Counter(r["verdict"] for r in rows).most_common():
        print(f"  {v}: {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
