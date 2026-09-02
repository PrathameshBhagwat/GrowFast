import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { App } from './App';
import './index.css';

// Suppress third-party browser extension / web-vitals injected script exceptions
window.addEventListener('error', (event) => {
  if (
    event.message?.includes("reading 'startTime'") ||
    event.message?.includes('reportAllChanges') ||
    (event.error?.stack && event.error.stack.includes('reportAllChanges'))
  ) {
    event.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason?.message?.includes("reading 'startTime'") ||
    event.reason?.message?.includes('reportAllChanges') ||
    (event.reason?.stack && event.reason.stack.includes('reportAllChanges'))
  ) {
    event.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
