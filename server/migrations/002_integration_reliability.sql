alter table public.room_saves add column if not exists private_data jsonb not null default '{}'::jsonb;
alter table public.room_saves add column if not exists revision bigint not null default 0;
alter table public.room_backups add column if not exists private_data jsonb not null default '{}'::jsonb;
alter table public.room_backups add column if not exists revision bigint not null default 0;
create index if not exists room_saves_revision_idx on public.room_saves(save_code, revision desc);
