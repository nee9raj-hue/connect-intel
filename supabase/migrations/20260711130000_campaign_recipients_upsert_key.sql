-- PostgREST upsert on campaign_recipients requires a UNIQUE constraint (partial index is not enough).

ALTER TABLE public.campaign_recipients
  DROP CONSTRAINT IF EXISTS campaign_recipients_campaign_enrollment_key;

ALTER TABLE public.campaign_recipients
  ADD CONSTRAINT campaign_recipients_campaign_enrollment_key
  UNIQUE (campaign_id, enrollment_ref);
