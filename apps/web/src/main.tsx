import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { legacyHashToPath } from './state/route.ts';
import './styles/index.css';

// old share links (#v=search&q=… from v5, #/search?q=… from the interim hash router) -> /search?q=…
const legacy = legacyHashToPath(location.hash);
if (legacy) history.replaceState(null, '', legacy);

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
