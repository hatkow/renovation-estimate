create extension if not exists pgcrypto;

create table if not exists public.estimate_submissions (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  plan text not null,
  grade text not null,
  area integer not null default 1,
  options jsonb not null default '[]'::jsonb,
  prefecture text not null default '',
  city text not null default '',
  timing text not null default 'undecided',
  notes text not null default '',
  customer_name text not null,
  email text not null,
  phone text not null,
  image_names jsonb not null default '[]'::jsonb,
  uploaded_images jsonb not null default '[]'::jsonb,
  selected_products jsonb not null default '[]'::jsonb,
  lead_source text not null default 'direct',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  landing_page text not null default '',
  referrer_host text not null default '',
  lost_reason text not null default '',
  estimated_low bigint not null default 0,
  estimated_high bigint not null default 0,
  submitted_at timestamptz not null default timezone('utc', now()),
  status text not null default 'pending'
);

alter table public.estimate_submissions
add column if not exists selected_products jsonb not null default '[]'::jsonb;

alter table public.estimate_submissions
add column if not exists lead_source text not null default 'direct';

alter table public.estimate_submissions
add column if not exists utm_source text not null default '';

alter table public.estimate_submissions
add column if not exists utm_medium text not null default '';

alter table public.estimate_submissions
add column if not exists utm_campaign text not null default '';

alter table public.estimate_submissions
add column if not exists landing_page text not null default '';

alter table public.estimate_submissions
add column if not exists referrer_host text not null default '';

alter table public.estimate_submissions
add column if not exists lost_reason text not null default '';

create table if not exists public.simulator_configs (
  config_key text primary key,
  config_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.estimate_submissions enable row level security;
alter table public.simulator_configs enable row level security;

create policy "anon can read estimate submissions"
on public.estimate_submissions
for select
to anon
using (true);

create policy "anon can insert estimate submissions"
on public.estimate_submissions
for insert
to anon
with check (true);

create policy "anon can read simulator configs"
on public.simulator_configs
for select
to anon
using (true);

create policy "anon can insert simulator configs"
on public.simulator_configs
for insert
to anon
with check (true);

create policy "anon can update simulator configs"
on public.simulator_configs
for update
to anon
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('estimate-images', 'estimate-images', true)
on conflict (id) do nothing;

create policy "anon can upload estimate images"
on storage.objects
for insert
to anon
with check (bucket_id = 'estimate-images');

create policy "public can read estimate images"
on storage.objects
for select
to public
using (bucket_id = 'estimate-images');
