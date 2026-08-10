"""Publish the individual SFI PDFs as GitHub release assets.

WHY THIS EXISTS
---------------
`11_enhance_sfi_json.py` gives every filing a `sourcePdfUrl` pointing at a
per-file release asset, but the sfi-<YYYY> releases only ever received one
asset each: the ~1 GB `sfi-<YYYY>.zip` bulk archive. All 29,729 per-filing PDF
links 404'd. This script backfills the missing per-file assets.

It needs no local corpus — each year's PDFs are read straight out of that
year's already-published `sfi-<YYYY>.zip`, whose members are STORED (not
deflated), so extraction is a byte copy.

TWO GITHUB LIMITS SHAPE THIS (both found the hard way, at volume)
-----------------------------------------------------------------
1. A release holds at most **1000 assets**:

       {"resource":"ReleaseAsset","code":"custom","field":"file_count",
        "message":"file_count limited to 1000 assets per release"}

   Each year has 4,054-4,419 filings, so a year needs five releases. The
   original `sfi-<YYYY>` release is shard 0 (it also carries the bulk zip);
   overflow goes to `sfi-<YYYY>-p1`, `-p2`, ... created on demand.

2. GitHub **renames** asset filenames containing special characters, and only
   tells you via the returned/listed name. `Casey_O'Brien__Pamela_A.pdf` came
   back as `Casey_O.Brien__Pamela_A.pdf`, so the site's link still 404'd even
   though the upload "succeeded". 473 of 29,729 filings (1.6%) are affected -
   mostly apostrophes, plus parentheses, commas and accents.

   Fix: sanitize the name ourselves *before* upload, to the character set
   GitHub leaves alone. Verified that a pre-sanitized name is stored verbatim,
   which makes the resulting URL predictable instead of discovered.

RATE LIMITS (measured, not assumed)
-----------------------------------
A release-asset upload costs ~2 REST requests - identical via `gh` and via the
raw API, so the CLI is not the overhead. 29,729 filings need ~59,500 requests
against a primary limit of 5,000/hr (PAT) or 1,000/hr (GITHUB_TOKEN), so no
single run can finish. This script is therefore budget-aware, resumable and
idempotent; run it repeatedly rather than longer.

`16_write_sfi_pdf_urls.py` then rewrites the site's `sourcePdfUrl` values from
whatever is actually published.

Usage:
    python 15_publish_release_pdfs.py            # upload within this hour's budget
    python 15_publish_release_pdfs.py --report   # show per-year progress only
"""

from __future__ import annotations

import argparse
import json
import os
import re
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

ASSETS_PER_RELEASE = 1000
BUDGET_RESERVE = 300          # requests left unspent so a run never trips the limit
REQUESTS_PER_UPLOAD = 2       # measured

WORK = Path(os.environ.get("SFI_WORKDIR", ".cache/sfi-publish"))

# The character set GitHub leaves untouched. Anything else it silently rewrites,
# so we rewrite it first and keep the URL predictable.
_UNSAFE = re.compile(r"[^A-Za-z0-9._-]")


def safe_asset_name(basename: str) -> str:
    """The name GitHub will store verbatim. Must match 16_write_sfi_pdf_urls.py."""
    return _UNSAFE.sub(".", basename)


