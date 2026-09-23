import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyBrandCssVars } from './lib/brandTokens'
import './index.css'
import './styles/hubspot-premium.css'
import './styles/pipeline-list-polish.css'
import './styles/pipeline-premium.css'
import './styles/lead-workspace.css'
import './styles/lead-deals.css'
import './styles/platform-design-system.css'
import './styles/panel-preferences.css'
import './styles/marketing-hub-v3.css'
import './styles/connect-intel-ai.css'
import './styles/marketing-mailchimp.css'
import './styles/calendar.css'
import App from './App.jsx'
import CourierFlowPreview from './components/crm/CourierFlowPreview.jsx'
import ErrorBoundary from './components/ui/ErrorBoundary.jsx'
import { initNativeAppShell } from './lib/nativeApp.js'
import { initDeployRecovery } from './lib/deployRecovery.js'

initDeployRecovery()
void initNativeAppShell()
applyBrandCssVars()

const courierPreview =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === 'courier'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {courierPreview ? <CourierFlowPreview /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
)
