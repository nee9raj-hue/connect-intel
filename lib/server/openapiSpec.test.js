import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildOpenApiSpec } from './openapiSpec.js'
import { listApiRouteKeys } from './apiRouteRegistry.js'

describe('buildOpenApiSpec', () => {
  it('includes all registered routes', () => {
    const spec = buildOpenApiSpec({ baseUrl: 'https://example.test' })
    const keys = listApiRouteKeys()
    assert.equal(spec['x-route-count'], keys.length)
    assert.ok(spec.paths['/api/health'])
    assert.ok(spec.paths['/api/openapi'])
    assert.ok(spec.paths['/api/workflow/catalog'])
    assert.ok(spec.paths['/api/org/audit-log'])
  })
})
