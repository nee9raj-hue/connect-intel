import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './styles/hubspot-premium.css'
import './styles/platform-design-system.css'
import './styles/panel-preferences.css'
import App from './App.jsx'
import ErrorBoundary from './components/ui/ErrorBoundary.jsx'
import { initNativeAppShell } from './lib/nativeApp.js'
import { bindPwaUpdate, markPwaUpdatePending } from './lib/pwaUpdate.js'

bindPwaUpdate(
  registerSW({
    onNeedRefresh() {
      markPwaUpdatePending()
    },
  })
)
void initNativeAppShell()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
