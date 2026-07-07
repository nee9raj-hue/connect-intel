#!/usr/bin/env node
/**
 * Apply pipeline_companies parent_company_id migration (P1 constitution).
 */

import { applySupabaseSqlFile } from '../lib/server/supabaseSqlApply.js'

const result = await applySupabaseSqlFile('supabase/migrations/20260707140000_pipeline_companies_hierarchy.sql')
console.log(JSON.stringify(result, null, 2))
process.exit(result.applied ? 0 : 1)
