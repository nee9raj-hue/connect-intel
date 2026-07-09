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

function candidateLabel(capture) {
  const name = [capture.firstName, capture.lastName].filter(Boolean).join(' ')
  return name || capture.company || capture.email || 'Contact'
}

function candidateMeta(capture) {
  const parts = [
    capture.title,
    capture.company,
    capture.email,
    capture.phone,
  ].filter(Boolean)
  return parts.join(' · ')
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
    this.candidates = []
    this.selected = new Set()
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

  async readCandidatesAsync() {
    const tryExtract = async () => {
      const extractReady = globalThis.__connectIntelExtractPageCandidatesReady
      const extract = globalThis.__connectIntelExtractPageCandidates
      if (typeof extractReady === 'function') {
        try {
          const ready = await extractReady()
          if (Array.isArray(ready) && ready.length) return ready
        } catch {
          /* fall through */
        }
      }
      if (typeof extract === 'function') {
        try {
          const list = extract()
          if (Array.isArray(list) && list.length) return list
        } catch {
          /* fall through */
        }
      }
      const single = globalThis.__connectIntelExtractPage?.()
      return single ? [single] : []
    }

    let candidates = await tryExtract()
    if (!candidates.length) {
      try {
        await sendMessage('CI_ENSURE_CAPTURE_SCRIPTS')
        await new Promise((resolve) => setTimeout(resolve, 120))
        candidates = await tryExtract()
      } catch {
        /* ignore reinject errors */
      }
    }
    return candidates
  }

  async readCaptureAsync() {
    const candidates = await this.readCandidatesAsync()
    this.candidates = candidates
    this.capture = candidates[0] || null
    if (candidates.length > 1) {
      this.selected = new Set(candidates.map((_, index) => index))
    } else {
      this.selected = new Set()
    }
    return this.capture
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
          <div class="ci-picker" hidden>
            <div class="ci-picker__toolbar">
              <button type="button" class="ci-picker__toggle-all">Select all</button>
              <span class="ci-picker__count"></span>
            </div>
            <div class="ci-picker__list"></div>
          </div>
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
      picker: root.querySelector('.ci-picker'),
      pickerList: root.querySelector('.ci-picker__list'),
      pickerCount: root.querySelector('.ci-picker__count'),
      pickerToggleAll: root.querySelector('.ci-picker__toggle-all'),
      preview: root.querySelector('.ci-preview'),
      capture: root.querySelector('.ci-capture'),
      open: root.querySelector('.ci-open'),
      signin: root.querySelector('.ci-signin'),
    }

    this.els.fab.addEventListener('click', () => this.togglePanel())
    this.els.close.addEventListener('click', () => this.setOpen(false))
    this.els.capture?.addEventListener('click', () => {
      if (this.candidates.length > 1) void this.submitSelectedCaptures()
      else void this.submitCapture()
    })
    this.els.pickerToggleAll?.addEventListener('click', () => this.toggleSelectAll())
    this.els.pickerList?.addEventListener('change', (event) => {
      const input = event.target
      if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return
      const index = Number(input.dataset.index)
      if (!Number.isFinite(index)) return
      if (input.checked) this.selected.add(index)
      else this.selected.delete(index)
      this.updatePickerCount()
    })
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
      .ci-picker {
        margin-top: 10px;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 10px;
        max-height: 240px;
        overflow: auto;
      }
      .ci-picker__toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 11px;
        color: #64748b;
      }
      .ci-picker__toggle-all {
        all: unset;
        cursor: pointer;
        color: #2563eb;
        font-weight: 600;
        font-size: 11px;
      }
      .ci-picker__row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 8px 0;
        border-top: 1px solid #f1f5f9;
        cursor: pointer;
      }
      .ci-picker__row:first-child { border-top: 0; }
      .ci-picker__row input { margin-top: 2px; }
      .ci-picker__name { font-size: 12px; font-weight: 700; color: #0f172a; }
      .ci-picker__meta { font-size: 10px; color: #64748b; line-height: 1.35; margin-top: 2px; }
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
    this.els.picker.hidden = true
    this.els.preview.hidden = true
    this.els.capture.hidden = true
    this.els.open.hidden = true
    this.els.status.hidden = false
    this.els.status.className = 'ci-status'
    this.els.status.textContent = 'Loading…'
  }

  renderSignIn() {
    this.els.picker.hidden = true
    this.els.preview.hidden = true
    this.els.capture.hidden = true
    this.els.open.hidden = true
    this.els.signin.hidden = false
    this.els.status.hidden = false
    this.els.status.textContent = 'Sign in to add contacts to your CRM pipeline.'
  }

  renderError(message) {
    this.els.signin.hidden = true
    this.els.picker.hidden = true
    this.els.preview.hidden = true
    this.els.capture.hidden = true
    this.els.open.hidden = true
    this.els.status.hidden = false
    this.els.status.className = 'ci-status ci-status--error'
    this.els.status.textContent = message
  }

  updatePickerCount() {
    const count = this.selected.size
    const total = this.candidates.length
    if (this.els.pickerCount) {
      this.els.pickerCount.textContent = `${count} of ${total} selected`
    }
    if (this.els.capture) {
      this.els.capture.textContent =
        count === 1 ? 'Add 1 contact to pipeline' : `Add ${count} contacts to pipeline`
      this.els.capture.disabled = count === 0
    }
    if (this.els.pickerToggleAll) {
      this.els.pickerToggleAll.textContent = count === total ? 'Clear all' : 'Select all'
    }
  }

  toggleSelectAll() {
    if (this.selected.size === this.candidates.length) {
      this.selected = new Set()
    } else {
      this.selected = new Set(this.candidates.map((_, index) => index))
    }
    if (this.els.pickerList) {
      for (const input of this.els.pickerList.querySelectorAll('input[type="checkbox"]')) {
        const index = Number(input.dataset.index)
        input.checked = this.selected.has(index)
      }
    }
    this.updatePickerCount()
  }

  renderMultiPicker(candidates) {
    this.els.preview.hidden = true
    this.els.picker.hidden = false
    this.els.open.hidden = true
    this.els.capture.hidden = false
    this.els.capture.disabled = false

    if (this.els.pickerList) {
      this.els.pickerList.innerHTML = candidates
        .map((capture, index) => {
          const checked = this.selected.has(index) ? 'checked' : ''
          const meta = candidateMeta(capture)
          return `
            <label class="ci-picker__row">
              <input type="checkbox" data-index="${index}" ${checked} />
              <span>
                <div class="ci-picker__name">${escapeHtml(candidateLabel(capture))}</div>
                ${meta ? `<div class="ci-picker__meta">${escapeHtml(meta)}</div>` : ''}
              </span>
            </label>
          `
        })
        .join('')
    }
    this.updatePickerCount()
  }

  renderPreview() {
    const signedIn = this.boot?.user
      ? `Signed in as <strong>${escapeHtml(this.boot.user.name || this.boot.user.email)}</strong>`
      : ''

    this.els.signin.hidden = true
    this.els.open.hidden = true
    this.resultLead = null

    if (!this.capture) {
      this.els.picker.hidden = true
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

    if (this.candidates.length > 1) {
      this.els.status.hidden = false
      this.els.status.className = 'ci-status'
      this.els.status.innerHTML =
        signedIn ||
        `${this.candidates.length} contacts found — select who to add to your pipeline.`
      this.renderMultiPicker(this.candidates)
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

    this.els.picker.hidden = true
    this.els.preview.hidden = false
    this.els.preview.innerHTML = `
      <div class="ci-preview__name">${escapeHtml(name || this.capture.company || 'New lead')}</div>
      ${renderCaptureFields(this.capture)}
    `

    this.els.capture.hidden = !hasMinimum
    this.els.capture.textContent = 'Add / update pipeline'
    this.els.capture.disabled = false
  }

  async submitSelectedCaptures() {
    const indices = [...this.selected].sort((a, b) => a - b)
    if (!indices.length) return

    this.els.capture.disabled = true
    this.els.status.className = 'ci-status'
    this.els.status.textContent = `Saving ${indices.length} contact(s)…`

    let added = 0
    let updated = 0
    let failed = 0

    for (const index of indices) {
      const fields = this.candidates[index]
      if (!fields) continue
      try {
        await sendMessage('CI_LOG', {
          action: 'extension.lead_capture_requested',
          metadata: { pageType: fields.pageType, bulk: true },
        }).catch(() => {})

        const result = await sendMessage('CI_CAPTURE_LEAD', { fields })
        added += 1
        if (result?.duplicate && result?.updated) updated += 1
        if (result?.lead) this.resultLead = result.lead
      } catch {
        failed += 1
      }
    }

    this.els.picker.hidden = true
    this.els.capture.hidden = true
    this.els.status.className = 'ci-status ci-status--ok'
    if (failed) {
      this.els.status.className = 'ci-status ci-status--error'
      this.els.status.textContent = `Saved ${added} contact(s); ${failed} failed.`
    } else if (updated) {
      this.els.status.textContent = `Added ${added} contact(s) — ${updated} updated existing leads.`
    } else {
      this.els.status.textContent = `Added ${added} contact(s) to pipeline.`
    }
    this.els.open.hidden = !this.resultLead?.pipelineUrl
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
      this.els.picker.hidden = true
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
