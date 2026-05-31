import React from 'react';
import './Badge.css';

/**
 * <Badge tone="neutral|info|success|warning|danger|brand"> text </Badge>
 */
export default function Badge({ tone = 'neutral', children, dot = false, className = '' }) {
  return (
    <span className={`badge badge--${tone} ${className}`}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  );
}
