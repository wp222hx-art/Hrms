import React from 'react';
import './Button.css';

/**
 * <Button variant="primary|secondary|ghost|danger" size="sm|md|lg" loading block />
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`btn btn--${variant} btn--${size} ${block ? 'btn--block' : ''} ${className}`}
      {...rest}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      <span className="btn__label">{children}</span>
    </button>
  );
}
