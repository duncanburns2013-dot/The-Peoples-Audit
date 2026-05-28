"""Cross-reference SFI filings against HHS-MA-DOGE fraud-flag data.

Three passes:
  1. SFI filer name vs DOGE authorized_official  (exact-ish name match)
  2. Top DOGE entity names vs SFI section text   (substring scan)
  3. SFI section text vs DOGE flagged addresses  (ZIP+street-number scan)
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

SFI_DIR = Path(r"C:\PeoplesAudit\out")
DOGE_DIR = Path(r"C:\Users\dunca\HHS-MA-DOGE")
OUT = SFI_DIR / "crossref"
OUT.mkdir(parents=True, exist_ok=True)

SFI_MASTER = SFI_DIR / "sfi_master.csv"
SFI_JSONL = SFI_DIR / "sfi_text.jsonl"
DOGE_OFFICIALS = DOGE_DIR / "fraud_flags_shared_officials.csv"
DOGE_SUMMARY = DOGE_DIR / "fraud_flags_summary.csv"
DOGE_ADDRESSES = DOGE_DIR / "fraud_flags_shared_addresses.csv"


def norm_name(last: str, first: str) -> str:
    """Normalize "Last, First Middle..." to "LAST, FIRST" (drop middle/suffix)."""
    last = re.sub(r"[^A-Za-z\- ]", "", last).strip().upper()
    # Drop middle initial: take first whitespace-delimited token of first name.
    fparts = first.strip().split()
    first0 = re.sub(r"[^A-Za-z\-]", "", fparts[0]).upper() if fparts else ""
    return f"{last}, {first0}" if last and first0 else ""


def pass1_filer_vs_official() -> None:
    """SFI filer name vs DOGE authorized_official.

    Two outputs:
      pass1_filer_vs_doge_official.csv          : every per-NPI hit row
      pass1_filer_vs_doge_official_grouped.csv  : one row per (filer-name, year)
                                                  with aggregated DOGE info
    """
    # Build {normalized_name -> list of DOGE rows}
    doge_by_name: dict[str, list[dict]] = defaultdict(list)
    with DOGE_OFFICIALS.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            raw = row["authorized_official"].strip().strip('"')
            if "," not in raw:
                continue
            last, rest = raw.split(",", 1)
            fparts = rest.strip().split()
            first0 = re.sub(r"[^A-Za-z\-]", "", fparts[0]).upper() if fparts else ""
            key = f"{last.strip().upper()}, {first0}" if last and first0 else ""
            if key:
                doge_by_name[key].append(row)

    print(f"DOGE officials: {len(doge_by_name)} unique normalized names")

    # Count SFI filers per normalized name across all years — gives us a
    # "name commonness" signal we can flag.
    sfi_name_count: dict[str, int] = Counter()
    with SFI_MASTER.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            key = norm_name(row["last_name"], row["first_name"])
            if key:
                sfi_name_count[key] += 1

    # Walk SFI master to find matches.
    raw_rows: list[dict] = []
    grouped: dict[tuple, dict] = {}
    seen_pairs: set = set()
    with SFI_MASTER.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            key = norm_name(row["last_name"], row["first_name"])
            if not key or key not in doge_by_name:
                continue
            for d in doge_by_name[key]:
                pair = (key, d["npi"], row["year"])
                if pair in seen_pairs:
                    continue
                seen_pairs.add(pair)
                raw_rows.append({
                    "match_kind": "filer_eq_doge_official",
                    "sfi_year": row["year"],
                    "sfi_last": row["last_name"],
                    "sfi_first": row["first_name"],
                    "sfi_email": row["work_email"],
                    "sfi_path": row["rel_path"],
                    "norm_key": key,
                    "name_commonness_in_sfi": sfi_name_count[key],
                    "doge_official": d["authorized_official"],
                    "doge_npi": d["npi"],
                    "doge_org": d["org_name"],
                    "doge_address": d["address"],
                    "doge_city": d["city"],
                    "doge_zip": d["zip"],
                    "doge_npi_spending": d["npi_spending"],
                })
                gkey = (key, row["year"])
                if gkey not in grouped:
                    grouped[gkey] = {
                        "sfi_year": row["year"],
                        "sfi_last": row["last_name"],
                        "sfi_first": row["first_name"],
                        "sfi_email": row["work_email"],
                        "sfi_path": row["rel_path"],
                        "norm_key": key,
                        "name_commonness_in_sfi": sfi_name_count[key],
                        "doge_n_npis": 0,
                        "doge_total_spending": 0.0,
                        "doge_orgs": set(),
                        "doge_cities": set(),
                    }
                g = grouped[gkey]
                g["doge_n_npis"] += 1
                try:
                    g["doge_total_spending"] += float(d["npi_spending"] or 0)
                except ValueError:
                    pass
                g["doge_orgs"].add(d["org_name"][:120])
                g["doge_cities"].add(d["city"])

    out = OUT / "pass1_filer_vs_doge_official.csv"
    with out.open("w", newline="", encoding="utf-8") as f:
        if raw_rows:
            w = csv.DictWriter(f, fieldnames=list(raw_rows[0].keys()))
            w.writeheader()
            w.writerows(raw_rows)

    # Sort grouped by total spending descending; serialize sets to pipe-strings.
    grouped_rows = []
    for g in grouped.values():
        g["doge_orgs"] = " | ".join(sorted(g["doge_orgs"]))
        g["doge_cities"] = " | ".join(sorted(g["doge_cities"]))
        grouped_rows.append(g)
    grouped_rows.sort(key=lambda r: -r["doge_total_spending"])

    out2 = OUT / "pass1_filer_vs_doge_official_grouped.csv"
    with out2.open("w", newline="", encoding="utf-8") as f:
        if grouped_rows:
            w = csv.DictWriter(f, fieldnames=list(grouped_rows[0].keys()))
            w.writeheader()
            w.writerows(grouped_rows)
    print(f"Pass 1: {len(raw_rows)} raw hits across {len(grouped_rows)} (name, year) groups -> {out}, {out2}")


def pass2_top_entities_vs_sfi_text(top_n: int = 100) -> None:
    """Top-N DOGE entities (by total_paid) vs SFI section text (substring)."""
    # Get top-N entity names from summary.
    entities: list[tuple[str, dict]] = []
    seen_names: set = set()
    with DOGE_SUMMARY.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            # entity_names is a pipe-delimited list with duplicates inside one row.
            for name in row["entity_names"].split("|"):
                name = name.strip().strip('"').strip()
                if not name or name in seen_names:
                    continue
                seen_names.add(name)
                entities.append((name, row))
            if len(seen_names) >= top_n:
                break

    print(f"Top-N DOGE entities to scan: {len(entities)}")

    # Build search patterns — case-insensitive substring after normalizing
    # whitespace and stripping trailing commas/Inc/LLC for fuzzier match.
    patterns: list[tuple[re.Pattern, str, dict]] = []
    for name, row in entities:
        # Build core: drop "INC.", "INC", "LLC", trailing punctuation.
        core = re.sub(r"[,.]\s*(INC\.?|LLC|LP|CORP\.?|CO\.?)$", "", name, flags=re.I)
        core = core.strip().strip(",")
        if len(core) < 6:
            continue
        # Word-boundary substring, case insensitive.
        pat = re.compile(r"\b" + re.escape(core) + r"\b", re.I)
        patterns.append((pat, name, row))

    matches: list[dict] = []
    n_scanned = 0
    with SFI_JSONL.open(encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            n_scanned += 1
            haystack_pieces = []
            for q, body in rec["sections"].items():
                if body and "Filer reported none" not in body:
                    haystack_pieces.append((q, body))
            if not haystack_pieces:
                continue
            for pat, name, drow in patterns:
                for q, body in haystack_pieces:
                    if pat.search(body):
                        matches.append({
                            "match_kind": "doge_entity_in_sfi_text",
                            "sfi_year": rec["year"],
                            "sfi_last": rec["last_name"],
                            "sfi_first": rec["first_name"],
                            "sfi_email": rec["work_email"],
                            "sfi_path": rec["rel_path"],
                            "sfi_question": q,
                            "doge_entity": name,
                            "doge_address": drow["address"],
                            "doge_city": drow["city"],
                            "doge_zip": drow["zip"],
                            "doge_total_paid": drow["total_paid"],
                            "doge_auth_officials": drow["auth_officials"],
                        })
                        # Don't double-count the same entity across multiple Q's
                        # within one filing; just keep the first hit per (filing, entity).
                        break
            if n_scanned % 5000 == 0:
                print(f"  scanned {n_scanned} filings, {len(matches)} hits so far")

    out = OUT / "pass2_doge_entity_in_sfi.csv"
    with out.open("w", newline="", encoding="utf-8") as f:
        if matches:
            w = csv.DictWriter(f, fieldnames=list(matches[0].keys()))
            w.writeheader()
            w.writerows(matches)
    print(f"Pass 2: {len(matches)} matches -> {out}")


# Sections we trust for "filer / spouse owns property at this address."
# (Other sections — mortgages, business employer addresses — generate too much
# noise because creditor offices and downtown employers naturally cluster with
# whatever DOGE-flagged entities are nearby.)
ADDR_SECTIONS_OWNERSHIP = {"13", "14", "15", "16"}
ADDR_SECTIONS_TRANSFERS = {"17", "18", "19", "20"}


STREET_TYPE_RE = re.compile(
    r"\b(STREET|ST|ROAD|RD|AVENUE|AVE|DRIVE|DR|BOULEVARD|BLVD|LANE|LN|"
    r"WAY|COURT|CT|PLACE|PL|HIGHWAY|HWY|PARKWAY|PKWY|CIRCLE|CIR|"
    r"TERRACE|TER|SQUARE|SQ|TURNPIKE|TPKE|TPK|ROW|TRAIL|TRL)\.?$",
    re.IGNORECASE,
)


def first_street_token(addr: str) -> str:
    """From '500 LYNNFIELD ST APT 4' return 'LYNNFIELD'.

    Takes the first alpha token after the leading number, normalized upper.
    """
    m = re.match(r"^\s*\d+\s+([A-Za-z]+)", addr)
    return m.group(1).upper() if m else ""


def pass3_doge_addresses_vs_sfi() -> None:
    """DOGE flagged addresses vs SFI section text.

    Strategy: build a set of (street_number, first_street_word, zip5) tuples
    from DOGE addresses. For each SFI filing, regex out address-shaped strings
    in real-estate / mortgage / business sections and require the street
    *name* matches in addition to street number + ZIP5.
    """
    addr_keys: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    with DOGE_ADDRESSES.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            addr = row["address"].strip().upper()
            m = re.match(r"^(\d+)\s+", addr)
            if not m:
                continue
            num = m.group(1)
            zip5 = (row["zip"] or "")[:5]
            street = first_street_token(addr)
            if not zip5 or not street:
                continue
            addr_keys[(num, street, zip5)].append(row)

    print(f"DOGE address (num, street, zip5) keys: {len(addr_keys)}")

    # SFI scan: find candidate addresses in section text.
    # Address patterns we see in SFI text examples:
    #   "1218 Harvard Rd., Shirley, MA, 01464, US"
    #   "8950 Cypress Waters Blvd., Coppell, TX, 75019, US"
    ADDR_RE = re.compile(
        r"(\d+)\s+[A-Z][\w\.\-' ]{2,80}?,\s+[A-Z][\w\. \-]{2,30}?,\s+([A-Z]{2}),\s+(\d{5})",
        re.IGNORECASE,
    )

    matches: list[dict] = []
    # Dedupe by (filer-key, doge_address, year, kind) so one filing doesn't emit
    # 24 rows just because the DOGE address backs 24 NPIs.
    seen: set = set()
    n_scanned = 0
    with SFI_JSONL.open(encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            n_scanned += 1
            for q, kind in (
                *[(q, "ownership") for q in ADDR_SECTIONS_OWNERSHIP],
                *[(q, "transfer") for q in ADDR_SECTIONS_TRANSFERS],
            ):
                body = rec["sections"].get(q, "")
                if not body or "Filer reported none" in body:
                    continue
                for m in ADDR_RE.finditer(body):
                    num, state, zip5 = m.group(1), m.group(2).upper(), m.group(3)
                    if state != "MA":
                        continue
                    sfi_street = first_street_token(m.group(0))
                    if not sfi_street:
                        continue
                    key = (num, sfi_street, zip5)
                    if key not in addr_keys:
                        continue
                    drow = addr_keys[key][0]  # one canonical DOGE row per address
                    dedup = (
                        rec["last_name"], rec["first_name"], rec["year"],
                        drow["address"], drow["zip"], kind, q,
                    )
                    if dedup in seen:
                        continue
                    seen.add(dedup)
                    matches.append({
                        "match_kind": f"sfi_{kind}_addr_in_doge_flagged",
                        "sfi_year": rec["year"],
                        "sfi_last": rec["last_name"],
                        "sfi_first": rec["first_name"],
                        "sfi_email": rec["work_email"],
                        "sfi_path": rec["rel_path"],
                        "sfi_question": q,
                        "sfi_address_match": m.group(0),
                        "doge_address": drow["address"],
                        "doge_city": drow["city"],
                        "doge_zip": drow["zip"],
                        "doge_entity": drow["entity_name"],
                        "doge_official": drow["auth_official"],
                        "doge_total_at_addr": drow["total_paid_at_address"],
                        "doge_n_entities_at_addr": drow["npis_at_address"],
                    })
            if n_scanned % 5000 == 0:
                print(f"  scanned {n_scanned} filings, {len(matches)} hits so far")

    out = OUT / "pass3_sfi_addr_in_doge.csv"
    with out.open("w", newline="", encoding="utf-8") as f:
        if matches:
            w = csv.DictWriter(f, fieldnames=list(matches[0].keys()))
            w.writeheader()
            w.writerows(matches)
    print(f"Pass 3: {len(matches)} matches -> {out}")


def main() -> int:
    print("=== Pass 1: SFI filer name == DOGE authorized_official ===")
    pass1_filer_vs_official()
    print()
    print("=== Pass 2: Top DOGE entities substring-scan SFI text ===")
    pass2_top_entities_vs_sfi_text()
    print()
    print("=== Pass 3: DOGE flagged MA addresses vs SFI section text ===")
    pass3_doge_addresses_vs_sfi()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
