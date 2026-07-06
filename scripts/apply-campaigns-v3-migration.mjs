#!/usr/bin/env node
/**
 * Apply campaigns_v3 bootstrap SQL (Deploy 12).
 * Uses DATABASE_URL, SUPABASE_DB_PASSWORD, or SUPABASE_ACCESS_TOKEN.
 */

import { applyCampaignsV3Bootstrap } from '../lib/server/supabaseSqlApply.js'

const result = await applyCampaignsV3Bootstrap()
console.log(JSON.stringify(result, null, 2))
process.exit(result.applied ? 0 : 1)
