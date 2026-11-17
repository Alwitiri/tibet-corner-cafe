"""Extract clean image assets from the design mockups (text removed by inpainting)."""
import cv2
import numpy as np
from PIL import Image

OUT = "assets/img/"
site = cv2.cvtColor(np.array(Image.open("reference/website-mockup.webp").convert("RGB")), cv2.COLOR_RGB2BGR)
admin = cv2.cvtColor(np.array(Image.open("reference/admin-mockup.webp").convert("RGB")), cv2.COLOR_RGB2BGR)


def clean(img, bright_boxes=(), solid_boxes=(), thresh=165, dilate=4, radius=6, dark_boxes=(), dark_thresh=90):
    img = img.copy()
    mask = np.zeros(img.shape[:2], np.uint8)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    for (x1, y1, x2, y2) in bright_boxes:
        roi = gray[y1:y2, x1:x2]
        mask[y1:y2, x1:x2] |= (roi > thresh).astype(np.uint8) * 255
    for (x1, y1, x2, y2) in dark_boxes:
        roi = gray[y1:y2, x1:x2]
        mask[y1:y2, x1:x2] |= (roi < dark_thresh).astype(np.uint8) * 255
    if dilate:
        mask = cv2.dilate(mask, np.ones((dilate * 2 + 1, dilate * 2 + 1), np.uint8))
    for (x1, y1, x2, y2) in solid_boxes:
        mask[y1:y2, x1:x2] = 255
    return cv2.inpaint(img, mask, radius, cv2.INPAINT_TELEA)


def up(img, scale=2):
    return cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_LANCZOS4)


def save(img, name, scale=2, q=88):
    img = up(img, scale) if scale != 1 else img
    Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).save(OUT + name, "WEBP", quality=q, method=6)
    print("saved", name, img.shape[1], "x", img.shape[0])


# ---------- Public website ----------
hero = clean(
    site,
    bright_boxes=[(60, 15, 245, 118), (305, 24, 748, 60), (60, 138, 442, 248), (62, 250, 332, 309), (62, 400, 178, 444)],
    solid_boxes=[(836, 14, 964, 60), (62, 326, 249, 380), (60, 98, 115, 108), (183, 98, 240, 108)],
)
save(hero[0:452, 0:1024], "hero.webp")

save(site[465:706, 8:508], "story.webp")

# Signature dish cards (label strip text removed; label re-added in HTML)
cards = {"momos": 55, "thukpa": 291, "tibetan-noodles": 527, "veg-thukpa": 763}
for name, x in cards.items():
    c = clean(site, bright_boxes=[(x + 10, 905, x + 197, 935)], thresh=150, dilate=3)
    save(c[791:938, x + 1:x + 206], f"dish-{name}.webp", scale=2)

save(site[985:1228, 413:1024], "atmosphere.webp")

visit = clean(
    site,
    bright_boxes=[(62, 1240, 255, 1352), (770, 1245, 965, 1385)],
    solid_boxes=[(380, 1240, 672, 1402), (62, 1366, 220, 1405), (62, 1320, 92, 1352), (62, 1278, 92, 1310), (150, 1252, 215, 1266)],
    thresh=150,
    radius=8,
)
# replace the smeared map area with a mirrored patch of hills from the right side
patch = cv2.flip(visit[1240:1405, 680:975], 1)
patch = cv2.resize(patch, (300, 170))
m = 255 * np.ones(patch.shape, patch.dtype)
visit = cv2.seamlessClone(patch, visit, m, (526, 1323), cv2.NORMAL_CLONE)
save(visit[1240:1422, 0:1024], "visit-bg.webp")

# Mountains decoration in signature dishes header (right side)
save(site[688:777, 780:1024], "dishes-mountains.webp")

# ---------- Admin dashboard ----------
banner = clean(
    admin,
    dark_boxes=[(262, 120, 660, 235)],
    dark_thresh=110,
    dilate=3,
)
save(banner[78:256, 245:1515], "admin-banner.webp", scale=1, q=90)

side = clean(admin, bright_boxes=[(25, 870, 200, 990)], thresh=150, dilate=3)
save(side[600:1024, 0:220], "admin-sidebar.webp", scale=2)

sections = {"hero": 258, "menu": 443, "atmosphere": 628, "visit": 814}
for name, x in sections.items():
    s = clean(admin, bright_boxes=[(x + 6, 918, x + 160, 962)], thresh=160, dilate=3)
    save(s[811:968, x:x + 164], f"admin-sec-{name}.webp", scale=2)

for name, (x, y) in {"momos": (1245, 476), "interior": (1245, 684)}.items():
    save(admin[y:y + 48, x:x + 48], f"admin-thumb-{name}.webp", scale=2)

save(admin[18:58, 1403:1440], "admin-avatar.webp", scale=2)
