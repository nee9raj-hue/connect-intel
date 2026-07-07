/**
 * Lusha-style floating Connect Intel widget on Gmail.
 * Shadow DOM keeps Gmail styles from breaking the panel.
 */

void (function connectIntelGmailPageWidget() {
  if (globalThis.__connectIntelGmailPageWidgetBooted) {
    globalThis.__connectIntelGmailPageWidgetTryMount?.()
    return
  }
  globalThis.__connectIntelGmailPageWidgetBooted = true

  const WIDGET_HOST_ID = 'connect-intel-widget-host'

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

function sendMessage(type, payload = {}) {
  const rt = runtime()
  if (!rt?.isExtensionContextAlive()) {
    return Promise.reject(new Error('extension_context_invalidated'))
  }

  return rt.safeSendMessageAsync({ type, ...payload }).then((response) => {
    if (response?.ok === false) {
      const err = new Error(response.error || 'Request failed')
      err.data = response.data
      throw err
    }
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

class ConnectIntelPageWidget {
  constructor() {
    this.open = false
    this.loading = false
    this.active = false
    this.boot = null
    this.context = { emails: [], subject: '', recipientNames: [] }
    this.matchResult = null
    this.currentLead = null
    this.host = null
    this.shadow = null
    this.els = {}
    this.onHashChange = null
  }

  teardown() {
    this.active = false
    if (this.onHashChange) {
      window.removeEventListener('hashchange', this.onHashChange)
      this.onHashChange = null
    }
    if (this.onRemountCheck) {
      clearInterval(this.onRemountCheck)
      this.onRemountCheck = null
    }
    this.host?.remove()
    this.host = null
    this.shadow = null
    this.els = {}
  }

  mount() {
    if (!runtime()?.isExtensionContextAlive()) return
    if (document.getElementById(WIDGET_HOST_ID)) return

    this.active = true
    runtime()?.onExtensionContextInvalidated(() => {
      if (!this.host) return
      this.renderContextInvalidated()
    })

    const iconUrl = extensionIconUrl()
    this.host = document.createElement('div')
    this.host.id = WIDGET_HOST_ID
    Object.assign(this.host.style, {
      position: 'fixed',
      right: '56px',
      bottom: '24px',
      zIndex: '2147483647',
      pointerEvents: 'none',
    })
    this.shadow = this.host.attachShadow({ mode: 'closed' })

    const style = document.createElement('style')
    style.textContent = this.styles()
    this.shadow.appendChild(style)

    const root = document.createElement('div')
    root.className = 'ci-root'
    root.innerHTML = `
      <button type="button" class="ci-fab" aria-label="Connect Intel" title="Connect Intel">
        <img class="ci-fab__icon" src="${iconUrl}" alt="" />
        <span class="ci-fab__badge" hidden></span>
      </button>
      <div class="ci-panel" hidden>
        <header class="ci-panel__head">
          <img class="ci-panel__logo" src="${iconUrl}" alt="" />
          <div>
            <div class="ci-panel__title">Connect Intel</div>
            <div class="ci-panel__tag">Trail-only · workspace-scoped</div>
          </div>
          <button type="button" class="ci-panel__close" aria-label="Close">×</button>
        </header>
        <div class="ci-panel__body">
          <div class="ci-status">Open a Gmail thread to match a pipeline lead.</div>
          <div class="ci-lead" hidden></div>
          <div class="ci-actions" hidden>
            <button type="button" class="ci-btn ci-btn--secondary" data-action="open">Open in Connect Intel</button>
            <button type="button" class="ci-btn ci-btn--primary" data-action="sync">Sync email trail</button>
          </div>
          <div class="ci-compose" hidden>
            <div class="ci-compose__head">Send from CRM</div>
            <label class="ci-label">Goal (for AI draft)</label>
            <input type="text" class="ci-input" data-field="agenda" placeholder="Follow up on USA rates…" maxlength="500" />
            <button type="button" class="ci-btn ci-btn--secondary" data-action="generate">Generate draft</button>
            <label class="ci-label">Subject</label>
            <input type="text" class="ci-input" data-field="subject" placeholder="Subject" maxlength="500" />
            <label class="ci-label">Body</label>
            <textarea class="ci-textarea" data-field="body" rows="5" placeholder="Email body"></textarea>
            <button type="button" class="ci-btn ci-btn--primary" data-action="send">Send &amp; log in CRM</button>
            <div class="ci-compose__hint">Sends from your connected work Gmail and logs to the lead trail.</div>
          </div>
          <button type="button" class="ci-btn ci-btn--primary ci-signin" hidden data-action="signin">Sign in</button>
        </div>
      </div>
    `
    this.shadow.appendChild(root)

    this.els = {
      fab: root.querySelector('.ci-fab'),
      badge: root.querySelector('.ci-fab__badge'),
      panel: root.querySelector('.ci-panel'),
      close: root.querySelector('.ci-panel__close'),
      status: root.querySelector('.ci-status'),
      lead: root.querySelector('.ci-lead'),
      actions: root.querySelector('.ci-actions'),
      compose: root.querySelector('.ci-compose'),
      signin: root.querySelector('.ci-signin'),
      agenda: root.querySelector('[data-field="agenda"]'),
      subject: root.querySelector('[data-field="subject"]'),
      body: root.querySelector('[data-field="body"]'),
    }

    this.els.fab.addEventListener('click', () => this.togglePanel())
    this.els.close.addEventListener('click', () => this.setOpen(false))
    root.addEventListener('click', (event) => {
      if (event.target?.closest?.('[data-action="reload-tab"]')) this.reloadTab()
    })
    root.querySelector('[data-action="open"]')?.addEventListener('click', () => this.openInApp())
    root.querySelector('[data-action="sync"]')?.addEventListener('click', () => this.syncTrail())
    root.querySelector('[data-action="signin"]')?.addEventListener('click', () => this.signIn())
    root.querySelector('[data-action="generate"]')?.addEventListener('click', () => this.generateDraft())
    root.querySelector('[data-action="send"]')?.addEventListener('click', () => this.sendEmail())
    root.querySelector('[data-action="reload-tab"]')?.addEventListener('click', () => this.reloadTab())
    this.bindComposeInteractionGuards(root)

    const mountTarget = document.body || document.documentElement
    mountTarget.appendChild(this.host)
    this.scheduleRemountChecks()

    this.onHashChange = () => {
      if (!this.active) return
      if (this.open) void this.refresh()
    }
    window.addEventListener('hashchange', this.onHashChange)
  }

  scheduleRemountChecks() {
    if (this.onRemountCheck) return
    this.onRemountCheck = setInterval(() => {
      if (!document.getElementById(WIDGET_HOST_ID) && runtime()?.isExtensionContextAlive()) {
        this.active = false
        this.host = null
        this.mount()
      }
    }, 2000)
  }

  reloadTab() {
    runtime()?.safeSendMessage({ type: 'CI_RELOAD_GMAIL_TAB' })
    window.location.reload()
  }

  bindComposeInteractionGuards(root) {
    const stop = (event) => {
      event.stopPropagation()
    }
    // Only guard editable fields — panel-level capture click handlers block child buttons.
    for (const field of root.querySelectorAll('.ci-input, .ci-textarea')) {
      field.addEventListener('mousedown', stop, true)
      field.addEventListener('keydown', stop)
      field.addEventListener('keyup', stop)
      field.addEventListener('keypress', stop)
    }
  }

  styles() {
    return `
      :host, .ci-root { all: initial; }
      .ci-root {
        position: relative;
        pointer-events: auto;
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
        box-shadow: 0 8px 28px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(255, 119, 61, 0.25);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .ci-fab:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.22), 0 4px 12px rgba(255, 119, 61, 0.3);
      }
      .ci-fab__icon {
        width: 30px;
        height: 30px;
        object-fit: contain;
        pointer-events: none;
      }
      .ci-fab__badge {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: #16a34a;
        border: 2px solid #fff;
      }
      .ci-fab__badge.ci-fab__badge--warn {
        background: #f59e0b;
      }
      .ci-panel {
        position: absolute;
        right: 64px;
        bottom: 0;
        width: 320px;
        max-height: min(85vh, 620px);
        overflow: auto;
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
        padding: 12px 12px 10px;
        border-bottom: 1px solid #e2e8f0;
        background: #fff;
        border-radius: 14px 14px 0 0;
      }
      .ci-panel__logo {
        width: 28px;
        height: 28px;
        object-fit: contain;
        flex-shrink: 0;
      }
      .ci-panel__title {
        font-size: 14px;
        font-weight: 700;
        line-height: 1.2;
      }
      .ci-panel__tag {
        font-size: 10px;
        color: #64748b;
        margin-top: 2px;
      }
      .ci-panel__close {
        all: unset;
        margin-left: auto;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: #64748b;
        cursor: pointer;
      }
      .ci-panel__close:hover { background: #f1f5f9; }
      .ci-panel__body { padding: 12px; }
      .ci-status {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 12px;
        font-size: 12px;
        line-height: 1.45;
        color: #475569;
      }
      .ci-status--ok { color: #15803d; }
      .ci-status--error { color: #b91c1c; }
      .ci-lead {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 12px;
        margin-top: 10px;
        font-size: 12px;
        line-height: 1.45;
      }
      .ci-lead__name { font-weight: 700; font-size: 13px; color: #0f172a; }
      .ci-lead__meta { color: #64748b; margin-top: 4px; }
      .ci-actions { margin-top: 10px; }
      .ci-compose {
        margin-top: 10px;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 12px;
      }
      .ci-compose__head {
        font-size: 12px;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 8px;
      }
      .ci-compose__hint {
        font-size: 10px;
        color: #64748b;
        margin-top: 8px;
        line-height: 1.4;
      }
      .ci-label {
        display: block;
        font-size: 10px;
        font-weight: 600;
        color: #64748b;
        margin: 8px 0 4px;
      }
      .ci-label:first-of-type { margin-top: 0; }
      .ci-input, .ci-textarea {
        box-sizing: border-box;
        display: block;
        width: 100%;
        margin: 0;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 8px 10px;
        font-family: inherit;
        font-size: 12px;
        line-height: 1.4;
        color: #0f172a;
        background: #fff;
        -webkit-user-select: text;
        user-select: text;
      }
      .ci-textarea { resize: vertical; min-height: 72px; }
      .ci-input:focus, .ci-textarea:focus {
        outline: 2px solid #93c5fd;
        border-color: #3b82f6;
      }
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
        margin-top: 6px;
      }
      .ci-btn--primary { background: #2563eb; color: #fff; }
      .ci-btn--primary:hover { background: #1d4ed8; }
      .ci-btn--secondary { background: #e2e8f0; color: #0f172a; }
      .ci-btn--secondary:hover { background: #cbd5e1; }
      .ci-btn:disabled { opacity: 0.6; cursor: wait; }
      .ci-signin { margin-top: 10px; }
      .ci-link {
        all: unset;
        color: #2563eb;
        font-weight: 600;
        cursor: pointer;
        text-decoration: underline;
      }
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

  readContext() {
    const extract = globalThis.__connectIntelExtractGmail
    if (typeof extract !== 'function') {
      return { emails: [], subject: '', recipientNames: [], threadId: '', domainHints: [] }
    }
    try {
      return extract()
    } catch {
      return { emails: [], subject: '', recipientNames: [], threadId: '', domainHints: [] }
    }
  }

  async refresh() {
    if (!this.active || this.loading) return
    this.loading = true
    this.renderLoading()

    try {
      this.context = this.readContext()
      this.boot = await sendMessage('CI_BOOTSTRAP')
      this.matchResult = await sendMessage('CI_MATCH_THREAD', { context: this.context })
      this.renderMatch()
      this.updateBadge()
    } catch (err) {
      if (runtime()?.isContextInvalidatedError?.(err.message)) {
        this.renderContextInvalidated()
        return
      }
      if (String(err.message).includes('not_signed_in')) {
        this.renderSignIn()
      } else {
        this.renderError(err.message || 'Could not load Connect Intel')
      }
      this.hideBadge()
    } finally {
      this.loading = false
    }
  }

  updateBadge() {
    const badge = this.els?.badge
    if (!badge) return
    const matched = Boolean(this.matchResult?.matches?.length)
    badge.hidden = !matched && !this.matchResult?.searchQuery
    badge.classList.toggle('ci-fab__badge--warn', !matched && Boolean(this.matchResult?.searchQuery))
  }

  hideBadge() {
    if (this.els?.badge) this.els.badge.hidden = true
  }

  hideCompose() {
    if (this.els?.compose) this.els.compose.hidden = true
  }

  showComposeIfEnabled() {
    const enabled = Boolean(this.boot?.capabilities?.composeEmail && this.currentLead?.leadId)
    if (this.els?.compose) this.els.compose.hidden = !enabled
    if (enabled && this.els?.subject && !this.els.subject.value && this.context?.subject) {
      this.els.subject.value = this.context.subject
    }
  }

  renderContextInvalidated() {
    if (!this.els?.status) return
    this.els.signin.hidden = true
    this.els.lead.hidden = true
    this.els.actions.hidden = true
    this.hideCompose()
    this.els.status.hidden = false
    this.els.status.className = 'ci-status'
    this.els.status.innerHTML =
      'Extension was updated. <button type="button" class="ci-link" data-action="reload-tab">Refresh this Gmail tab</button> to reconnect.'
    this.hideBadge()
    if (this.els.panel) this.els.panel.hidden = false
    this.open = true
  }

  renderLoading() {
    this.els.signin.hidden = true
    this.els.lead.hidden = true
    this.els.actions.hidden = true
    this.hideCompose()
    this.els.status.hidden = false
    this.els.status.className = 'ci-status'
    this.els.status.textContent = 'Loading…'
  }

  renderSignIn() {
    this.els.lead.hidden = true
    this.els.actions.hidden = true
    this.hideCompose()
    this.els.signin.hidden = false
    this.els.status.hidden = false
    this.els.status.className = 'ci-status'
    this.els.status.textContent = 'Sign in to link Gmail to your CRM pipeline.'
  }

  renderError(message) {
    this.els.signin.hidden = true
    this.els.lead.hidden = true
    this.els.actions.hidden = true
    this.hideCompose()
    this.els.status.hidden = false
    this.els.status.className = 'ci-status ci-status--error'
    this.els.status.textContent = message
  }

  renderMatch() {
    const boot = this.boot
    const { matches, searchQuery, matchedBy } = this.matchResult || {}
    const signedInHtml = boot?.user
      ? `Signed in as <strong>${escapeHtml(boot.user.name || boot.user.email)}</strong>`
      : ''

    this.els.signin.hidden = true

    if (!matches?.length) {
      this.currentLead = null
      this.els.lead.hidden = true
      this.els.actions.hidden = true
      this.hideCompose()
      this.els.status.hidden = false
      this.els.status.className = 'ci-status'

      const participantHint = (this.context.emails || []).slice(0, 3).join(', ')
      const parts = [
        signedInHtml,
        'No pipeline lead matched this thread.',
        participantHint ? `Participants: ${escapeHtml(participantHint)}` : '',
        searchQuery ? `Searched: ${escapeHtml(searchQuery)}` : '',
        this.context.subject ? `Subject: ${escapeHtml(this.context.subject)}` : '',
      ].filter(Boolean)

      this.els.status.innerHTML = parts.join('<br/>')
      return
    }

    const lead = matches[0]
    this.currentLead = lead
    this.els.status.hidden = false
    this.els.status.className = 'ci-status ci-status--ok'
    this.els.status.innerHTML =
      signedInHtml +
      (matchedBy === 'search'
        ? `<br/>Matched via subject/name${searchQuery ? `: ${escapeHtml(searchQuery)}` : ''}`
        : matches.length > 1
          ? `<br/>Matched ${matches.length} leads — showing top match`
          : '')

    this.els.lead.hidden = false
    this.els.lead.innerHTML = `
      <div class="ci-lead__name">${escapeHtml(lead.name)}</div>
      <div class="ci-lead__meta">${escapeHtml(lead.company || '')}${lead.company && lead.email ? ' · ' : ''}${escapeHtml(lead.email || '')}</div>
      <div class="ci-lead__meta">Status: ${escapeHtml(lead.status || '—')}</div>
    `
    this.els.actions.hidden = false
    this.showComposeIfEnabled()
  }

  async generateDraft() {
    if (!this.currentLead?.leadId) {
      this.renderError('Open a matched Gmail thread first.')
      return
    }
    const agenda = String(this.els.agenda?.value || '').trim()
    if (agenda.length < 8) {
      this.els.status.hidden = false
      this.els.status.className = 'ci-status ci-status--error'
      this.els.status.textContent = 'Describe your email goal in at least a few words before generating.'
      return
    }

    const generateBtn = this.shadow?.querySelector?.('[data-action="generate"]')
    if (generateBtn) generateBtn.disabled = true

    this.els.status.hidden = false
    this.els.status.className = 'ci-status'
    this.els.status.textContent = 'Generating AI draft… (may take 15–30s)'
    this.els.status.scrollIntoView?.({ block: 'nearest' })

    try {
      await sendMessage('CI_LOG', {
        action: 'extension.email_draft_requested',
        leadId: this.currentLead.leadId,
        metadata: { agendaLength: agenda.length },
      }).catch(() => {})

      const result = await sendMessage('CI_GENERATE_EMAIL', {
        leadId: this.currentLead.leadId,
        options: { agenda, purpose: 'follow_up', tone: 'professional' },
      })

      const draft = result?.draft || result
      if (draft?.subject && this.els.subject) this.els.subject.value = draft.subject
      if (draft?.body && this.els.body) this.els.body.value = draft.body

      await sendMessage('CI_LOG', {
        action: 'extension.email_draft_generated',
        leadId: this.currentLead.leadId,
        metadata: { aiGenerated: true },
      }).catch(() => {})

      this.els.status.className = 'ci-status ci-status--ok'
      this.els.status.textContent = 'Draft ready — review and send when ready.'
      this.els.lead.hidden = false
      this.els.actions.hidden = false
      this.showComposeIfEnabled()
    } catch (err) {
      if (runtime()?.isContextInvalidatedError?.(err.message)) {
        this.renderContextInvalidated()
        return
      }
      this.renderError(err.message || 'Could not generate draft')
      this.showComposeIfEnabled()
    } finally {
      if (generateBtn) generateBtn.disabled = false
    }
  }

  async sendEmail() {
    if (!this.currentLead?.leadId) return
    const subject = String(this.els.subject?.value || '').trim()
    const body = String(this.els.body?.value || '').trim()
    if (!subject || !body) {
      this.els.status.hidden = false
      this.els.status.className = 'ci-status ci-status--error'
      this.els.status.textContent = 'Subject and body are required to send.'
      return
    }

    this.els.status.hidden = false
    this.els.status.className = 'ci-status'
    this.els.status.textContent = 'Sending from your work Gmail…'

    try {
      await sendMessage('CI_LOG', {
        action: 'extension.email_send_requested',
        leadId: this.currentLead.leadId,
      }).catch(() => {})

      const result = await sendMessage('CI_SEND_EMAIL', {
        leadId: this.currentLead.leadId,
        payload: {
          subject,
          body,
          aiGenerated: Boolean(this.els.agenda?.value?.trim()),
        },
      })

      await sendMessage('CI_LOG', {
        action: 'extension.email_sent',
        leadId: this.currentLead.leadId,
        metadata: { provider: result?.provider, mailbox: result?.mailbox },
      }).catch(() => {})

      this.els.status.className = 'ci-status ci-status--ok'
      this.els.status.textContent = `Sent and logged${result?.mailbox ? ` from ${result.mailbox}` : ''}.`
      this.els.lead.hidden = false
      this.els.actions.hidden = false
      this.showComposeIfEnabled()
    } catch (err) {
      if (runtime()?.isContextInvalidatedError?.(err.message)) {
        this.renderContextInvalidated()
        return
      }
      const hint = err.data?.needsGmailConnect
        ? ' Connect work Gmail in Team → CRM email.'
        : err.data?.needsEmailConsent
          ? ' Lead needs email consent in CRM.'
          : ''
      this.renderError((err.message || 'Send failed') + hint)
      this.showComposeIfEnabled()
    }
  }

  async openInApp() {
    if (!this.currentLead?.pipelineUrl) return
    await sendMessage('CI_LOG', {
      action: 'extension.open_in_app',
      leadId: this.currentLead.leadId,
    }).catch(() => {})
    runtime()?.safeSendMessage({ type: 'OPEN_TAB', url: this.currentLead.pipelineUrl })
  }

  async syncTrail() {
    if (!this.currentLead?.leadId) return
    this.renderLoading()
    this.els.status.textContent = 'Syncing trail mail (server-side)…'

    try {
      await sendMessage('CI_LOG', {
        action: 'extension.trail_sync_requested',
        leadId: this.currentLead.leadId,
      })
      const result = await sendMessage('CI_SYNC_TRAIL', { leadId: this.currentLead.leadId })
      await sendMessage('CI_LOG', {
        action: 'extension.trail_sync_completed',
        leadId: this.currentLead.leadId,
        metadata: { imported: result?.importedCount },
      }).catch(() => {})
      this.els.status.className = 'ci-status ci-status--ok'
      this.els.status.textContent = `Trail sync done — ${result?.importedCount || 0} new message(s), ${result?.removedCount || 0} pruned`
      this.els.lead.hidden = false
      this.els.actions.hidden = false
      this.showComposeIfEnabled()
    } catch (err) {
      if (runtime()?.isContextInvalidatedError?.(err.message)) {
        this.renderContextInvalidated()
        return
      }
      this.renderError(err.message || 'Sync failed')
    }
  }

  signIn() {
    runtime()?.safeSendMessage({ type: 'OPEN_SIGN_IN' })
  }
}

const widget = new ConnectIntelPageWidget()

function tryMountWidget() {
  if (!document.getElementById(WIDGET_HOST_ID)) {
    widget.mount()
  }
}

globalThis.__connectIntelGmailPageWidgetTryMount = tryMountWidget

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryMountWidget)
} else {
  tryMountWidget()
}

setTimeout(tryMountWidget, 400)
setTimeout(tryMountWidget, 2000)
window.addEventListener('pageshow', tryMountWidget)
})()
