import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { App } from './App.tsx';
import { legacyHashToPath } from './state/route.ts';
import './styles/index.css';

// v5 share links (#v=search&q=…) -> #/search?q=…
const legacy = legacyHashToPath(location.hash);
if (legacy) history.replaceState(null, '', '#' + legacy);

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
