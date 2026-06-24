-- Connect Intel — repair cross-tenant pipeline_leads assignees
-- Run in Supabase SQL Editor (production). Safe to re-run.

-- Preview (optional — shows what will be fixed)
WITH org_member_users AS (
  SELECT o.legacy_id AS legacy_org_id, p.legacy_user_id AS user_id, p.email, p.full_name
  FROM public.profiles p
  INNER JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.legacy_user_id IS NOT NULL AND o.legacy_id IS NOT NULL
),
foreign_rows AS (
  SELECT pl.organization_id, pl.owner_id, pl.lead_id
  FROM public.pipeline_leads pl
  WHERE pl.organization_id IS NOT NULL
    AND pl.owner_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM org_member_users om
      WHERE om.legacy_org_id = pl.organization_id AND om.user_id = pl.owner_id
    )
)
SELECT organization_id, owner_id, count(*)::int AS lead_count
FROM foreign_rows
GROUP BY 1, 2
ORDER BY 3 DESC;

-- Repair
WITH org_member_users AS (
  SELECT o.legacy_id AS legacy_org_id, p.legacy_user_id AS user_id
  FROM public.profiles p
  INNER JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.legacy_user_id IS NOT NULL AND o.legacy_id IS NOT NULL
)
UPDATE public.pipeline_leads pl
SET
  entry = (
    CASE
      WHEN btrim(COALESCE(pl.entry->>'assignedToUserId', '')) = pl.owner_id THEN
        pl.entry || jsonb_build_object(
          'assignedToUserId', NULL,
          'assignedAt', NULL,
          'assignedByUserId', NULL,
          'pipelineUpdatedAt', to_jsonb(timezone('utc', now())::text)
        )
      WHEN btrim(COALESCE(pl.entry->>'savedByUserId', '')) = pl.owner_id THEN
        (pl.entry - 'savedByUserId')
          || jsonb_build_object('pipelineUpdatedAt', to_jsonb(timezone('utc', now())::text))
      WHEN btrim(COALESCE(pl.entry->>'userId', '')) = pl.owner_id THEN
        (pl.entry - 'userId')
          || jsonb_build_object('pipelineUpdatedAt', to_jsonb(timezone('utc', now())::text))
      ELSE pl.entry
    END
  ),
  updated_at = timezone('utc', now())
WHERE pl.organization_id IS NOT NULL
  AND pl.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM org_member_users m
    WHERE m.legacy_org_id = pl.organization_id AND m.user_id = pl.owner_id
  );
