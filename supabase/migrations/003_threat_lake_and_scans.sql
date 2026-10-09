-- Migration 003: Threat Lake and Scans persistence tables
create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  input_vector text not null default 'text',
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  risk_level text not null default 'safe',
  verdict text not null default '',
  threat_type text not null default 'Unknown',
  summary text not null default '',
  impersonated_brand text,
  red_flags text[] not null default '{}',
  flags jsonb not null default '[]'::jsonb,
  inline_highlights jsonb not null default '[]'::jsonb,
  telemetry jsonb not null default '{}'::jsonb,
  analyzed_text text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists scans_user_created_idx
  on public.scans (user_id, created_at desc);

create table if not exists public.threat_lake (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  url text,
  incident_count integer not null default 1,
  highest_risk_score integer not null default 0,
  latest_risk_score integer not null default 0,
  threat_types text[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists threat_lake_domain_idx
  on public.threat_lake (domain);

create index if not exists threat_lake_incident_count_idx
  on public.threat_lake (incident_count desc);

alter table public.scans enable row level security;
alter table public.threat_lake enable row level security;

create policy "Public and users can read threat lake"
  on public.threat_lake for select to anon, authenticated
  using (true);

create policy "Service can insert or update threat lake"
  on public.threat_lake for all to anon, authenticated
  using (true)
  with check (true);

create policy "Users can read own scans"
  on public.scans for select to authenticated
  using (auth.uid() = user_id or user_id is null);

create policy "Users can insert scans"
  on public.scans for insert to anon, authenticated
  with check (true);

grant select, insert on public.scans to anon, authenticated;
grant select, insert, update on public.threat_lake to anon, authenticated;
