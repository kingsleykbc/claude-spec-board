import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { App } from './App';
import { DocsPage } from './components/DocsPage';
import { TooltipProvider } from './components/ui/tooltip/tooltip';
import { isDocsPath } from './lib/docsPages';
import { applyThemeChoice, savedThemeChoice } from './lib/theme';

// The saved choice (System when none) before the first paint; App and DocsPage then keep it in state.
applyThemeChoice(savedThemeChoice());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDocsPath(location.pathname) ? (
      <TooltipProvider>
        <DocsPage pathname={location.pathname} search={location.search} />
      </TooltipProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
);
