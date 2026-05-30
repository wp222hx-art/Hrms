import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n';
import './styles/tokens.css';
import './styles/global.css';
import App from './App';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './components/ui/Toast';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ToastProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </ToastProvider>
  </React.StrictMode>
);
