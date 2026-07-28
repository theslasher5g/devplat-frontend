import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/site/ErrorBoundary.tsx'
import { installGlobalErrorReporting } from './lib/errorReporting'

// Catches errors thrown outside render — event handlers, timers, rejected
// promises — which no React boundary can see.
installGlobalErrorReporting()

const fonts = document.createElement('link')
fonts.rel = 'stylesheet'
fonts.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Doto:wght@600;800&family=JetBrains+Mono:wght@400;500;700&display=swap'
document.head.appendChild(fonts)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Outside <App> and therefore outside the router: a crash in the router
        itself, or in a provider, still lands somewhere other than a blank page. */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
