-- Connect Intel — run in Supabase SQL Editor (Project → SQL → New query)

create table if not exists store_collections (
  collection text primary key,
  json jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table store_collections enable row level security;

-- Server uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS). No public policies required for MVP.

create index if not exists store_collections_updated_at_idx on store_collections (updated_at desc);
