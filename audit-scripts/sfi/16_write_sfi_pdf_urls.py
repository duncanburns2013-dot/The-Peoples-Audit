"""Rewrite `sourcePdfUrl` in public/data/ma-sfi.json from what is actually published.

Why this is a separate step: a filing's PDF URL cannot be derived from the
filing alone. GitHub caps a release at 1000 assets, so each year's PDFs are
spread over several releases (`sfi-<YYYY>`, `sfi-<YYYY>-p1`, ...) and which
shard a given filing landed in depends on upload order. This script asks the
releases where everything actually is and writes that back, so the front end
needs no knowledge of sharding.

Filings with no published asset get **no** `sourcePdfUrl` at all. SfiExplorer
renders the PDF button only when the field is truthy, so an unpublished filing
shows no button instead of a dead one. That is the honest degradation while
15_publish_release_pdfs.py is still working through the backlog.

Run after 15_publish_release_pdfs.py, then commit public/data/ma-sfi.json.

Usage:
    python 16_write_sfi_pdf_urls.py            # rewrite the file
    python 16_write_sfi_pdf_urls.py --dry-run  # report only, write nothing
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = os.environ.get("SFI_REPO", "duncanburns2013-dot/The-Peoples-Audit")
TOKEN = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""
YEARS = ["2019", "2020", "2021", "2022", "2023", "2024", "2025"]

SITE_JSON = Path(__file__).resolve().parents[2] / "public" / "data" / "ma-sfi.json"

# Must stay identical to safe_asset_name() in 15_publish_release_pdfs.py.
_UNSAFE = re.compile(r"[^A-Za-z0-9._-]")


def safe_asset_name(basename: str) -> str:
    return _UNSAFE.sub(".", basename)


def api_json(url: str):
    headers = {"Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers)) as r:
        return json.load(r)


def published_urls() -> dict[tuple[str, str], str]:
    """(year, asset name) -> browser_download_url, across every shard of every year.

    Keyed by year as well as name: the same person files in multiple years, so
    `Aalto__Joanna_B.pdf` exists once per year. Keying on the name alone hands
    the 2019 PDF to that filer's 2020-2025 rows too.
    """
    urls: dict[tuple[str, str], str] = {}
    for year in YEARS:
        shard = 0
        while True:
            tag = f"sfi-{year}" if shard == 0 else f"sfi-{year}-p{shard}"
            try:
                rel = api_json(f"https://api.github.com/repos/{REPO}/releases/tags/{tag}")
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    break
                raise
            page = 1
            while True:
                batch = api_json(
                    f"https://api.github.com/repos/{REPO}/releases/{rel['id']}"
                    f"/assets?per_page=100&page={page}"
                )
                for a in batch:
                    if a["name"].lower().endswith(".pdf"):
                        urls[(year, a["name"])] = a["browser_download_url"]
                if len(batch) < 100:
                    break
                page += 1
            shard += 1
    return urls


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    urls = published_urls()
    print(f"Published PDF assets found: {len(urls):,}")

    data = json.loads(SITE_JSON.read_text(encoding="utf-8"))
    filings = data["filings"]

    linked = missing = changed = 0
    for f in filings:
        rel = f["relPath"].replace("\\", "/")
        base = Path(rel).name
        # relPath is "<YYYY>/<slug>.pdf"; fall back to the filing's own year.
        year = rel.split("/")[0] if "/" in rel else str(f.get("filingYear", ""))
        url = urls.get((year, safe_asset_name(base)))
        before = f.get("sourcePdfUrl")
        if url:
            f["sourcePdfUrl"] = url
            linked += 1
        else:
            f.pop("sourcePdfUrl", None)
            missing += 1
        if f.get("sourcePdfUrl") != before:
            changed += 1

    print(f"  filings with a working PDF link : {linked:,}")
    print(f"  filings with no asset yet       : {missing:,}")
    print(f"  sourcePdfUrl values changed     : {changed:,}")

    if args.dry_run:
        print("\n--dry-run: nothing written.")
        return 0

    data["pdfLinksPublished"] = linked
    SITE_JSON.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(f"\nWrote {SITE_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
