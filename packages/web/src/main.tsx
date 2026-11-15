import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { App } from './App';
import { DocsPage } from './components/DocsPage';
import { TooltipProvider } from './components/ui/tooltip/tooltip';
import { isDocsPath } from './lib/docsPages';
import { applyTheme, initialTheme } from './lib/theme';

applyTheme(initialTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider>{isDocsPath(location.pathname) ? <DocsPage pathname={location.pathname} search={location.search} /> : <App />}</TooltipProvider>
  </StrictMode>,
);
