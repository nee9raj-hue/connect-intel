import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAuthProvider } from '../../config/providers.js'
import {
  getEnterpriseAuthConfig,
  isEnterpriseAuthConfigured,
} from './enterpriseConfig.js'
import { createAuthAdapter } from './index.js'

describe('enterprise auth config', () => {
  const saved = {}

  function saveEnv() {
    for (const key of ['AZURE_AD_CLIENT_ID', 'AZURE_AD_CLIENT_SECRET', 'AUTH_PROVIDER']) {
      saved[key] = process.env[key]
    }
  }

  function restoreEnv() {
    for (const key of ['AZURE_AD_CLIENT_ID', 'AZURE_AD_CLIENT_SECRET', 'AUTH_PROVIDER']) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }

  it('azure-ad is not configured without env', () => {
    saveEnv()
    delete process.env.AZURE_AD_CLIENT_ID
    delete process.env.AZURE_AD_CLIENT_SECRET
    assert.equal(isEnterpriseAuthConfigured('azure-ad'), false)
    const config = getEnterpriseAuthConfig('azure-ad')
    assert.equal(config.kind, 'oidc')
    restoreEnv()
  })

  it('resolveAuthProvider accepts azure-ad', () => {
    saveEnv()
    process.env.AUTH_PROVIDER = 'azure-ad'
    assert.equal(resolveAuthProvider(), 'azure-ad')
    restoreEnv()
  })
})

describe('auth adapter port', () => {
  it('exposes session and public auth config', () => {
    const auth = createAuthAdapter('session-jwt')
    assert.equal(auth.provider, 'session-jwt')
    assert.equal(typeof auth.resolveSessionUser, 'function')
    assert.equal(typeof auth.getPublicAuthConfig, 'function')
    const pub = auth.getPublicAuthConfig()
    assert.equal(pub.primary, 'session-jwt')
    assert.ok(Array.isArray(pub.enterprise))
    assert.equal(pub.ssoStartPath, '/api/auth/sso/start')
  })
})
