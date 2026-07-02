#!/usr/bin/env node
/**
 * Apply pipeline_tasks / pipeline_meetings bootstrap SQL.
 * Uses DATABASE_URL, SUPABASE_DB_PASSWORD, or SUPABASE_ACCESS_TOKEN.
 */

import { applyPipelineTasksMeetingsBootstrap } from '../lib/server/supabaseSqlApply.js'

const result = await applyPipelineTasksMeetingsBootstrap()
console.log(JSON.stringify(result, null, 2))
process.exit(result.applied ? 0 : 1)
