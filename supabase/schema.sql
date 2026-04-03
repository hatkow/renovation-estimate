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
  estimated_low bigint not null default 0,
  estimated_high bigint not null default 0,
  submitted_at timestamptz not null default timezone('utc', now()),
  status text not null default 'pending'
);

alter table public.estimate_submissions enable row level security;

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
