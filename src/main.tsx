import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent benign selection-range / unmounted node errors from cluttering the console
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.message && (
      event.message.includes('selectNode') || 
      event.message.includes('Range') || 
      event.message.includes('parent')
    )) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
