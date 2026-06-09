-- Marketing audiences (relational mirror for analytics / future sync).
-- Runtime source of truth remains JSON store snapshots until full migration.

create table if not exists public.marketing_audiences (
  id text primary key,
  organization_id text not null,
  name text not null,
  description text,
  audience_type text not null default 'static' check (audience_type in ('static', 'dynamic', 'saved_filter')),
  channel text not null default 'email' check (channel in ('email', 'whatsapp')),
  contact_count integer not null default 0,
  growth_pct integer not null default 0,
  source_list_id text,
  source_segment_id text,
  created_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_refreshed timestamptz
);

create index if not exists marketing_audiences_org_idx on public.marketing_audiences (organization_id);

create table if not exists public.marketing_audience_contacts (
  audience_id text not null references public.marketing_audiences (id) on delete cascade,
  lead_id text not null,
  added_at timestamptz not null default now(),
  primary key (audience_id, lead_id)
);

create index if not exists marketing_audience_contacts_lead_idx on public.marketing_audience_contacts (lead_id);

create table if not exists public.marketing_audience_snapshots (
  id bigserial primary key,
  audience_id text not null references public.marketing_audiences (id) on delete cascade,
  lead_ids jsonb not null default '[]'::jsonb,
  contact_count integer not null default 0,
  deliverable_count integer not null default 0,
  engaged_count integer,
  created_at timestamptz not null default now(),
  last_refreshed timestamptz not null default now()
);

create index if not exists marketing_audience_snapshots_audience_idx
  on public.marketing_audience_snapshots (audience_id, last_refreshed desc);
