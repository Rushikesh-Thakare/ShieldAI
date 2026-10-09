create table if not exists public.scan_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_type text not null check (input_type in ('url_or_message', 'message', 'image', 'text_and_image')),
  risk_score integer not null check (risk_score between 0 and 100),
  risk_level text not null check (risk_level in ('safe', 'suspicious', 'danger')),
  verdict text not null,
  summary text not null,
  domains text[] not null default '{}',
  flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists scan_history_user_created_idx
  on public.scan_history (user_id, created_at desc);
alter table public.scan_history enable row level security;
drop policy if exists "Users read their own scan history" on public.scan_history;
create policy "Users read their own scan history"
  on public.scan_history for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Users add their own scan history" on public.scan_history;
create policy "Users add their own scan history"
  on public.scan_history for insert to authenticated
  with check (auth.uid() = user_id);
grant select, insert on public.scan_history to authenticated;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
drop policy if exists "Users read their own preferences" on public.user_preferences;
create policy "Users read their own preferences"
  on public.user_preferences for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Users manage their own preferences" on public.user_preferences;
create policy "Users manage their own preferences"
  on public.user_preferences for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant select, insert, update on public.user_preferences to authenticated;

create or replace view public.threat_trends as
select
  domain,
  count(*)::integer as incidents,
  max(risk_score)::integer as risk_score,
  max(created_at) as last_seen
from public.threat_scans
where risk_score >= 40
group by domain
order by incidents desc, risk_score desc;

grant select on public.threat_trends to anon, authenticated;
