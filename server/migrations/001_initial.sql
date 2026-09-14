create table if not exists public.room_saves (
  save_code text primary key,
  room_name text not null,
  state_data jsonb not null,
  private_data jsonb not null default '{}'::jsonb,
  pin_hash text not null default '',
  game_status text not null default 'active',
  format_version integer not null default 2,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.room_backups (
  id bigserial primary key,
  save_code text not null,
  state_data jsonb not null,
  private_data jsonb not null default '{}'::jsonb,
  pin_hash text not null default '',
  format_version integer not null default 2,
  revision bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists room_backups_save_code_created_at_idx on public.room_backups(save_code, created_at desc);
