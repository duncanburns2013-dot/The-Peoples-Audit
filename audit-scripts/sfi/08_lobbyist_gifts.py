"""Extract the Q36/Q36.a/Q37/Q37.a/Q38/Q39 disclosure rows.

These are the highest-signal sections of an SFI: every entry is a public
official telling the State Ethics Commission that a lobbyist (or a person
with a direct interest in a matter before the official's body) gave the
official OR the official's spouse a reimbursement, gift, or honorarium
worth more than $100.

Output:
  out/sfi_lobbyist_gifts.csv  one row per (filer, year, section, raw body)
  out/sfi_lobbyist_gifts.json same data for the web UI
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

OUT = Path(r"C:\PeoplesAudit\out")
SFI_JSONL = OUT / "sfi_text.jsonl"

GIFT_QS = {
    "36":   ("own", "lobbyist_reimbursement"),
    "36.a": ("own", "interested_party_reimbursement"),
    "37":   ("spouse", "lobbyist_reimbursement"),
    "37.a": ("spouse", "interested_party_reimbursement"),
    "38":   ("own", "gift_honorarium"),
    "39":   ("spouse", "gift_honorarium"),
}

NONE_RE = re.compile(r"\bFiler\s+reported\s+none\.", re.IGNORECASE)
WS_RE = re.compile(r"\s+")


def clean_body(text: str) -> str:
    """Strip the question-prompt prose and collapse whitespace.

    The question prompts repeat substantial boilerplate ("Identify any
    Reimbursements for expenses in excess of $100 ..."). We strip the leading
    prompt up through the first newline-separated value chunk.
    """
    # Drop the trailing "Original Page N of N" footer.
    text = re.sub(r"Original\s+Page\s+\d+\s+of\s+\d+\s*", "", text)
    # Collapse whitespace.
    text = WS_RE.sub(" ", text).strip()
    return text


def main() -> int:
    rows: list[dict] = []
    with SFI_JSONL.open(encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            for q, (subject, kind) in GIFT_QS.items():
                body = rec["sections"].get(q, "")
                if not body or NONE_RE.search(body):
                    continue
                rows.append({
                    "year": rec["year"],
                    "last_name": rec["last_name"],
                    "first_name": rec["first_name"],
                    "work_email": rec["work_email"],
                    "rel_path": rec["rel_path"].replace("\\", "/"),
                    "section": q,
                    "subject": subject,
                    "kind": kind,
                    "body": clean_body(body),
                })

    csv_out = OUT / "sfi_lobbyist_gifts.csv"
    with csv_out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {csv_out} ({len(rows)} rows)")

    # JSON version, sorted: spouse/own then by year, with one row per filer-year
    # collapsing multiple sections.
    by_filer_year: dict[tuple, dict] = {}
    for r in rows:
        key = (r["year"], r["last_name"], r["first_name"])
        if key not in by_filer_year:
            by_filer_year[key] = {
                "year": r["year"],
                "lastName": r["last_name"],
                "firstName": r["first_name"],
                "workEmail": r["work_email"],
                "pdfPath": r["rel_path"],
                "sections": [],
            }
        by_filer_year[key]["sections"].append({
            "section": r["section"],
            "subject": r["subject"],
            "kind": r["kind"],
            "body": r["body"][:2000],  # truncate to keep JSON manageable
        })

    json_out = OUT / "sfi_lobbyist_gifts.json"
    payload = {
        "fetchedAt": "2026-05-27T20:30:00Z",
        "count": len(by_filer_year),
        "totalSectionRows": len(rows),
        "rows": list(by_filer_year.values()),
    }
    json_out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"wrote {json_out} ({len(by_filer_year)} unique filer-years)")

    # Print top-stats.
    from collections import Counter
    by_kind = Counter()
    for r in rows:
        by_kind[(r["subject"], r["kind"])] += 1
    print("\nBy (subject, kind):")
    for (subj, k), n in by_kind.most_common():
        print(f"  {subj:7s}  {k:35s}  {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
