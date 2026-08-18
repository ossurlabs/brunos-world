#!/usr/bin/env python3
"""Slice Bruno's World Gemini sprite sheets into transparent PNG frames + PWA icons.

Key facts handled here:
- "Transparency" in the sheets is FAKE: a painted white/light-gray checkerboard
  (one sheet, k7euu9, uses a solid beige background instead).
- Bruno's chest/paws are white, so no global color key: we flood-fill from the
  image borders through background-colored pixels only.
- Free-floating pale-BLUE droplets/bubbles (wash sheet) must be KEPT.
- Faint whitish Gemini sparkle watermarks (no dark outline, neutral color)
  must be DROPPED.
"""
import json
import os

import cv2
import numpy as np
from PIL import Image

SRC = "/Users/lillianrusso/Projects/brunos-world/source-art"
OUT_SPRITES = "/Users/lillianrusso/Projects/brunos-world/assets/sprites"
OUT_ICONS = "/Users/lillianrusso/Projects/brunos-world/assets/icons"
PAD = 8
BIG_AREA = 20000

os.makedirs(OUT_SPRITES, exist_ok=True)
os.makedirs(OUT_ICONS, exist_ok=True)


def load_rgb(name):
    img = Image.open(os.path.join(SRC, name)).convert("RGB")
    return np.asarray(img).copy()


