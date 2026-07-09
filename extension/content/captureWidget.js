/**
 * Connect Intel capture widget — LinkedIn profiles, team pages, and contact-rich sites.
 */

const WIDGET_HOST_ID = 'connect-intel-capture-host'

function runtime() {
  return globalThis.__connectIntelRuntime
}

function extensionIconUrl() {
  try {
    return chrome.runtime.getURL('icons/icon-48.png')
  } catch {
    return ''
  }
}

function extensionVersion() {
  try {
    return chrome.runtime.getManifest().version || ''
  } catch {
    return ''
  }
}

function sendMessage(type, payload = {}) {
  const rt = runtime()
  if (!rt?.isExtensionContextAlive()) {
    return Promise.reject(new Error('extension_context_invalidated'))
  }
  return rt.safeSendMessageAsync({ type, ...payload }).then((response) => {
    if (response?.ok === false) throw new Error(response.error || 'Request failed')
    return response?.result ?? response
  })
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function previewRow(label, value) {
  if (!value) return ''
  return `<div class="ci-preview__row"><span class="ci-preview__label">${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`
}

function renderCaptureFields(capture) {
  const name = [capture.firstName, capture.lastName].filter(Boolean).join(' ')
  const rows = [
    previewRow('Name', name),
    previewRow('Title', capture.title),
    previewRow('Company', capture.company),
    previewRow('Location', capture.location || [capture.city, capture.state].filter(Boolean).join(', ')),
    previewRow('Email', capture.email),
    previewRow('Phone', capture.phone),
    previewRow('LinkedIn', capture.linkedin),
    previewRow('Industry', capture.industry),
  ].filter(Boolean)

  return rows.length ? rows.join('') : '<div class="ci-preview__row">No fields detected yet.</div>'
}

function isLinkedInProfilePage(url = '') {
  return /linkedin\.com\/in\//i.test(String(url || location.href || ''))
}

function isBlockedHost() {
  const host = String(location.hostname || '').toLowerCase()
  return (
    host.includes('mail.google.com') ||
    host.includes('connectintel.net') ||
    host.includes('chrome.google.com')
  )
}

function shouldMountWidget() {
  if (isBlockedHost()) return false
  if (isLinkedInProfilePage()) return true
  const check = globalThis.__connectIntelShouldShowCaptureWidget
  if (typeof check === 'function') return check()
  const signals = globalThis.__connectIntelContactPageParse?.quickContactSignals
  return typeof signals === 'function' ? signals() : false
}

class ConnectIntelCaptureWidget {
  constructor() {
    this.open = false
    this.loading = false
    this.active = false
    this.boot = null
    this.capture = null
    this.resultLead = null
    this.host = null
    this.shadow = null
    this.els = {}
  }

  teardown() {
    this.active = false
    this.host?.remove()
    this.host = null
    this.shadow = null
    this.els = {}
  }

  async readCaptureAsync() {
    const tryExtract = async () => {
      const extractReady = globalThis.__connectIntelExtractPageReady
      const extract = globalThis.__connectIntelExtractPage
      if (typeof extractReady === 'function') {
        try {
          const ready = await extractReady()
          if (ready) return ready
        } catch {
          /* fall through */
        }
      }
      if (typeof extract !== 'function') return null
      try {
        return extract()
      } catch {
        return null
      }
    }

    let capture = await tryExtract()
    if (!capture) {
      try {
        await sendMessage('CI_ENSURE_CAPTURE_SCRIPTS')
        await new Promise((resolve) => setTimeout(resolve, 120))
        capture = await tryExtract()
      } catch {
        /* ignore reinject errors */
      }
    }
    return capture
  }

  mount() {
    if (!runtime()?.isExtensionContextAlive()) return
    if (!shouldMountWidget()) {
      this.watchForCapturePage()
      return
    }
    if (document.getElementById(WIDGET_HOST_ID)) return

    this.active = true
    runtime()?.onExtensionContextInvalidated(() => this.teardown())

    const iconUrl = extensionIconUrl()
    this.host = document.createElement('div')
    this.host.id = WIDGET_HOST_ID
    this.shadow = this.host.attachShadow({ mode: 'closed' })

    const style = document.createElement('style')
    style.textContent = this.styles()
    this.shadow.appendChild(style)

    const root = document.createElement('div')
    root.className = 'ci-root'
    root.innerHTML = `
      <button type="button" class="ci-fab" aria-label="Add to Connect Intel" title="Add to Connect Intel">
        <img class="ci-fab__icon" src="${iconUrl}" alt="" />
      </button>
      <div class="ci-panel" hidden>
        <header class="ci-panel__head">
          <img class="ci-panel__logo" src="${iconUrl}" alt="" />
          <div>
            <div class="ci-panel__title">Add to pipeline</div>
            <div class="ci-panel__tag">Connect Intel · audited capture${extensionVersion() ? ` · v${extensionVersion()}` : ''}</div>
          </div>
          <button type="button" class="ci-panel__close" aria-label="Close">×</button>
        </header>
        <div class="ci-panel__body">
          <div class="ci-status">Open a profile or company page to capture.</div>
          <div class="ci-preview" hidden></div>
          <button type="button" class="ci-btn ci-btn--primary ci-capture" hidden data-action="capture">Add to pipeline</button>
          <button type="button" class="ci-btn ci-btn--secondary ci-open" hidden data-action="open">Open in Connect Intel</button>
          <button type="button" class="ci-btn ci-btn--primary ci-signin" hidden data-action="signin">Sign in</button>
        </div>
      </div>
    `
    this.shadow.appendChild(root)

    this.els = {
      fab: root.querySelector('.ci-fab'),
      panel: root.querySelector('.ci-panel'),
      close: root.querySelector('.ci-panel__close'),
      status: root.querySelector('.ci-status'),
      preview: root.querySelector('.ci-preview'),
      capture: root.querySelector('.ci-capture'),
      open: root.querySelector('.ci-open'),
      signin: root.querySelector('.ci-signin'),
    }

    this.els.fab.addEventListener('click', () => this.togglePanel())
    this.els.close.addEventListener('click', () => this.setOpen(false))
    this.els.capture?.addEventListener('click', () => this.submitCapture())
    this.els.open?.addEventListener('click', () => this.openInApp())
    this.els.signin?.addEventListener('click', () => this.signIn())

    document.documentElement.appendChild(this.host)
  }

  watchForCapturePage() {
    if (this._navWatch) return
    this._navWatch = true
    const check = () => {
      if (!runtime()?.isExtensionContextAlive()) return
      if (shouldMountWidget() && !document.getElementById(WIDGET_HOST_ID)) {
        this.mount()
      }
    }
    window.addEventListener('popstate', check)
    const origPush = history.pushState
    const origReplace = history.replaceState
    history.pushState = function (...args) {
      const out = origPush.apply(this, args)
      check()
      return out
    }
    history.replaceState = function (...args) {
      const out = origReplace.apply(this, args)
      check()
      return out
    }
    setInterval(check, 2000)
    check()
  }

  styles() {
    return `
      :host, .ci-root { all: initial; }
      .ci-root {
        position: fixed;
        right: 18px;
        bottom: 24px;
        z-index: 2147483646;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .ci-fab {
        all: unset;
        box-sizing: border-box;
        width: 52px;
        height: 52px;
        border-radius: 999px;
        background: #fff;
        border: 2px solid #FF773D;
        box-shadow: 0 8px 28px rgba(15, 23, 42, 0.18);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ci-fab__icon { width: 30px; height: 30px; object-fit: contain; }
      .ci-panel {
        position: absolute;
        right: 64px;
        bottom: 0;
        width: 320px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.2);
        color: #0f172a;
      }
      .ci-panel__head {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px;
        border-bottom: 1px solid #e2e8f0;
        background: #fff;
        border-radius: 14px 14px 0 0;
      }
      .ci-panel__logo { width: 28px; height: 28px; }
      .ci-panel__title { font-size: 14px; font-weight: 700; }
      .ci-panel__tag { font-size: 10px; color: #64748b; }
      .ci-panel__close {
        all: unset;
        margin-left: auto;
        width: 28px;
        height: 28px;
        cursor: pointer;
        font-size: 20px;
        color: #64748b;
      }
      .ci-panel__body { padding: 12px; }
      .ci-status, .ci-preview {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 12px;
        font-size: 12px;
        line-height: 1.45;
        color: #475569;
      }
      .ci-preview { margin-top: 10px; }
      .ci-preview__name { font-weight: 700; color: #0f172a; font-size: 13px; margin-bottom: 8px; }
      .ci-preview__row {
        display: grid;
        grid-template-columns: 72px 1fr;
        gap: 8px;
        padding: 4px 0;
        border-top: 1px solid #f1f5f9;
        font-size: 11px;
        line-height: 1.35;
      }
      .ci-preview__row:first-child { border-top: 0; }
      .ci-preview__label { color: #64748b; font-weight: 600; }
      .ci-btn {
        all: unset;
        box-sizing: border-box;
        display: block;
        width: 100%;
        text-align: center;
        border-radius: 8px;
        padding: 9px 12px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 8px;
      }
      .ci-btn--primary { background: #2563eb; color: #fff; }
      .ci-btn--secondary { background: #e2e8f0; color: #0f172a; }
      .ci-status--ok { color: #15803d; }
      .ci-status--error { color: #b91c1c; }
    `
  }

  setOpen(next) {
    this.open = next
    if (this.els.panel) this.els.panel.hidden = !next
    if (next) void this.refresh()
  }

  togglePanel() {
    this.setOpen(!this.open)
  }

  async refresh() {
    if (!this.active || this.loading) return
    this.loading = true
    this.renderLoading()

    try {
      this.capture = await this.readCaptureAsync()
      this.boot = await sendMessage('CI_BOOTSTRAP')
      await sendMessage('CI_LOG', {
        action: 'extension.capture_opened',
        metadata: { pageType: this.capture?.pageType || 'unknown' },
      }).catch(() => {})
      this.renderPreview()
    } catch (err) {
      if (runtime()?.isContextInvalidatedError?.(err.message)) {
        this.renderError('Extension updated — refresh this tab.')
        this.teardown()
        return
      }
      if (String(err.message).includes('not_signed_in')) {
        this.renderSignIn()
      } else {
        this.renderError(err.message || 'Could not load Connect Intel')
      }
    } finally {
      this.loading = false
    }
  }

  renderLoading() {
    this.els.signin.hidden = true
    this.els.preview.hidden = true
    this.els.capture.hidden = true
    this.els.open.hidden = true
    this.els.status.hidden = false
    this.els.status.className = 'ci-status'
    this.els.status.textContent = 'Loading…'
  }

  renderSignIn() {
    this.els.preview.hidden = true
    this.els.capture.hidden = true
    this.els.open.hidden = true
    this.els.signin.hidden = false
    this.els.status.hidden = false
    this.els.status.textContent = 'Sign in to add contacts to your CRM pipeline.'
  }

  renderError(message) {
    this.els.signin.hidden = true
    this.els.preview.hidden = true
    this.els.capture.hidden = true
    this.els.open.hidden = true
    this.els.status.hidden = false
    this.els.status.className = 'ci-status ci-status--error'
    this.els.status.textContent = message
  }

  renderPreview() {
    const signedIn = this.boot?.user
      ? `Signed in as <strong>${escapeHtml(this.boot.user.name || this.boot.user.email)}</strong>`
      : ''

    this.els.signin.hidden = true
    this.els.open.hidden = true
    this.resultLead = null

    if (!this.capture) {
      this.els.preview.hidden = true
      this.els.capture.hidden = true
      this.els.open.hidden = true
      this.els.signin.hidden = true
      this.els.status.hidden = false
      const onProfile = /linkedin\.com\/in\//i.test(location.href)
      const onContact = this.capture?.pageType === 'contact_page'
      this.els.status.innerHTML = onProfile
        ? `${signedIn}<br/>Profile is still loading — close and reopen this panel, or refresh the tab.<br/><span style="color:#64748b">If this persists, reload the Connect Intel extension.</span>`
        : onContact
          ? `${signedIn}<br/>Contact details are still loading — close and reopen this panel.`
          : `${signedIn}<br/>No contact found on this page yet. Try a team/about page, directory, or LinkedIn profile.`
      return
    }

    const name = [this.capture.firstName, this.capture.lastName].filter(Boolean).join(' ')
    const hasMinimum =
      name ||
      this.capture.company ||
      this.capture.email ||
      this.capture.phone ||
      this.capture.linkedin

    this.els.status.hidden = false
    this.els.status.className = 'ci-status'
    this.els.status.innerHTML = signedIn || 'Review details before adding to pipeline.'

    this.els.preview.hidden = false
    this.els.preview.innerHTML = `
      <div class="ci-preview__name">${escapeHtml(name || this.capture.company || 'New lead')}</div>
      ${renderCaptureFields(this.capture)}
    `

    this.els.capture.hidden = !hasMinimum
    this.els.capture.textContent = 'Add / update pipeline'
    this.els.capture.disabled = false
  }

  async submitCapture() {
    if (!this.capture) return
    this.els.capture.disabled = true
    this.els.status.className = 'ci-status'
    this.els.status.textContent = 'Saving to pipeline…'

    try {
      await sendMessage('CI_LOG', {
        action: 'extension.lead_capture_requested',
        metadata: { pageType: this.capture.pageType },
      }).catch(() => {})

      const result = await sendMessage('CI_CAPTURE_LEAD', { fields: this.capture })
      this.resultLead = result?.lead || null

      this.els.status.className = 'ci-status ci-status--ok'
      this.els.status.textContent = result?.message || 'Lead saved to pipeline'
      this.els.capture.hidden = true
      this.els.open.hidden = !this.resultLead?.pipelineUrl
    } catch (err) {
      this.els.capture.disabled = false
      this.renderError(err.message || 'Could not add lead')
    }
  }

  openInApp() {
    if (!this.resultLead?.pipelineUrl) return
    runtime()?.safeSendMessage({ type: 'OPEN_TAB', url: this.resultLead.pipelineUrl })
  }

  signIn() {
    runtime()?.safeSendMessage({ type: 'OPEN_SIGN_IN' })
  }
}

const widget = new ConnectIntelCaptureWidget()
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => widget.mount())
} else {
  widget.mount()
}