def _req(url: str, *, method: str = "GET", data: bytes | None = None,
         content_type: str | None = None, accept: str = "application/vnd.github+json"):
    headers = {"Accept": accept, "X-GitHub-Api-Version": "2022-11-28"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    if content_type:
        headers["Content-Type"] = content_type
    return urllib.request.Request(url, method=method, data=data, headers=headers)


def api_json(url: str, *, method: str = "GET", payload: dict | None = None):
    data = json.dumps(payload).encode() if payload is not None else None
    ct = "application/json" if payload is not None else None
    with urllib.request.urlopen(_req(url, method=method, data=data, content_type=ct)) as r:
        return json.load(r)


def rate_remaining() -> int:
    return api_json("https://api.github.com/rate_limit")["resources"]["core"]["remaining"]


def get_release(tag: str) -> dict | None:
    try:
        return api_json(f"https://api.github.com/repos/{REPO}/releases/tags/{tag}")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def create_release(tag: str, year: str, shard: int) -> dict:
    print(f"  creating overflow release {tag}", flush=True)
    return api_json(
        f"https://api.github.com/repos/{REPO}/releases",
        method="POST",
        payload={
            "tag_name": tag,
            "name": f"MA SFI {year} - Redacted PDFs (part {shard + 1})",
            "body": (
                f"Individual redacted Statement-of-Financial-Interest PDFs for {year}.\n\n"
                f"GitHub limits a release to {ASSETS_PER_RELEASE} assets, so each year's "
                f"filings are split across several releases. The complete bulk archive "
                f"for this year is `sfi-{year}.zip`, attached to the `sfi-{year}` release.\n\n"
                "Filenames are sanitized to `[A-Za-z0-9._-]` because GitHub silently "
                "rewrites anything else."
            ),
        },
    )


def list_assets(release_id: int) -> set[str]:
    names: set[str] = set()
    page = 1
    while True:
        batch = api_json(
            f"https://api.github.com/repos/{REPO}/releases/{release_id}/assets"
            f"?per_page=100&page={page}"
        )
        names.update(a["name"] for a in batch)
        if len(batch) < 100:
            return names
        page += 1


def year_shards(year: str) -> list[dict]:
    """Every existing release holding this year's PDFs, shard 0 first."""
    shards = []
    shard = 0
    while True:
        tag = f"sfi-{year}" if shard == 0 else f"sfi-{year}-p{shard}"
        rel = get_release(tag)
        if rel is None:
            break
        shards.append({"tag": tag, "shard": shard, "id": rel["id"],
                       "assets": list_assets(rel["id"]), "release": rel})
        shard += 1
    return shards


def _range_get(url: str, start: int, end: int) -> bytes:
    r = _req(url, accept="application/octet-stream")
    r.add_header("Range", f"bytes={start}-{end}")
    with urllib.request.urlopen(r) as resp:
        return resp.read()


def zip_member_basenames(zip_url: str, total_size: int) -> list[str]:
    """List a remote zip's members by range-reading only its central directory,
    so we don't pull ~1 GB just to learn what a year still needs."""
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
    return [n for n in names if n.lower().endswith(".pdf")]


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
    """POST one asset. Returns the stored name, or '' if it already existed."""
    url = (f"https://uploads.github.com/repos/{REPO}/releases/{release_id}/assets"
           f"?name={urllib.parse.quote(name)}")
    for attempt in range(5):
        try:
            with urllib.request.urlopen(
                _req(url, method="POST", data=blob, content_type="application/pdf")
            ) as r:
                return json.load(r).get("name", name)
        except urllib.error.HTTPError as e:
            body = e.read(500).decode("utf-8", "replace")
            if e.code == 422 and "already_exists" in body:
                return ""
            # The shard filled up underneath us; caller moves to the next one.
            if e.code == 422 and "file_count" in body:
                raise ShardFull(name)
            if e.code in (403, 429):
                wait = int(e.headers.get("Retry-After") or 0) or 30 * (attempt + 1)
                print(f"    secondary limit; sleeping {wait}s", flush=True)
                time.sleep(wait)
                continue
            raise RuntimeError(f"upload failed for {name}: HTTP {e.code} {body}") from e
    raise RuntimeError(f"upload failed after retries: {name}")


class ShardFull(Exception):
    """A release hit the 1000-asset cap mid-run."""


def survey() -> list[dict]:
    rows = []
    for year in YEARS:
        base = get_release(f"sfi-{year}")
        if base is None:
            print(f"WARN: no sfi-{year} release; skipping", file=sys.stderr)
            continue
        zip_asset = next((a for a in base["assets"] if a["name"] == f"sfi-{year}.zip"), None)
        if zip_asset is None:
            print(f"WARN: sfi-{year} has no bulk zip; skipping", file=sys.stderr)
            continue
        shards = year_shards(year)
        published = set().union(*(s["assets"] for s in shards)) if shards else set()
        members = zip_member_basenames(zip_asset["url"], zip_asset["size"])
        # safe name -> zip member path
        want = {safe_asset_name(m.split("/")[-1]): m for m in members}
        missing = {s: m for s, m in want.items() if s not in published}
        rows.append({"year": year, "shards": shards, "zip_url": zip_asset["url"],
                     "total": len(want), "missing": missing})
    return rows


def place(year: str, shards: list[dict]) -> dict:
    """First shard of the year with room, creating the next one if all are full."""
    for s in shards:
        if len(s["assets"]) < ASSETS_PER_RELEASE:
            return s
    shard = len(shards)
    tag = f"sfi-{year}-p{shard}"
    rel = create_release(tag, year, shard)
    s = {"tag": tag, "shard": shard, "id": rel["id"], "assets": set(), "release": rel}
    shards.append(s)
    return s


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true", help="show progress; upload nothing")
    args = ap.parse_args()

    if not TOKEN:
        print("ERR: set GH_TOKEN (needs contents:write)", file=sys.stderr)
        return 2

    rows = survey()
    print("\n  year   published / total   missing   releases")
    for r in rows:
        done = r["total"] - len(r["missing"])
        print(f"  {r['year']}   {done:>6,} / {r['total']:<6,}  {len(r['missing']):>6,}"
              f"   {len(r['shards'])}")
    grand = sum(len(r["missing"]) for r in rows)
    print(f"  {'TOTAL':<6} {sum(r['total'] - len(r['missing']) for r in rows):>13,}"
          f" / {sum(r['total'] for r in rows):<6,}  {grand:>6,}\n")

    if args.report:
        return 0
    if grand == 0:
        print("Nothing missing - every per-filing PDF is published.")
        return 0

    budget = max(0, (rate_remaining() - BUDGET_RESERVE) // REQUESTS_PER_UPLOAD)
    print(f"Rate-limit budget this run: {budget:,} uploads")
    if budget < 1:
        print("No headroom this hour; exiting cleanly so the next run resumes.")
        return 0

    uploaded = 0
    for r in rows:
        if uploaded >= budget or not r["missing"]:
            continue
        print(f"\n== sfi-{r['year']}: {len(r['missing']):,} missing ==", flush=True)
        zip_path = download(r["zip_url"], WORK / f"sfi-{r['year']}.zip")
        try:
            with zipfile.ZipFile(zip_path) as zf:
                for safe, member in sorted(r["missing"].items()):
                    if uploaded >= budget:
                        print("  budget reached; stopping cleanly", flush=True)
                        break
                    blob = zf.read(member)
                    if blob[:4] != b"%PDF":
                        print(f"  SKIP {safe}: not a PDF", file=sys.stderr)
                        continue
                    while True:
                        target = place(r["year"], r["shards"])
                        try:
                            stored = upload_asset(target["id"], safe, blob)
                        except ShardFull:
                            # Mark it full and retry into the next shard.
                            target["assets"].update(
                                f"__full__{i}" for i in range(ASSETS_PER_RELEASE)
                            )
                            continue
                        if stored and stored != safe:
                            print(f"  WARN GitHub renamed {safe} -> {stored}",
                                  file=sys.stderr)
                        target["assets"].add(stored or safe)
                        break
                    uploaded += 1
                    if uploaded % 250 == 0:
                        print(f"  {uploaded:,}/{budget:,} uploaded", flush=True)
        finally:
            zip_path.unlink(missing_ok=True)

    print(f"\nUploaded {uploaded:,} assets this run. {grand - uploaded:,} still to go.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
