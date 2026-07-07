#!/usr/bin/env node
/**
 * Apply email_sends audit table migration (P1 constitution).
 */

import { applySupabaseSqlFile } from '../lib/server/supabaseSqlApply.js'

const result = await applySupabaseSqlFile('supabase/migrations/20260707120000_email_sends.sql')
console.log(JSON.stringify(result, null, 2))
process.exit(result.applied ? 0 : 1)
