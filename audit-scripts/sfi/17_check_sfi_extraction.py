"""Corpus invariants for SFI entity extraction. Fails loudly.

The `ownTopEmployer: "Income"` defect reached production and stayed there
because nothing checked the output. These are the checks that would have caught
it on day one — run them after any re-extraction, and in CI.

Usage:
    python 17_check_sfi_extraction.py            # check the committed JSON
    python 17_check_sfi_extraction.py --csv      # also check sfi_entities.csv
"""

from __future__ import annotations

import argparse
import collections
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sfi_parse as P  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SITE_JSON = ROOT / "public" / "data" / "ma-sfi.json"
ENTITIES_CSV = ROOT / "data" / "sfi" / "sfi_entities.csv"

ENTITY_FIELDS = [
    "ownTopEmployer",
    "spouseTopEmployer",
    "topMortgageCreditor",
]
PLACE_FIELDS = ["ownRealEstate", "spouseRealEstate"]

# A value equal to a column header is the exact shape of the original bug.
# Kept separate from FORBIDDEN_VALUES so the message can name the defect.
HEADER_SENTINELS = {"income", "position", "address", "business name", "self-employed",
                    "owner", "employer", "employee", "creditor name", "name of issuer"}


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", action="store_true")
    args = ap.parse_args()

    data = json.loads(SITE_JSON.read_text(encoding="utf-8"))
    filings = data["filings"]
    problems = 0

    print(f"filings: {len(filings):,}   extraction: "
          f"{data.get('entityExtractionVersion', 'UNSET')}\n")

    # 1. No entity value may be a column header.
    for field in ENTITY_FIELDS:
        vals = [f.get(field, "") for f in filings if f.get(field)]
        bad = collections.Counter(v for v in vals if v.strip().lower() in HEADER_SENTINELS)
        pct = (sum(bad.values()) / len(vals) * 100) if vals else 0.0
        status = "ok" if not bad else "FAIL"
        print(f"  [{status}] {field:<22} {len(vals):>6,} non-empty, "
              f"{sum(bad.values()):>5,} header artifacts ({pct:.1f}%)")
        if bad:
            problems += 1
            for v, n in bad.most_common(3):
                print(f"           {n:>6,}x {v!r}")

    # 2. Place fields must look like municipalities, not amounts or codes.
    for field in PLACE_FIELDS:
        vals = [f.get(field, "") for f in filings if f.get(field)]
        bad = [v for v in vals if v.strip().lower() in P.FORBIDDEN_VALUES
               or v.strip().startswith("$") or v.strip().isdigit()]
        status = "ok" if not bad else "FAIL"
        print(f"  [{status}] {field:<22} {len(vals):>6,} non-empty, {len(bad):>5,} suspect")
        if bad:
            problems += 1
            print(f"           e.g. {bad[:3]}")

    # 3. Extraction must actually produce something. A parser that silently
    #    returns empty for everything would satisfy checks 1 and 2 perfectly.
    filled = sum(1 for f in filings if f.get("ownTopEmployer") or f.get("spouseTopEmployer"))
    rate = filled / len(filings) * 100 if filings else 0
    ok = rate >= 20.0
    print(f"\n  [{'ok' if ok else 'FAIL'}] employer fill rate: {filled:,}/{len(filings):,} "
          f"({rate:.1f}%) — must be >= 20%, else extraction has gone silent")
    if not ok:
        problems += 1

    if args.csv and ENTITIES_CSV.exists():
        rows = list(csv.DictReader(ENTITIES_CSV.open(encoding="utf-8")))
        bad = [r for r in rows if r["value"].strip().lower() in HEADER_SENTINELS]
        print(f"\n  [{'ok' if not bad else 'FAIL'}] sfi_entities.csv: {len(rows):,} rows, "
              f"{len(bad):,} header artifacts")
        if bad:
            problems += 1
        byq = collections.Counter(r["slug_name"] for r in rows)
        print("\n  entities per question:")
        for k, v in byq.most_common(12):
            print(f"    {k:<32} {v:>7,}")

    print(f"\n{'PASS — all invariants hold' if not problems else f'{problems} INVARIANT(S) VIOLATED'}")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
