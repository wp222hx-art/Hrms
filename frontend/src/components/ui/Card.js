import React from 'react';
import './Card.css';

export default function Card({ title, extra, children, padded = true, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || extra) && (
        <header className="card__head">
          <div className="card__title">{title}</div>
          {extra && <div className="card__extra">{extra}</div>}
        </header>
      )}
      <div className={`card__body ${padded ? 'card__body--padded' : ''}`}>{children}</div>
    </section>
  );
}
