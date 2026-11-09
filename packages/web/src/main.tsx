import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './App';
import { DocsPage } from './components/DocsPage';
import { isDocsPath } from './lib/docsPages';
import { applyTheme, initialTheme } from './lib/theme';

applyTheme(initialTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isDocsPath(location.pathname) ? <DocsPage pathname={location.pathname} search={location.search} /> : <App />}</StrictMode>,
);
