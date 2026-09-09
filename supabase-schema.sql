-- Run this in Supabase SQL editor

create extension if not exists pgcrypto;

create table if not exists public.pac_cases (
  id uuid primary key default gen_random_uuid(),
  name text,
  age text,
  sex text,
  diagnosis text,
  procedure text,
  comorbidities text,
  medications text,
  airway text,
  investigations text,
  asa text,
  status text default 'Pending',
  resident text,
  plan text,
  advice text,
  consultant text,
  advice_time timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ot_cases (
  id uuid primary key default gen_random_uuid(),
  ot text,
  resident text,
  patient text,
  age text,
  weight text,
  asa text,
  procedure text,
  anaesthesia text,
  airway text,
  monitoring jsonb default '[]'::jsonb,
  latest_monitor jsonb default '{}'::jsonb,
  events jsonb default '[]'::jsonb,
  completed boolean default false,
  completed_at timestamptz,
  date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists pac_cases_updated_at_idx on public.pac_cases (updated_at desc);
create index if not exists ot_cases_date_idx on public.ot_cases (date desc);
create index if not exists ot_cases_completed_idx on public.ot_cases (completed);

alter table public.pac_cases disable row level security;
alter table public.ot_cases disable row level security;

grant all on table public.pac_cases to anon, authenticated;
grant all on table public.ot_cases to anon, authenticated;

grant usage on schema public to anon, authenticated;
