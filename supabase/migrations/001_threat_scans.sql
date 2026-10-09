create table if not exists public.threat_scans (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (length(domain) between 1 and 253 and domain ~ '^[a-zA-Z0-9.-]+$'),
  risk_score integer not null check (risk_score between 0 and 100),
  risk_level text not null check (risk_level in ('safe', 'suspicious', 'danger')),
  created_at timestamptz not null default now()
);

create index if not exists threat_scans_created_at_idx
  on public.threat_scans (created_at desc);
create index if not exists threat_scans_domain_idx
  on public.threat_scans (domain);

alter table public.threat_scans enable row level security;

drop policy if exists "Read public threat indicators" on public.threat_scans;
create policy "Read public threat indicators"
  on public.threat_scans for select
  to anon, authenticated
  using (true);

drop policy if exists "Submit limited threat indicators" on public.threat_scans;
create policy "Submit limited threat indicators"
  on public.threat_scans for insert
  to anon, authenticated
  with check (
    length(domain) between 1 and 253
    and domain ~ '^[a-zA-Z0-9.-]+$'
    and risk_score between 0 and 100
    and risk_level in ('safe', 'suspicious', 'danger')
  );

grant select, insert on public.threat_scans to anon, authenticated;
