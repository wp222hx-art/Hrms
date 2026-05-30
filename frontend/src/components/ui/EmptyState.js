import React from 'react';
import './EmptyState.css';

export default function EmptyState({ icon, title, hint, action }) {
  return (
    <div className="empty">
      {icon && <div className="empty__icon">{icon}</div>}
      <div className="empty__title">{title}</div>
      {hint && <div className="empty__hint">{hint}</div>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}
