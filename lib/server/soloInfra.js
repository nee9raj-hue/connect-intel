/**
 * Solo / single-user deployment — minimize paid infra (Vercel invocations, Redis, Meili, etc.).
 * Keep in sync with CRM_SOLO_FREE_TIER unless SOLO_FREE_INFRA is set explicitly on Vercel.
 */

import { CRM_SOLO_FREE_TIER } from './crmProductFlags.js'

function envFlag(name) {
  const v = String(process.env[name] || '')
    .trim()
    .toLowerCase()
  if (v === 'false' || v === '0' || v === 'no') return false
  if (v === 'true' || v === '1' || v === 'yes') return true
  return null
}

/** When true: skip marketing/reminder crons, no Redis/Meili required for core CRM. */
export function isSoloFreeInfra() {
  const explicit = envFlag('SOLO_FREE_INFRA')
  if (explicit === false) return false
  if (explicit === true) return true
  return CRM_SOLO_FREE_TIER
}

/** Optional paid APIs (Apollo, etc.) — off by default; solo mode never enables them. */
export function allowPaidExternalApis() {
  if (isSoloFreeInfra()) return false
  return String(process.env.ENABLE_PAID_APIS || '').trim().toLowerCase() === 'true'
}

export function soloInfraStatus() {
  return {
    soloFreeInfra: isSoloFreeInfra(),
    paidApisAllowed: allowPaidExternalApis(),
    hint: isSoloFreeInfra()
      ? 'Vercel Hobby + Supabase Free only — no Redis, Meilisearch, or Railway workers needed for core CRM.'
      : null,
  }
}
