"""Summarize sfi_master.csv: rates per question, top-employer histograms, etc."""
from __future__ import annotations

import csv
from collections import Counter, defaultdict
from pathlib import Path

MASTER = Path(r"C:\PeoplesAudit\out\sfi_master.csv")
OUT = Path(r"C:\PeoplesAudit\out")


def main() -> int:
    by_year: dict[str, int] = Counter()
    flags: dict[str, Counter] = defaultdict(Counter)  # slug -> Counter({"1": n, "0": n})
    email_domains: Counter = Counter()
    unique_names: dict[str, set] = defaultdict(set)

    with MASTER.open(encoding="utf-8") as f:
        r = csv.DictReader(f)
        slugs = [k for k in r.fieldnames if k not in (
            "year", "last_name", "first_name", "work_email", "submitted",
            "n_pages", "rel_path",
        )]
        for row in r:
            y = row["year"]
            by_year[y] += 1
            for s in slugs:
                flags[s][row[s]] += 1
            if "@" in (row.get("work_email") or ""):
                email_domains[row["work_email"].split("@", 1)[1].lower()] += 1
            unique_names[y].add(f"{row['last_name']}|{row['first_name']}".lower())

    print(f"Total filings:  {sum(by_year.values())}")
    print("Per year:")
    for y in sorted(by_year):
        print(f"  {y}: {by_year[y]:>5}  unique filers: {len(unique_names[y]):>5}")

    print("\nQuestion fill-rates (% with non-'none' content, sorted high to low):")
    rate_rows = []
    total = sum(by_year.values())
    for s in slugs:
        n = flags[s]["1"]
        rate_rows.append((n / total, n, s))
    rate_rows.sort(reverse=True)
    for pct, n, s in rate_rows:
        print(f"  {pct*100:5.1f}%  {n:>5}  {s}")

    print("\nTop 20 work-email domains:")
    for dom, c in email_domains.most_common(20):
        print(f"  {c:>5}  {dom}")

    # Write per-year fill-rate CSV
    by_year_fill = OUT / "fill_rates_by_year.csv"
    with by_year_fill.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["year", "slug", "count_yes", "pct_yes"])
        # Re-read once more to compute per-year.
        per_year_flags: dict[tuple[str, str], int] = Counter()
        with MASTER.open(encoding="utf-8") as f2:
            r2 = csv.DictReader(f2)
            for row in r2:
                y = row["year"]
                for s in slugs:
                    if row[s] == "1":
                        per_year_flags[(y, s)] += 1
        for y in sorted(by_year):
            for s in slugs:
                n = per_year_flags[(y, s)]
                pct = n / max(by_year[y], 1)
                w.writerow([y, s, n, f"{pct:.4f}"])
    print(f"\nwrote {by_year_fill}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
