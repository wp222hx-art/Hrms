#!/usr/bin/env python3
"""Compress card images to webp and slice icon sheets into individual icons."""
import os
import sys
from PIL import Image

BASE = '/home/user/webapp/frontend/public/cards'

def compress(src, dst, max_w=720, quality=82):
    img = Image.open(src).convert('RGBA')
    w, h = img.size
    if w > max_w:
        ratio = max_w / w
        img = img.resize((max_w, int(h * ratio)), Image.LANCZOS)
    # Save as webp (much smaller than png)
    img.save(dst, 'WEBP', quality=quality, method=6)
    print(f"  {os.path.basename(src):20s} {w}x{h}  ->  {os.path.basename(dst)} ({os.path.getsize(dst)//1024} KB)")

def slice_horizontal(src, out_dir, names, max_size=200):
    """Slice a horizontal sheet into N square icon files."""
    img = Image.open(src).convert('RGBA')
    w, h = img.size
    n = len(names)
    iw = w // n
    print(f"  Slicing {os.path.basename(src)} ({w}x{h}) into {n} icons of {iw}x{h} each")
    for i, name in enumerate(names):
        crop = img.crop((i * iw, 0, (i + 1) * iw, h))
        # Resize to max_size keeping aspect
        cw, ch = crop.size
        if cw > max_size or ch > max_size:
            ratio = max_size / max(cw, ch)
            crop = crop.resize((int(cw * ratio), int(ch * ratio)), Image.LANCZOS)
        dst = os.path.join(out_dir, f"{name}.webp")
        crop.save(dst, 'WEBP', quality=88, method=6)
        print(f"    [{i+1}/{n}] {name}.webp ({os.path.getsize(dst)//1024} KB)")

# --- Compress class cards (9) ---
print("=== Class cards ===")
classes_dir = os.path.join(BASE, 'classes')
for f in sorted(os.listdir(classes_dir)):
    if f.endswith('.png'):
        src = os.path.join(classes_dir, f)
        dst = src.replace('.png', '.webp')
        compress(src, dst, max_w=720, quality=82)
        os.remove(src)

# --- Compress reward cards (8) ---
print("\n=== Reward cards ===")
rewards_dir = os.path.join(BASE, 'rewards')
for f in sorted(os.listdir(rewards_dir)):
    if f.endswith('.png'):
        src = os.path.join(rewards_dir, f)
        dst = src.replace('.png', '.webp')
        compress(src, dst, max_w=720, quality=82)
        os.remove(src)

# --- Compress pack background ---
print("\n=== Pack background ===")
src = os.path.join(BASE, 'ui', 'pack_bg.png')
dst = src.replace('.png', '.webp')
compress(src, dst, max_w=1080, quality=78)
os.remove(src)

# --- Compress on-chain seal (small) ---
print("\n=== On-chain seal ===")
src = os.path.join(BASE, 'ui', 'onchain_seal.png')
dst = src.replace('.png', '.webp')
compress(src, dst, max_w=400, quality=88)
os.remove(src)

# --- Slice icon sheets ---
print("\n=== Slicing tab icons ===")
slice_horizontal(
    os.path.join(BASE, 'ui', 'tab_icons.png'),
    os.path.join(BASE, 'ui'),
    ['tab_lobby', 'tab_quest', 'tab_squad', 'tab_loot', 'tab_rank', 'tab_cards'],
    max_size=160,
)
os.remove(os.path.join(BASE, 'ui', 'tab_icons.png'))

print("\n=== Slicing rarity gems ===")
slice_horizontal(
    os.path.join(BASE, 'ui', 'rarity_gems.png'),
    os.path.join(BASE, 'ui'),
    ['rarity_common', 'rarity_uncommon', 'rarity_rare', 'rarity_epic', 'rarity_legendary', 'rarity_mythic'],
    max_size=140,
)
os.remove(os.path.join(BASE, 'ui', 'rarity_gems.png'))

print("\n=== Slicing action icons ===")
slice_horizontal(
    os.path.join(BASE, 'ui', 'action_icons.png'),
    os.path.join(BASE, 'ui'),
    ['act_clock', 'act_combo', 'act_coin', 'act_exp'],
    max_size=140,
)
os.remove(os.path.join(BASE, 'ui', 'action_icons.png'))

print("\n=== Slicing attribute icons ===")
slice_horizontal(
    os.path.join(BASE, 'ui', 'attr_icons.png'),
    os.path.join(BASE, 'ui'),
    ['attr_sta', 'attr_foc', 'attr_col', 'attr_cre', 'attr_end', 'attr_lrn'],
    max_size=120,
)
os.remove(os.path.join(BASE, 'ui', 'attr_icons.png'))

# --- Final summary ---
print("\n=== Final asset listing ===")
for root, dirs, files in os.walk(BASE):
    for f in sorted(files):
        path = os.path.join(root, f)
        rel = os.path.relpath(path, BASE)
        print(f"  {rel:40s} {os.path.getsize(path)//1024} KB")

total = sum(
    os.path.getsize(os.path.join(r, f))
    for r, d, files in os.walk(BASE)
    for f in files
)
print(f"\nTotal: {total // 1024} KB ({total / 1024 / 1024:.2f} MB)")
