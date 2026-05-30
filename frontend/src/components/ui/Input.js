import React from 'react';
import './Input.css';

export function Field({ label, hint, error, required, children, className = '' }) {
  return (
    <label className={`field ${error ? 'field--error' : ''} ${className}`}>
      {label && (
        <span className="field__label">
          {label}
          {required && <span className="field__req">*</span>}
        </span>
      )}
      {children}
      {(hint || error) && (
        <span className={`field__hint ${error ? 'field__hint--error' : ''}`}>
          {error || hint}
        </span>
      )}
    </label>
  );
}

export function Input({ className = '', ...rest }) {
  return <input className={`input ${className}`} {...rest} />;
}

export function TextArea({ className = '', ...rest }) {
  return <textarea className={`input input--textarea ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }) {
  return <select className={`input input--select ${className}`} {...rest}>{children}</select>;
}
