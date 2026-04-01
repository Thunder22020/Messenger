import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import "./styles/global.css";

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err =>
        console.warn('[sw] registration failed:', err)
    );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
