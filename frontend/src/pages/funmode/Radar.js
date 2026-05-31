import React from 'react';

/**
 * 6-axis radar chart for player attributes.
 * size in px, attrs object with STA/FOC/COL/CRE/END/LRN (0-99).
 */
export default function Radar({ attrs, size = 160, color = '#00f6ff' }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;
  const keys = ['STA', 'FOC', 'COL', 'CRE', 'END', 'LRN'];
  const labels = { STA: '体力', FOC: '专注', COL: '协作', CRE: '创造', END: '抗压', LRN: '学习' };

  // 6 axis points
  const axisPt = (i, dist) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
    };
  };

  // Background rings
  const rings = [0.25, 0.5, 0.75, 1].map((scale) => {
    const pts = keys.map((_, i) => axisPt(i, r * scale));
    return pts.map((p) => `${p.x},${p.y}`).join(' ');
  });

  // Axis lines
  const axes = keys.map((_, i) => {
    const end = axisPt(i, r);
    return { x1: cx, y1: cy, x2: end.x, y2: end.y };
  });

  // Data polygon
  const dataPts = keys
    .map((k, i) => axisPt(i, (r * attrs[k]) / 99))
    .map((p) => `${p.x},${p.y}`)
    .join(' ');

  // Label points (slightly outside)
  const labelPts = keys.map((k, i) => ({ ...axisPt(i, r + 12), k }));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <stop offset="100%" stopColor={color} stopOpacity="0.1" />
        </radialGradient>
      </defs>
      {rings.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}
      {axes.map((a, i) => (
        <line key={i} {...a} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      <polygon
        points={dataPts}
        fill="url(#radarFill)"
        stroke={color}
        strokeWidth="2"
        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
      />
      {labelPts.map((p, i) => (
        <text
          key={i}
          x={p.x}
          y={p.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="9"
          fontWeight="700"
          fill="rgba(255,255,255,0.7)"
          letterSpacing="1"
        >
          {labels[p.k]}
        </text>
      ))}
    </svg>
  );
}
