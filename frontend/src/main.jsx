import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ui/ErrorBoundary.jsx'
import { initNativeAppShell } from './lib/nativeApp.js'

registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) {
      registration.update()
      const interval = window.setInterval(() => registration.update(), 60 * 60 * 1000)
      registration.addEventListener?.('updatefound', () => window.clearInterval(interval))
    }
  },
})
void initNativeAppShell()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
