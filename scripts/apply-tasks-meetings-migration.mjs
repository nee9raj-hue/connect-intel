#!/usr/bin/env node
/**
 * Apply pipeline_tasks / pipeline_meetings bootstrap SQL.
 * Uses DATABASE_URL, SUPABASE_DB_PASSWORD, or SUPABASE_ACCESS_TOKEN.
 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const applyUrl = pathToFileURL(join(ROOT, 'lib/server/supabaseSqlApply.js')).href

const { applySupabaseSqlFile } = await import(applyUrl)

const result = await applySupabaseSqlFile(
  'supabase/migrations/20260702130000_pipeline_tasks_meetings_bootstrap.sql'
)
console.log(JSON.stringify(result, null, 2))
process.exit(result.applied ? 0 : 1)
