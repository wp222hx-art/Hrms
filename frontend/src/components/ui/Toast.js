import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import './Toast.css';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(1);

  const push = useCallback((message, tone = 'info', duration = 2800) => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  const api = {
    info:    (m, d) => push(m, 'info', d),
    success: (m, d) => push(m, 'success', d),
    warning: (m, d) => push(m, 'warning', d),
    error:   (m, d) => push(m, 'danger', d),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
