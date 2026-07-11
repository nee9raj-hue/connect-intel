import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  getCrmEmailStrategy,
  getGmailOnboardingPublicConfig,
  isGmailOnboardingPromptEnabled,
} from './config.js'

const ENV_KEYS = [
  'GMAIL_ONBOARDING_PROMPT_ENABLED',
  'GOOGLE_OAUTH_VERIFIED',
  'GOOGLE_OAUTH_ALLOW_CONNECT',
  'GOOGLE_CLIENT_ID',
  'VITE_GOOGLE_CLIENT_ID',
]

function snapshotEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
}

function restoreEnv(snapshot) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key]
    else process.env[key] = snapshot[key]
  }
}

describe('gmail onboarding public config', () => {
  let envSnapshot

  beforeEach(() => {
    envSnapshot = snapshotEnv()
  })

  afterEach(() => {
    restoreEnv(envSnapshot)
  })

  it('is off by default without env flag', () => {
    delete process.env.GMAIL_ONBOARDING_PROMPT_ENABLED
    process.env.GOOGLE_CLIENT_ID = 'test-client'
    process.env.GOOGLE_OAUTH_VERIFIED = 'true'
    assert.equal(isGmailOnboardingPromptEnabled(), false)
    assert.equal(getGmailOnboardingPublicConfig().promptEnabled, false)
  })

  it('enables prompt only when connect is offered', () => {
    process.env.GMAIL_ONBOARDING_PROMPT_ENABLED = 'true'
    process.env.GOOGLE_CLIENT_ID = 'test-client'
    process.env.GOOGLE_OAUTH_ALLOW_CONNECT = 'true'
    const config = getGmailOnboardingPublicConfig()
    assert.equal(config.promptEnabled, true)
    assert.equal(config.connectAvailable, true)
    assert.equal(config.phase, 'testing')
  })

  it('stays off when OAuth connect is not offered', () => {
    process.env.GMAIL_ONBOARDING_PROMPT_ENABLED = 'true'
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.VITE_GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_OAUTH_VERIFIED
    delete process.env.GOOGLE_OAUTH_ALLOW_CONNECT
    const config = getGmailOnboardingPublicConfig()
    assert.equal(config.promptEnabled, false)
    assert.equal(config.connectAvailable, false)
    assert.equal(config.phase, 'pending_verification')
  })
})

describe('crm email strategy', () => {
  let envSnapshot

  beforeEach(() => {
    envSnapshot = snapshotEnv()
  })

  afterEach(() => {
    restoreEnv(envSnapshot)
  })

  it('defaults to extension_first when web Gmail connect is off', () => {
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_OAUTH_VERIFIED
    delete process.env.GOOGLE_OAUTH_ALLOW_CONNECT
    const strategy = getCrmEmailStrategy()
    assert.equal(strategy.mode, 'extension_first')
    assert.equal(strategy.webGmailConnectAvailable, false)
    assert.equal(strategy.casaDeferred, true)
  })
})