def remove_background(rgb, beige=False):
    """Return alpha mask (uint8 0/255): flood from borders through bg-colored px."""
    r = rgb[:, :, 0].astype(np.int32)
    g = rgb[:, :, 1].astype(np.int32)
    b = rgb[:, :, 2].astype(np.int32)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    lum = (r * 299 + g * 587 + b * 114) // 1000

    if beige:
        # sample border color (beige) and match within tolerance
        border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]).astype(np.int32)
        bg = np.median(border, axis=0)
        dist = np.abs(r - bg[0]) + np.abs(g - bg[1]) + np.abs(b - bg[2])
        bg_colored = dist < 90
    else:
        # checkerboard grays + white tiles: near-neutral and light.
        # droplets/bubbles are pale BLUE (b - r large) -> NOT background.
        neutral = (sat <= 16) & ((b - r) < 14)
        bg_colored = neutral & (lum >= 165)

    mask = bg_colored.astype(np.uint8)
    h, w = mask.shape
    # flood fill from every border pixel that is bg-colored
    ff_mask = np.zeros((h + 2, w + 2), np.uint8)
    # invert trick: floodFill on mask image where bg_colored==1, fill value 2
    seeds = []
    for x in range(0, w, 40):
        seeds += [(x, 0), (x, h - 1)]
    for y in range(0, h, 40):
        seeds += [(0, y), (w - 1, y)]
    seeds += [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    work = mask.copy()
    for (x, y) in seeds:
        if work[y, x] == 1:
            cv2.floodFill(work, ff_mask, (x, y), 2)
    removed = work == 2

    # Enclosed background "holes" (e.g. checkerboard between legs) are not
    # reachable from the border. Detect them: bg-colored comps not removed.
    holes = (bg_colored & ~removed).astype(np.uint8)
    n, hlabels, hstats, _ = cv2.connectedComponentsWithStats(holes, connectivity=8)
    for i in range(1, n):
        area = hstats[i][4]
        if area < 200:
            continue
        m = hlabels == i
        hl = lum[m]
        if beige:
            hd = (np.abs(r - bg[0]) + np.abs(g - bg[1]) + np.abs(b - bg[2]))[m]
            if np.median(hd) < 40:
                removed = removed | m
        else:
            # checkerboard is BIMODAL: gray tiles (~193) + light tiles (~231).
            # White fur (~254) and gray paw shading (~205) are unimodal -> kept.
            f_gray = (hl <= 216).mean()
            f_light = ((hl >= 219) & (hl <= 243)).mean()
            if f_gray > 0.2 and f_light > 0.2:
                removed = removed | m

    alpha = np.where(removed, 0, 255).astype(np.uint8)
    return alpha


def defringe(rgb, alpha, beige_bg=None, iters=2, sat_max=22):
    """Erode light low-saturation halo pixels that border transparency."""
    r = rgb[:, :, 0].astype(np.int32)
    g = rgb[:, :, 1].astype(np.int32)
    b = rgb[:, :, 2].astype(np.int32)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    lum = (r * 299 + g * 587 + b * 114) // 1000
    if beige_bg is not None:
        dist = (np.abs(r - beige_bg[0]) + np.abs(g - beige_bg[1])
                + np.abs(b - beige_bg[2]))
        halo = dist < 140
    else:
        halo = (sat <= sat_max) & ((b - r) < 16) & (lum >= 160) & (lum <= 242)
    kernel = np.ones((3, 3), np.uint8)
    for _ in range(iters):
        transp = (alpha == 0).astype(np.uint8)
        near_t = cv2.dilate(transp, kernel) == 1
        kill = near_t & (alpha == 255) & halo
        if not kill.any():
            break
        alpha[kill] = 0
    return alpha


def components(alpha):
    n, labels, stats, cents = cv2.connectedComponentsWithStats(
        (alpha > 0).astype(np.uint8), connectivity=8)
    comps = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        comps.append({"id": i, "bbox": (x, y, w, h), "area": int(area),
                      "cx": cents[i][0], "cy": cents[i][1]})
    return labels, comps


def is_watermark(rgb, labels, comp):
    """Faint neutral sparkle: no dark pixels, not bluish."""
    m = labels == comp["id"]
    px = rgb[m].astype(np.int32)
    lum = (px[:, 0] * 299 + px[:, 1] * 587 + px[:, 2] * 114) // 1000
    bluish = (px[:, 2].mean() - px[:, 0].mean()) > 12
    return lum.min() > 150 and not bluish


def find_band_split(alpha):
    """Row with no foreground, in the largest mid-image all-transparent gap."""
    rows = (alpha > 0).sum(axis=1)
    h = len(rows)
    empty = rows == 0
    best, cur_start, cur = None, None, 0
    for y in range(h // 5, h * 4 // 5 + h // 5):
        if y < h and empty[y]:
            if cur_start is None:
                cur_start = y
            cur = y - cur_start
        else:
            if cur_start is not None and (best is None or cur > best[1]):
                best = ((cur_start + y) // 2, cur)
            cur_start = None
    if cur_start is not None and (best is None or cur > best[1]):
        best = ((cur_start + h * 4 // 5 + h // 5) // 2, cur)
    return best[0] if best else h // 2


def cluster_band(comps, band, split_y):
    sel = [c for c in comps if (c["cy"] < split_y) == (band == "top")]
    bigs = [c for c in sel if c["area"] >= BIG_AREA]
    smalls = [c for c in sel if c["area"] < BIG_AREA]
    return bigs, smalls


def merge_bbox(comps_list):
    xs0 = min(c["bbox"][0] for c in comps_list)
    ys0 = min(c["bbox"][1] for c in comps_list)
    xs1 = max(c["bbox"][0] + c["bbox"][2] for c in comps_list)
    ys1 = max(c["bbox"][1] + c["bbox"][3] for c in comps_list)
    return xs0, ys0, xs1, ys1


def crop_save(rgb, alpha, labels, comps_list, path, mirror=False):
    keep = np.isin(labels, [c["id"] for c in comps_list])
    a = np.where(keep, alpha, 0)
    x0, y0, x1, y1 = merge_bbox(comps_list)
    # tighten to actual kept pixels
    ys, xs = np.nonzero(a[y0:y1, x0:x1])
    x0n, x1n = x0 + xs.min(), x0 + xs.max() + 1
    y0n, y1n = y0 + ys.min(), y0 + ys.max() + 1
    crop_rgb = rgb[y0n:y1n, x0n:x1n]
    crop_a = a[y0n:y1n, x0n:x1n]
    h, w = crop_a.shape
    out = np.zeros((h + 2 * PAD, w + 2 * PAD, 4), np.uint8)
    out[PAD:PAD + h, PAD:PAD + w, :3] = crop_rgb
    out[PAD:PAD + h, PAD:PAD + w, 3] = crop_a
    out[out[:, :, 3] == 0, :3] = 0
    if mirror:
        out = out[:, ::-1]
    Image.fromarray(out, "RGBA").save(path)
    return out.shape[1], out.shape[0]


def attach_smalls(bigs, smalls, chosen, rgb, labels, gray_min_area=None):
    """Assign small comps to nearest big comp; return those belonging to chosen."""
    result = list(chosen)
    for s in smalls:
        if is_watermark(rgb, labels, s):
            continue
        if s["area"] < 4000:
            m = labels == s["id"]
            px = rgb[m].astype(np.int32)
            br = np.median(px[:, 2] - px[:, 0])
            lum = np.median((px[:, 0] * 299 + px[:, 1] * 587 + px[:, 2] * 114) // 1000)
            if br < 20 and (lum > 165 or (s["area"] < 500 and lum > 140)):
                continue  # stray neutral-gray speck, not a droplet
        if gray_min_area and s["area"] >= gray_min_area:
            m = labels == s["id"]
            px = rgb[m].astype(np.int32)
            sat = px.max(axis=1) - px.min(axis=1)
            if np.median(sat) < 35:  # silver bowl etc.
                continue
        best = min(bigs, key=lambda b: (b["cx"] - s["cx"]) ** 2 + (b["cy"] - s["cy"]) ** 2)
        if any(best["id"] == c["id"] for c in chosen):
            result.append(s)
    return result


results = {}


def scrub_box(rgb, alpha, box, iters=12):
    """Remove Gemini sparkle watermark residue inside a tight box:
    1) erode its bright core inward from transparency,
    2) inpaint the translucent overlay left on top of the fur."""
    x0, y0, x1, y1 = box
    r = rgb[:, :, 0].astype(np.int32)
    g = rgb[:, :, 1].astype(np.int32)
    b = rgb[:, :, 2].astype(np.int32)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    lum = (r * 299 + g * 587 + b * 114) // 1000
    inbox = np.zeros(alpha.shape, bool)
    inbox[y0:y1, x0:x1] = True
    cand = inbox & (sat <= 50) & (lum >= 150) & (lum <= 246) & ((b - r) < 30)
    kernel = np.ones((3, 3), np.uint8)
    for _ in range(iters):
        transp = (alpha == 0).astype(np.uint8)
        near_t = cv2.dilate(transp, kernel) == 1
        kill = near_t & (alpha == 255) & cand
        if not kill.any():
            break
        alpha[kill] = 0
    return alpha


def process_sheet(fname, beige, jobs, halo_iters=2, halo_sat=22, scrub=None):
    rgb = load_rgb(fname)
    beige_bg = None
    if beige:
        border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]).astype(np.int32)
        beige_bg = np.median(border, axis=0)
    alpha = remove_background(rgb, beige=beige)
    alpha = defringe(rgb, alpha, beige_bg=beige_bg, iters=halo_iters, sat_max=halo_sat)
    if scrub:
        for box in scrub:
            alpha = scrub_box(rgb, alpha, box)
    labels, comps = components(alpha)
    comps = [c for c in comps if c["area"] >= 40]  # dust
    split_y = find_band_split(alpha)
    for job in jobs:
        name, band, selector = job["name"], job["band"], job["sel"]
        if band == "all":
            bigs = [c for c in comps if c["area"] >= BIG_AREA]
            smalls = [c for c in comps if c["area"] < BIG_AREA]
        else:
            bigs, smalls = cluster_band(comps, band, split_y)
        bigs_sorted = sorted(bigs, key=lambda c: c["cx"])
        if selector == "all":
            chosen = list(bigs)
        elif selector == "left":
            chosen = [bigs_sorted[0]]
        elif selector == "right":
            chosen = [bigs_sorted[-1]]
        elif selector == "largest":
            chosen = [max(bigs, key=lambda c: c["area"])]
        cluster = attach_smalls(bigs, smalls, chosen, rgb, labels,
                                gray_min_area=job.get("gray_min_area"))
        w, h = crop_save(rgb, alpha, labels, cluster,
                         os.path.join(OUT_SPRITES, name + ".png"),
                         mirror=job.get("mirror", False))
        results[name] = {"w": w, "h": h, "facing": job["facing"], "group": job["group"]}
        print(f"{name}.png {w}x{h}  band={band} sel={selector} "
              f"bigs_in_band={len(bigs)} cluster={len(cluster)} split_y={split_y}")


# Sheet 1: RUN — 4 poses. run_04 source faces LEFT -> mirror.
process_sheet("Gemini_Generated_Image_68iben68iben68ib.png", False, halo_iters=8, halo_sat=30,
              scrub=[(1528, 2020, 1642, 2130)],  # Gemini sparkle watermark corner
              jobs=[
    {"name": "run_01", "band": "top", "sel": "left", "facing": "right", "group": "run"},
    {"name": "run_03", "band": "top", "sel": "right", "facing": "right", "group": "run"},
    {"name": "run_02", "band": "bottom", "sel": "left", "facing": "right", "group": "run"},
    {"name": "run_04", "band": "bottom", "sel": "right", "facing": "right",
     "group": "run", "mirror": True},
])

# Sheet 2: WASH — top soapy portrait (+bubbles), bottom-left shake (+droplets).
process_sheet("Gemini_Generated_Image_8em7fz8em7fz8em7.png", False, [
    {"name": "wash_wet", "band": "top", "sel": "all", "facing": "front", "group": "wash"},
    {"name": "wash_shake", "band": "bottom", "sel": "left", "facing": "right", "group": "wash"},
])

# Sheet 3: SLEEP — top curled pose only.
process_sheet("Gemini_Generated_Image_j6hf95j6hf95j6hf.png", False, [
    {"name": "sleep", "band": "top", "sel": "largest", "facing": "left", "group": "sleep"},
])

# Sheet 4: BASE (beige) — portrait + two profiles.
process_sheet("Gemini_Generated_Image_k7euu9k7euu9k7eu.png", True, [
    {"name": "portrait", "band": "top", "sel": "largest", "facing": "front", "group": "idle"},
    {"name": "profile_right", "band": "bottom", "sel": "left", "facing": "right", "group": "idle"},
    {"name": "profile_left", "band": "bottom", "sel": "right", "facing": "left", "group": "idle"},
])

# Sheet 5: EAT — top: dog + bowl together; bottom-left dog only (bowl is
# centered between the two dogs, excluded via gray filter).
process_sheet("Gemini_Generated_Image_pziloqpziloqpzil.png", False, [
    {"name": "eat_01", "band": "top", "sel": "all", "facing": "right", "group": "eat"},
    {"name": "eat_02", "band": "bottom", "sel": "left", "facing": "right",
     "group": "eat", "gray_min_area": 2000},
])

# Sheet 6: CATCH — single pose.
process_sheet("Gemini_Generated_Image_so50aaso50aaso50.png", False, [
    {"name": "catch", "band": "all", "sel": "all", "facing": "right", "group": "catch"},
])

order = ["portrait", "profile_right", "profile_left", "run_01", "run_02",
         "run_03", "run_04", "eat_01", "eat_02", "wash_wet", "wash_shake",
         "sleep", "catch"]
with open(os.path.join(OUT_SPRITES, "frames.json"), "w") as f:
    json.dump({k: results[k] for k in order}, f, indent=2)
print("frames.json written")

# ---- Icons from portrait.png ----
portrait = Image.open(os.path.join(OUT_SPRITES, "portrait.png")).convert("RGBA")
SKY = (0x7e, 0xc8, 0xf0, 255)
for fname, size in [("icon-512.png", 512), ("icon-192.png", 192),
                    ("apple-touch-icon.png", 180)]:
    canvas = Image.new("RGBA", (size, size), SKY)
    inner = int(size * 0.68)  # maskable safe zone
    pw, ph = portrait.size
    scale = min(inner / pw, inner / ph)
    nw, nh = int(pw * scale), int(ph * scale)
    resized = portrait.resize((nw, nh), Image.LANCZOS)
    canvas.alpha_composite(resized, ((size - nw) // 2, (size - nh) // 2))
    canvas.convert("RGB").save(os.path.join(OUT_ICONS, fname))
    print(fname, size)
print("done")
