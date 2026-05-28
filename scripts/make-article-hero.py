#!/usr/bin/env python3
# Generates a 1500x600 (5:2) hero PNG for X / social article promo.
# Output: C:/Users/dunca/Downloads/peoples-audit-update-2026-05-28.png

import json, pathlib
from PIL import Image, ImageDraw, ImageFont

W, H = 1500, 600
OUT = pathlib.Path("C:/Users/dunca/Downloads/peoples-audit-update-2026-05-28.png")
REPO = pathlib.Path(__file__).resolve().parent.parent

# Colors — dark, serious, restrained palette
BG       = (15, 18, 26)        # deep blue-black
PANEL    = (24, 28, 38)
PANEL_2  = (32, 38, 50)
ACCENT_R = (200, 50, 60)       # MA flag red
ACCENT_B = (90, 165, 230)      # info blue
ACCENT_G = (90, 200, 130)      # money green
TEXT     = (236, 240, 245)
DIM      = (155, 165, 180)
RULE     = (60, 70, 88)

# Font hunt (Windows defaults)
def font(size, bold=False):
    paths = []
    if bold:
        paths += [
            "C:/Windows/Fonts/segoeuib.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
        ]
    paths += [
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for p in paths:
        if pathlib.Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

# Load real firm data so the numbers in the image match the dashboard exactly.
def load_top_firms():
    p = REPO / "public" / "data" / "ma-lobbying-firm-details-2025.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    firms = sorted(d["firms"], key=lambda f: -(f.get("totalSalariesReceived") or 0))[:5]
    return firms, d["totalSalariesReceived"], d["firmCount"]

top_firms, total_2025, firm_count = load_top_firms()

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

# Top accent stripe
draw.rectangle([(0, 0), (W, 4)], fill=ACCENT_R)

# Title block
draw.text((40, 30), "THE PEOPLE'S AUDIT", font=font(36, bold=True), fill=TEXT)
draw.text((40, 76), "Citizen-built MA public-records dashboard", font=font(18), fill=DIM)
draw.text((40, 102), "Update · May 28, 2026", font=font(15), fill=ACCENT_R)

# Right-side meta
url_lines = [
    "duncanburns2013-dot.github.io/The-Peoples-Audit",
    "duncanburns2013-dot.github.io/HHS-MA-DOGE",
]
for i, line in enumerate(url_lines):
    f = font(14)
    bbox = draw.textbbox((0, 0), line, font=f)
    tw = bbox[2] - bbox[0]
    draw.text((W - 40 - tw, 40 + i * 22), line, font=f, fill=DIM)

# Divider
draw.line([(40, 142), (W - 40, 142)], fill=RULE, width=1)

# Three big KPI tiles (5:2 friendly layout)
PAD = 40
GAP = 18
TILE_W = (W - PAD * 2 - GAP * 2) // 3
TILE_H = 200
TILE_Y = 165

tiles = [
    {
        "label": "MA STATE ETHICS SFI FILINGS",
        "value": "29,729",
        "sub":   "redacted PDFs 2019-2025, indexed",
        "tag":   "Official Ethics search has been offline since May 14",
        "color": ACCENT_R,
    },
    {
        "label": "MA SOS LOBBYIST REGISTRANTS",
        "value": "36,286",
        "sub":   "across 11 years (2016-2026)",
        "tag":   "Year-by-year, searchable, every row linked to SOS",
        "color": ACCENT_B,
    },
    {
        "label": "2025 LOBBYING FEES",
        "value": f"${total_2025/1e6:.1f}M",
        "sub":   f"received by {firm_count} registered firms",
        "tag":   "Drill into any firm: lobbyists, clients, purposes",
        "color": ACCENT_G,
    },
]

for i, t in enumerate(tiles):
    x0 = PAD + i * (TILE_W + GAP)
    y0 = TILE_Y
    draw.rectangle([(x0, y0), (x0 + TILE_W, y0 + TILE_H)], fill=PANEL)
    # left color stripe
    draw.rectangle([(x0, y0), (x0 + 4, y0 + TILE_H)], fill=t["color"])
    # text
    draw.text((x0 + 18, y0 + 14), t["label"], font=font(12, bold=True), fill=DIM)
    draw.text((x0 + 18, y0 + 38), t["value"], font=font(56, bold=True), fill=t["color"])
    draw.text((x0 + 18, y0 + 116), t["sub"], font=font(15), fill=TEXT)
    draw.text((x0 + 18, y0 + 142), t["tag"], font=font(12), fill=DIM)

# Bottom strip: top 5 firms by 2025 fees
BOT_Y = 380
draw.text((PAD, BOT_Y), "TOP 2025 LOBBYING FIRMS BY FEES RECEIVED (verified from MA SOS Summary.aspx pages)",
          font=font(12, bold=True), fill=DIM)

ROW_Y = BOT_Y + 22
ROW_H = 26
NAME_W = 540
FEE_W = 130
LOB_W = 95
CLI_W = 95

# Header row
hdr_y = ROW_Y
draw.text((PAD, hdr_y), "FIRM", font=font(11, bold=True), fill=DIM)
draw.text((PAD + NAME_W, hdr_y), "FEES RECEIVED", font=font(11, bold=True), fill=DIM)
draw.text((PAD + NAME_W + FEE_W + 20, hdr_y), "LOBBYISTS", font=font(11, bold=True), fill=DIM)
draw.text((PAD + NAME_W + FEE_W + LOB_W + 40, hdr_y), "CLIENTS", font=font(11, bold=True), fill=DIM)
draw.line([(PAD, hdr_y + 18), (W - PAD, hdr_y + 18)], fill=RULE, width=1)

for i, f in enumerate(top_firms):
    y = ROW_Y + 28 + i * ROW_H
    if i % 2 == 0:
        draw.rectangle([(PAD - 6, y - 4), (W - PAD + 6, y + ROW_H - 8)], fill=PANEL_2)
    name = f["name"]
    if len(name) > 56: name = name[:54] + "…"
    fee = f"${(f.get('totalSalariesReceived') or 0)/1e6:.2f}M"
    draw.text((PAD, y), name, font=font(14, bold=True), fill=TEXT)
    draw.text((PAD + NAME_W, y), fee, font=font(14, bold=True), fill=ACCENT_G)
    draw.text((PAD + NAME_W + FEE_W + 20, y), str(f["lobbyistCount"]), font=font(14), fill=TEXT)
    draw.text((PAD + NAME_W + FEE_W + LOB_W + 40, y), str(f["clientCount"]), font=font(14), fill=TEXT)

# Footer
foot_y = H - 28
draw.line([(PAD, foot_y - 8), (W - PAD, foot_y - 8)], fill=RULE, width=1)
left_txt = "Sources: CTHRU · MA SOS Lobbyist Search · MA Ethics SFI bulk release · OCPF · USASpending"
draw.text((PAD, foot_y), left_txt, font=font(11), fill=DIM)
right = "72% voted YES on Q1. The Legislature refused. This is what citizens built instead."
bbox = draw.textbbox((0, 0), right, font=font(11, bold=True))
draw.text((W - PAD - (bbox[2] - bbox[0]), foot_y), right, font=font(11, bold=True), fill=ACCENT_R)

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT, "PNG", optimize=True)
print(f"-> {OUT}")
print(f"-> {OUT.stat().st_size:,} bytes  ({W}x{H}, 5:2)")
