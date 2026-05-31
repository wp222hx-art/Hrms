import React from 'react';
import './Avatar.css';

const COLORS = [
  '#3b63ec', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

function pickColor(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export default function Avatar({ name = '?', size = 32, src, className = '' }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const bg = pickColor(name || '?');
  return (
    <span
      className={`avatar ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42, background: src ? undefined : bg }}
      title={name}
    >
      {src ? <img src={src} alt={name} /> : initial}
    </span>
  );
}
