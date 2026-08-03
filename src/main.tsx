import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Self-hosted rather than fetched from Google at runtime — see fonts.css for
// why that mattered legally as well as technically.
import './fonts.css'
import App from './App.tsx'
import ErrorBoundary from './components/site/ErrorBoundary.tsx'
import { installGlobalErrorReporting } from './lib/errorReporting'

// Catches errors thrown outside render — event handlers, timers, rejected
// promises — which no React boundary can see.
installGlobalErrorReporting()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Outside <App> and therefore outside the router: a crash in the router
        itself, or in a provider, still lands somewhere other than a blank page. */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
