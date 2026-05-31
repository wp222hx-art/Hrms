import React from 'react';
import './StatCard.css';

export default function StatCard({ icon, label, value, hint, tone = 'brand', trend }) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__icon">{icon}</div>
      <div className="stat-card__body">
        <div className="stat-card__label">{label}</div>
        <div className="stat-card__value">{value}</div>
        {(hint || trend) && (
          <div className="stat-card__hint">
            {trend && (
              <span className={`stat-card__trend ${trend > 0 ? 'up' : trend < 0 ? 'down' : ''}`}>
                {trend > 0 ? '▲' : trend < 0 ? '▼' : '–'} {Math.abs(trend)}%
              </span>
            )}
            {hint && <span>{hint}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
