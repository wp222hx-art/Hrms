import React from 'react';
import './MiniChart.css';

/**
 * Tiny SVG line chart. Pure React, no external libs.
 * <LineChart data={[{label, value}, ...]} height={140} />
 */
export function LineChart({ data, height = 160, color = 'var(--brand-500)' }) {
  if (!data || data.length === 0) return null;
  const w = 600;
  const h = height;
  const padX = 32, padY = 18;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = 0;
  const stepX = (w - padX * 2) / Math.max(data.length - 1, 1);
  const points = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = h - padY - ((d.value - min) / (max - min || 1)) * (h - padY * 2);
    return [x, y];
  });
  const pathD = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const areaD = `${pathD} L${points[points.length - 1][0]},${h - padY} L${points[0][0]},${h - padY} Z`;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="chart-svg">
        <defs>
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((g, i) => (
          <line
            key={i}
            x1={padX} x2={w - padX}
            y1={padY + (h - padY * 2) * g} y2={padY + (h - padY * 2) * g}
            stroke="var(--border)" strokeDasharray="4 4"
          />
        ))}
        <path d={areaD} fill="url(#chartFill)" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color} />
        ))}
        {data.map((d, i) => (
          <text
            key={i}
            x={padX + i * stepX}
            y={h - 2}
            fontSize="10"
            textAnchor="middle"
            fill="var(--text-3)"
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

/**
 * Tiny SVG bar chart.
 * <BarChart data={[{label, value, color?}]} height={160} />
 */
export function BarChart({ data, height = 160 }) {
  if (!data || data.length === 0) return null;
  const w = 600;
  const h = height;
  const padX = 28, padY = 18;
  const max = Math.max(...data.map((d) => d.value), 1);
  const innerW = w - padX * 2;
  const barGap = 8;
  const barW = (innerW - barGap * (data.length - 1)) / data.length;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="chart-svg">
        {[0.25, 0.5, 0.75].map((g, i) => (
          <line
            key={i}
            x1={padX} x2={w - padX}
            y1={padY + (h - padY * 2) * g} y2={padY + (h - padY * 2) * g}
            stroke="var(--border)" strokeDasharray="4 4"
          />
        ))}
        {data.map((d, i) => {
          const x = padX + i * (barW + barGap);
          const barH = ((d.value / max) || 0) * (h - padY * 2);
          const y = h - padY - barH;
          return (
            <g key={i}>
              <rect
                x={x} y={y}
                width={barW} height={barH}
                rx="3" ry="3"
                fill={d.color || 'var(--brand-500)'}
              />
              <text x={x + barW / 2} y={h - 2} fontSize="10" textAnchor="middle" fill="var(--text-3)">
                {d.label}
              </text>
              <text x={x + barW / 2} y={y - 4} fontSize="10" textAnchor="middle" fill="var(--text-2)">
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Donut chart for status breakdowns. <Donut segments={[{value, color, label}]} /> */
export function Donut({ segments, size = 140, thickness = 18, centerLabel }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="var(--gray-200)" strokeWidth={thickness} fill="none"
        />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const dasharray = `${len} ${c - len}`;
          const dashoffset = c - offset;
          offset += len;
          return (
            <circle
              key={i}
              cx={size / 2} cy={size / 2} r={r}
              stroke={s.color}
              strokeWidth={thickness}
              fill="none"
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      {centerLabel && <div className="donut__center">{centerLabel}</div>}
    </div>
  );
}
