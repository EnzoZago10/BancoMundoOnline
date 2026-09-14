create table if not exists public.active_room_leases (
  save_code text primary key,
  instance_id text not null,
  lease_until timestamptz not null,
  updated_at timestamptz not null default now()
);
create index if not exists active_room_leases_lease_until_idx on public.active_room_leases(lease_until);

create table if not exists public.auth_rate_limits (
  rate_key text primary key,
  window_start timestamptz not null,
  attempt_count integer not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists auth_rate_limits_updated_at_idx on public.auth_rate_limits(updated_at);
