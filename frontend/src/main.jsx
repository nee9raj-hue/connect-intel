import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { applyBrandCssVars } from './lib/brandTokens'
import './index.css'
import './styles/hubspot-premium.css'
import './styles/pipeline-list-polish.css'
import './styles/platform-design-system.css'
import './styles/panel-preferences.css'
import './styles/marketing-hub-v3.css'
import App from './App.jsx'
import ErrorBoundary from './components/ui/ErrorBoundary.jsx'
import { initNativeAppShell } from './lib/nativeApp.js'
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      setInterval(() => registration.update(), 60 * 60 * 1000)
    }
  },
})
void initNativeAppShell()
applyBrandCssVars()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
