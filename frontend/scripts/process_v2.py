#!/usr/bin/env python3
"""Compress new card images + slice extra icon sheet."""
import os
from PIL import Image

BASE = '/home/user/webapp/frontend/public/cards'

def compress(src, dst, max_w=720, quality=82):
    img = Image.open(src).convert('RGBA')
    w, h = img.size
    if w > max_w:
        ratio = max_w / w
        img = img.resize((max_w, int(h * ratio)), Image.LANCZOS)
    img.save(dst, 'WEBP', quality=quality, method=6)
    print(f"  {os.path.basename(src):20s} {w}x{h} -> {os.path.basename(dst)} ({os.path.getsize(dst)//1024} KB)")

def slice_horizontal(src, out_dir, names, max_size=160):
    img = Image.open(src).convert('RGBA')
    w, h = img.size
    n = len(names)
    iw = w // n
    print(f"  Slicing {os.path.basename(src)} ({w}x{h}) → {n} icons")
    for i, name in enumerate(names):
        crop = img.crop((i * iw, 0, (i + 1) * iw, h))
        cw, ch = crop.size
        if cw > max_size or ch > max_size:
            ratio = max_size / max(cw, ch)
            crop = crop.resize((int(cw * ratio), int(ch * ratio)), Image.LANCZOS)
        dst = os.path.join(out_dir, f"{name}.webp")
        crop.save(dst, 'WEBP', quality=88, method=6)
        print(f"    [{i+1}/{n}] {name}.webp ({os.path.getsize(dst)//1024} KB)")

# Reward cards (4 new)
print("=== New reward cards ===")
for f in ['birthday.png', 'onboarding.png', 'exam.png', 'festival.png']:
    src = os.path.join(BASE, 'rewards', f)
    dst = src.replace('.png', '.webp')
    compress(src, dst, max_w=720, quality=82)
    os.remove(src)

# Slice extra icon sheet
print("\n=== Slicing extra icons ===")
slice_horizontal(
    os.path.join(BASE, 'ui', 'extra_icons.png'),
    os.path.join(BASE, 'ui'),
    ['ic_expense', 'ic_training', 'ic_welfare', 'ic_qr'],
    max_size=160,
)
os.remove(os.path.join(BASE, 'ui', 'extra_icons.png'))

print("\n=== Sizes ===")
for root, dirs, files in os.walk(BASE):
    for f in sorted(files):
        path = os.path.join(root, f)
        if any(s in path for s in ['birthday', 'onboarding', 'exam', 'festival', 'ic_']):
            print(f"  {os.path.relpath(path, BASE):40s} {os.path.getsize(path)//1024} KB")
