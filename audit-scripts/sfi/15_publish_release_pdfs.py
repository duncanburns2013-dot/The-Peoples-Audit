"""Publish the individual SFI PDFs as GitHub release assets.

WHY THIS EXISTS
---------------
`11_enhance_sfi_json.py` writes a per-filing `sourcePdfUrl` of the form

    https://github.com/<repo>/releases/download/sfi-<YYYY>/<Lastname>__<Firstname>.pdf

but the sfi-<YYYY> releases only ever received a single asset each: the ~1 GB
`sfi-<YYYY>.zip` bulk archive. Every one of the 29,729 per-filing PDF links in
the dashboard therefore 404'd. This script backfills the missing per-file
assets so those URLs resolve as designed.

It needs no local corpus: each year's PDFs are read straight out of that year's
already-published `sfi-<YYYY>.zip` release asset.

RATE LIMITS (measured, not assumed)
-----------------------------------
A release-asset upload costs ~2 REST requests. 29,729 files is therefore
~59,500 requests against a primary limit of 5,000/hr (PAT) or 1,000/hr
(GITHUB_TOKEN). No single run can finish the job, so this script is:

  * budget-aware  - it reads the live rate limit and stops while it still has
                    headroom, rather than dying half-way through a batch;
  * resumable     - the release's existing asset list is the source of truth,
                    so a re-run simply picks up whatever is still missing;
  * idempotent    - already-uploaded files are skipped, never re-uploaded.

Run it on a schedule until `--report` shows every year complete.

Usage:
    python 15_publish_release_pdfs.py            # upload within this hour's budget
    python 15_publish_release_pdfs.py --report   # show per-year progress, upload nothing
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

REPO = os.environ.get("SFI_REPO", "duncanburns2013-dot/The-Peoples-Audit")
TOKEN = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""
YEARS = ["2019", "2020", "2021", "2022", "2023", "2024", "2025"]

# Leave this many requests unspent so a run never trips the primary limit
# mid-upload and never starves an unrelated workflow of its budget.
BUDGET_RESERVE = 300
REQUESTS_PER_UPLOAD = 2

WORK = Path(os.environ.get("SFI_WORKDIR", ".cache/sfi-publish"))


def _req(url: str, *, method: str = "GET", data: bytes | None = None,
         content_type: str | None = None, accept: str = "application/vnd.github+json"):
    headers = {"Accept": accept, "X-GitHub-Api-Version": "2022-11-28"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    if content_type:
        headers["Content-Type"] = content_type
    return urllib.request.Request(url, method=method, data=data, headers=headers)


def api_json(url: str):
    with urllib.request.urlopen(_req(url)) as r:
        return json.load(r)


def rate_remaining() -> int:
    return api_json("https://api.github.com/rate_limit")["resources"]["core"]["remaining"]


def release_for(tag: str) -> dict:
    return api_json(f"https://api.github.com/repos/{REPO}/releases/tags/{tag}")


def existing_asset_names(release_id: int) -> set[str]:
    """Every asset name already attached to the release (paginated, 100/page)."""
    names: set[str] = set()
    page = 1
    while True:
        batch = api_json(
            f"https://api.github.com/repos/{REPO}/releases/{release_id}/assets"
            f"?per_page=100&page={page}"
        )
        if not batch:
            return names
        names.update(a["name"] for a in batch)
        if len(batch) < 100:
            return names
        page += 1


def zip_member_names(zip_url: str, total_size: int) -> list[str]:
    """List a remote zip's members by range-reading only its central directory.

    Avoids pulling ~1 GB just to find out which files a year still needs.
    """
    tail_len = min(2_000_000, total_size)
    tail = _range_get(zip_url, total_size - tail_len, total_size - 1)
    i = tail.rfind(b"PK\x05\x06")
    if i < 0:
        raise RuntimeError("zip end-of-central-directory not found")
    cd_size, cd_off = struct.unpack("<II", tail[i + 12:i + 20])
    cd = _range_get(zip_url, cd_off, cd_off + cd_size - 1)
    names, p = [], 0
    while p < len(cd) - 4 and cd[p:p + 4] == b"PK\x01\x02":
        nlen, elen, clen = struct.unpack("<HHH", cd[p + 28:p + 34])
        names.append(cd[p + 46:p + 46 + nlen].decode("utf-8", "replace"))
        p += 46 + nlen + elen + clen
    return names


def _range_get(url: str, start: int, end: int) -> bytes:
    r = _req(url, accept="application/octet-stream")
    r.add_header("Range", f"bytes={start}-{end}")
    with urllib.request.urlopen(r) as resp:
        return resp.read()


def download(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        return dest
    tmp = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(_req(url, accept="application/octet-stream")) as r, \
            tmp.open("wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    tmp.replace(dest)
    return dest


def upload_asset(release_id: int, name: str, blob: bytes) -> str:
    """POST one asset. Returns 'ok', 'exists', or raises after retries."""
    url = (f"https://uploads.github.com/repos/{REPO}/releases/{release_id}/assets"
           f"?name={urllib.parse.quote(name)}")
    for attempt in range(5):
        try:
            with urllib.request.urlopen(
                _req(url, method="POST", data=blob, content_type="application/pdf")
            ) as r:
                return "ok" if r.status in (200, 201) else f"http {r.status}"
        except urllib.error.HTTPError as e:
            body = e.read(400).decode("utf-8", "replace")
            # 422 = an asset with this name already exists. Treat as done.
            if e.code == 422 and "already_exists" in body:
                return "exists"
            # 403/429 = secondary rate limit. Back off and retry.
            if e.code in (403, 429):
                wait = int(e.headers.get("Retry-After") or 0) or (30 * (attempt + 1))
                print(f"    secondary limit on {name}; sleeping {wait}s", flush=True)
                time.sleep(wait)
                continue
            raise
    raise RuntimeError(f"upload failed after retries: {name}")


def survey() -> list[dict]:
    """Per-year: release id, zip asset, member names, what's still missing."""
    rows = []
    for year in YEARS:
        tag = f"sfi-{year}"
        rel = release_for(tag)
        zip_asset = next(
            (a for a in rel["assets"] if a["name"] == f"{tag}.zip"), None
        )
        if zip_asset is None:
            print(f"WARN {tag}: no {tag}.zip asset; skipping", file=sys.stderr)
            continue
        have = existing_asset_names(rel["id"])
        members = zip_member_names(zip_asset["url"], zip_asset["size"])
        want = {m.split("/")[-1]: m for m in members if m.lower().endswith(".pdf")}
        missing = {b: m for b, m in want.items() if b not in have}
        rows.append({
            "year": year, "tag": tag, "release_id": rel["id"],
            "zip_url": zip_asset["url"], "zip_size": zip_asset["size"],
            "total": len(want), "missing": missing,
        })
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true",
                    help="show progress only; upload nothing")
    args = ap.parse_args()

    if not TOKEN:
        print("ERR: set GH_TOKEN (needs contents:write on the repo)", file=sys.stderr)
        return 2

    rows = survey()
    print("\n  year   published / total   missing")
    for r in rows:
        done = r["total"] - len(r["missing"])
        print(f"  {r['year']}   {done:>6,} / {r['total']:<6,}   {len(r['missing']):>6,}")
    grand = sum(len(r["missing"]) for r in rows)
    print(f"  {'TOTAL':<6} {sum(r['total'] - len(r['missing']) for r in rows):>13,}"
          f" / {sum(r['total'] for r in rows):<6,}   {grand:>6,}\n")

    if args.report:
        return 0
    if grand == 0:
        print("Nothing missing — every per-filing PDF is published.")
        return 0

    budget = max(0, (rate_remaining() - BUDGET_RESERVE) // REQUESTS_PER_UPLOAD)
    print(f"Rate-limit budget this run: {budget:,} uploads")
    if budget < 1:
        print("No headroom left this hour; exiting cleanly so the next run resumes.")
        return 0

    uploaded = 0
    for r in rows:
        if uploaded >= budget or not r["missing"]:
            continue
        print(f"\n== {r['tag']}: {len(r['missing']):,} missing ==", flush=True)
        zip_path = download(r["zip_url"], WORK / f"{r['tag']}.zip")
        with zipfile.ZipFile(zip_path) as zf:
            for base, member in sorted(r["missing"].items()):
                if uploaded >= budget:
                    print("  budget reached; stopping cleanly", flush=True)
                    break
                blob = zf.read(member)
                if blob[:4] != b"%PDF":
                    print(f"  SKIP {base}: not a PDF", file=sys.stderr)
                    continue
                upload_asset(r["release_id"], base, blob)
                uploaded += 1
                if uploaded % 250 == 0:
                    print(f"  {uploaded:,}/{budget:,} uploaded", flush=True)
        # Free the runner's disk before moving to the next year.
        zip_path.unlink(missing_ok=True)

    print(f"\nUploaded {uploaded:,} assets this run. "
          f"{grand - uploaded:,} still to go.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
