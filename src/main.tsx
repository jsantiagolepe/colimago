import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { installExternalLinkHandler } from './core/platform/external-links';
import { installErrorLogging } from './core/platform/logging';
import './styles/base.css';

installErrorLogging();
installExternalLinkHandler();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
