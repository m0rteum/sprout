-- Sprout: shared plant-care household.
-- Run in the Supabase SQL editor, or `supabase db push` with the Supabase CLI.

create extension if not exists pgcrypto;

-- Households ---------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from household_members where household_id = hid and user_id = auth.uid()
  );
$$;

create or replace function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into households (name) values (p_name) returning id into hid;
  insert into household_members (household_id, user_id, display_name)
    values (hid, auth.uid(), p_display_name);
  return hid;
end;
$$;

create or replace function public.join_household(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select id into hid from households where invite_code = upper(trim(p_code));
  if hid is null then
    raise exception 'invite code not found';
  end if;
  insert into household_members (household_id, user_id, display_name)
    values (hid, auth.uid(), p_display_name)
    on conflict (household_id, user_id) do update set display_name = excluded.display_name;
  return hid;
end;
$$;

-- Garden -------------------------------------------------------------------

create table public.sites (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  light text not null check (light in ('low', 'medium', 'bright', 'direct')),
  indoor boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.plants (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  site_id uuid references public.sites (id) on delete set null,
  nickname text not null,
  species_id text,
  species_name text not null default '',
  photo text,
  pot_diameter_cm numeric,
  has_drainage boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.care_schedules (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  plant_id uuid not null references public.plants (id) on delete cascade,
  task text not null check (task in ('water', 'fertilize', 'mist', 'rotate', 'clean', 'repot')),
  interval_days integer not null check (interval_days > 0),
  last_done_at timestamptz,
  next_due_at timestamptz not null,
  enabled boolean not null default true,
  unique (plant_id, task)
);

create table public.care_logs (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  plant_id uuid not null references public.plants (id) on delete cascade,
  task text not null,
  action text not null check (action in ('done', 'postponed', 'skipped')),
  at timestamptz not null default now(),
  "by" text,
  note text not null default ''
);

create table public.journal_entries (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  plant_id uuid not null references public.plants (id) on delete cascade,
  photo text,
  note text not null default '',
  at timestamptz not null default now()
);

create index on public.plants (household_id);
create index on public.care_schedules (household_id, next_due_at);
create index on public.care_logs (plant_id, at desc);
create index on public.journal_entries (plant_id, at desc);

-- Hardware (for automated watering later; see docs/HARDWARE.md) ------------

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  plant_id uuid references public.plants (id) on delete set null,
  name text not null,
  kind text not null default 'esp32-moisture-pump',
  -- sha256 of the device's secret token; the token itself is never stored.
  token_hash text not null,
  -- Water automatically when moisture drops below this percentage.
  moisture_threshold_pct numeric check (moisture_threshold_pct between 0 and 100),
  pump_ms integer not null default 4000 check (pump_ms between 500 and 60000),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.sensor_readings (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  moisture_pct numeric,
  temperature_c numeric,
  recorded_at timestamptz not null default now()
);

create table public.watering_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  plant_id uuid references public.plants (id) on delete set null,
  trigger text not null check (trigger in ('manual', 'schedule', 'sensor')),
  pump_ms integer not null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create index on public.sensor_readings (device_id, recorded_at desc);

-- Row-level security: members see and change only their household ---------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.sites enable row level security;
alter table public.plants enable row level security;
alter table public.care_schedules enable row level security;
alter table public.care_logs enable row level security;
alter table public.journal_entries enable row level security;
alter table public.devices enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.watering_events enable row level security;

create policy "members read household" on public.households
  for select using (public.is_household_member(id));
create policy "members rename household" on public.households
  for update using (public.is_household_member(id));

create policy "members see each other" on public.household_members
  for select using (public.is_household_member(household_id));
create policy "edit own membership" on public.household_members
  for update using (user_id = auth.uid());
create policy "leave household" on public.household_members
  for delete using (user_id = auth.uid());

do $$
declare
  t text;
begin
  foreach t in array array[
    'sites', 'plants', 'care_schedules', 'care_logs', 'journal_entries',
    'devices', 'sensor_readings', 'watering_events'
  ] loop
    execute format(
      'create policy "household members" on public.%I for all
         using (public.is_household_member(household_id))
         with check (public.is_household_member(household_id))',
      t
    );
  end loop;
end;
$$;

-- Photos: private bucket, files stored under <household_id>/ ---------------

insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', false)
on conflict (id) do nothing;

create policy "household photos read" on storage.objects
  for select using (
    bucket_id = 'plant-photos'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );
create policy "household photos write" on storage.objects
  for insert with check (
    bucket_id = 'plant-photos'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );
create policy "household photos delete" on storage.objects
  for delete using (
    bucket_id = 'plant-photos'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

-- Live sync between phones ---------------------------------------------------

alter publication supabase_realtime
  add table public.sites, public.plants, public.care_schedules, public.care_logs,
    public.journal_entries;
