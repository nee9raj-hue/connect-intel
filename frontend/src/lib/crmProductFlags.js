/** Product toggles for CRM shell (not per-org workspace features). */

/** Team chat (Chithi) — off until re-enabled for specific orgs. */
export const CHITHI_IN_CRM_ENABLED = false

/** AI prospect search + saved-leads DB — shipped as a separate product later. */
export const AI_PROSPECTING_IN_CRM_ENABLED = false

/** Credit wallet / coin UI in the CRM header and billing — not used in core CRM go-live. */
export const CREDITS_IN_CRM_UI_ENABLED = false

/** Post-onboarding Gmail connect modal — off until Google sensitive-scope verification is approved. */
export const GMAIL_ONBOARDING_PROMPT_ENABLED = false

/** Paid plans, Stripe, invoices, and subscription chip — CRM go-live is included/free. */
export const BILLING_IN_CRM_UI_ENABLED = false

/** Solo/small-team CRM — no paid tier, credits, or subscription flags exposed to users. */
export const CRM_SOLO_FREE_TIER = true
