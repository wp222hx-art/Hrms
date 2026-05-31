#!/usr/bin/env python3
"""Compress 3 new event card PNGs to webp and slice icons3.png into 4 hex icons."""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW  = os.path.join(ROOT, 'scripts', 'raw3')
OUT_CARDS = os.path.join(ROOT, 'public', 'cards', 'rewards')
OUT_ICONS = os.path.join(ROOT, 'public', 'cards', 'ui')
os.makedirs(OUT_CARDS, exist_ok=True)
os.makedirs(OUT_ICONS, exist_ok=True)

CARDS = ['ops', 'wall', 'mentor']
for name in CARDS:
    src = os.path.join(RAW, f'{name}.png')
    dst = os.path.join(OUT_CARDS, f'{name}.webp')
    im = Image.open(src).convert('RGB')
    # downscale to width 720 maintaining ratio
    w, h = im.size
    new_w = 720
    new_h = int(h * new_w / w)
    im = im.resize((new_w, new_h), Image.LANCZOS)
    im.save(dst, 'webp', quality=82, method=6)
    size_kb = os.path.getsize(dst) / 1024
    print(f'card {name}: {size_kb:.1f} KB')

# Slice icon sheet 4-up horizontally
sheet = Image.open(os.path.join(RAW, 'icons3.png')).convert('RGBA')
W, H = sheet.size
print(f'icon sheet: {W}x{H}')
# Assume 4 evenly spaced icons in a row. Use square crops centered.
slice_w = W // 4
icon_names = ['ic_ops', 'ic_wall', 'ic_pair', 'ic_event']
for i, nm in enumerate(icon_names):
    box = (i * slice_w, 0, (i + 1) * slice_w, H)
    crop = sheet.crop(box)
    # Resize to a uniform 256x256 with center-fit
    side = min(crop.size)
    cx = (crop.size[0] - side) // 2
    cy = (crop.size[1] - side) // 2
    crop = crop.crop((cx, cy, cx + side, cy + side)).resize((256, 256), Image.LANCZOS)
    dst = os.path.join(OUT_ICONS, f'{nm}.webp')
    crop.save(dst, 'webp', quality=85, method=6)
    size_kb = os.path.getsize(dst) / 1024
    print(f'icon {nm}: {size_kb:.1f} KB')

print('done.')
