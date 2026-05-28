"""Unzip MA SFI zip batches and rename each PDF to a canonical filename.

Source : C:\\PeoplesAudit\\decrypted\\SFI_Redacted_Files\\{YYYY}_SFI_Redacted_Files\\*.zip
Dest   : C:\\PeoplesAudit\\sfi\\{YYYY}\\{Lastname}__{Firstname}.pdf

The zip member names look like:
    Abati, Richard  _5-19-2026 9-10-33 AM.pdf
    AQUINO, JESSENIA L_5-19-2026 9-10-33 AM.pdf
    Allard-Madaus, Michael G.  _5-19-2026 9-10-33 AM.pdf

The portion BEFORE the export-timestamp suffix is the filer name as
"Lastname, Firstname [Middle...]". We canonicalize to
"Lastname__Firstname_Middle.pdf" so the original full name is reversible.
"""
from __future__ import annotations

import csv
import re
import sys
import zipfile
from pathlib import Path

SRC_ROOT = Path(r"C:\PeoplesAudit\decrypted\SFI_Redacted_Files")
DST_ROOT = Path(r"C:\PeoplesAudit\sfi")
OUT = Path(r"C:\PeoplesAudit\out")

# Strip the "_M-D-YYYY H-MM-SS AM/PM" timestamp tail. Names are sloppy: sometimes
# the underscore separator is preceded by trailing whitespace, sometimes not.
TS_RE = re.compile(r"\s*_\d{1,2}-\d{1,2}-\d{4}\s+\d{1,2}-\d{1,2}-\d{1,2}\s+[AP]M$", re.I)

INVALID = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def parse_name(zip_entry: str) -> tuple[str, str]:
    """Return (display_name, slug) for one PDF entry.

    display_name preserves the original "Lastname, Firstname M" form.
    slug is filesystem-safe: "Lastname__Firstname_M".
    """
    stem = zip_entry[:-4] if zip_entry.lower().endswith(".pdf") else zip_entry
    stem = TS_RE.sub("", stem).strip()
    # Now stem is "Lastname, Firstname [Middle]" with possibly double spaces.
    stem = re.sub(r"\s+", " ", stem)
    display = stem
    # Slug: replace ", " with "__", spaces with "_", strip invalid fs chars.
    slug = stem.replace(", ", "__")
    slug = slug.replace(" ", "_")
    slug = INVALID.sub("", slug)
    slug = slug.rstrip(".")  # Windows hates trailing dots
    return display, slug


def main() -> int:
    if not SRC_ROOT.is_dir():
        print(f"ERR: source not found: {SRC_ROOT}", file=sys.stderr)
        return 2

    DST_ROOT.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    manifest = OUT / "manifest.csv"
    with manifest.open("w", newline="", encoding="utf-8") as mf:
        w = csv.writer(mf)
        w.writerow([
            "year", "display_name", "slug", "rel_path",
            "source_zip", "source_entry", "bytes",
        ])

        for year_dir in sorted(SRC_ROOT.iterdir()):
            if not year_dir.is_dir():
                continue
            m = re.match(r"(\d{4})_SFI_Redacted_Files", year_dir.name)
            if not m:
                continue
            year = m.group(1)
            year_dst = DST_ROOT / year
            year_dst.mkdir(parents=True, exist_ok=True)

            zips = sorted(year_dir.glob("*.zip"))
            count = 0
            collisions = 0
            for zp in zips:
                with zipfile.ZipFile(zp) as zf:
                    for entry in zf.infolist():
                        if entry.is_dir() or not entry.filename.lower().endswith(".pdf"):
                            continue
                        display, slug = parse_name(entry.filename)
                        target = year_dst / f"{slug}.pdf"
                        if target.exists():
                            collisions += 1
                            # Append a numeric suffix so we keep both filings.
                            i = 2
                            while True:
                                cand = year_dst / f"{slug}__dup{i}.pdf"
                                if not cand.exists():
                                    target = cand
                                    break
                                i += 1
                        with zf.open(entry) as src, target.open("wb") as dst:
                            data = src.read()
                            dst.write(data)
                        w.writerow([
                            year, display, slug, str(target.relative_to(DST_ROOT)),
                            zp.name, entry.filename, entry.file_size,
                        ])
                        count += 1
            print(f"{year}: {count} PDFs extracted ({collisions} collisions)", flush=True)

    print(f"manifest: {manifest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
