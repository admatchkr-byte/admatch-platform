create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_type text not null default 'creator',
  name text not null,
  email text,
  contact text,
  region text,
  category text,
  channel text,
  followers integer default 0,
  avg_views integer default 0,
  price integer default 0,
  intro text,
  portfolio_url text,
  created_at timestamp with time zone default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null,
  manager_name text,
  contact text not null,
  region text,
  category text,
  budget integer default 0,
  brief text,
  status text default 'new',
  created_at timestamp with time zone default now()
);

alter table profiles enable row level security;
alter table campaigns enable row level security;

drop policy if exists "profiles_select_all" on profiles;
drop policy if exists "profiles_insert_all" on profiles;
drop policy if exists "campaigns_select_all" on campaigns;
drop policy if exists "campaigns_insert_all" on campaigns;

create policy "profiles_select_all" on profiles for select using (true);
create policy "profiles_insert_all" on profiles for insert with check (true);
create policy "campaigns_select_all" on campaigns for select using (true);
create policy "campaigns_insert_all" on campaigns for insert with check (true);
