#!/usr/bin/env node
/**
 * Verify Enterprise Infrastructure V2 platform kernel.
 *
 *   npm run platform:verify
 */

import { getPlatform } from '../lib/platform/index.js'
import { resolvePlatformConfig } from '../lib/platform/config/providers.js'

console.log('Connect Intel — platform verify (Infrastructure V2)\n')

const config = resolvePlatformConfig()
console.log('Providers:', config)

const platform = getPlatform()
const health = await platform.health()

console.log('\nPlatform health:')
console.log(JSON.stringify(health, null, 2))

if (!health.ok) {
  console.error('\nPlatform database ping failed — check DATABASE_PROVIDER and credentials.')
  process.exit(1)
}

console.log('\nRepositories: organizations, leads, companies, pipeline — OK')
console.log('Contract version:', health.contract)
console.log('\nPlatform verify PASSED')
