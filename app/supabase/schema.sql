create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('owner', 'finance', 'operator', 'staff', 'external')),
  status text not null default 'active',
  phone text,
  team text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.talents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text,
  account text,
  category text,
  fans integer not null default 0,
  fee numeric not null default 0,
  commission_rate numeric not null default 0,
  total_gmv numeric not null default 0,
  status text not null default 'active',
  contact text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  owner_name text,
  phone text,
  settlement text,
  status text not null default 'active',
  introduction text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id),
  name text not null,
  role_name text,
  team text,
  shift text,
  commission_rate numeric not null default 0,
  status text not null default 'active',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  session_date date not null,
  start_time time,
  end_time time,
  talent_id uuid references public.talents(id),
  merchant_id uuid references public.merchants(id),
  employee_id uuid references public.employees(id),
  room text,
  status text not null default 'scheduled',
  target_gmv numeric not null default 0,
  cooperation_mode text,
  travel_note text,
  brand_travel_receivable numeric not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.live_sessions(id) on delete cascade,
  viewers integer not null default 0,
  orders integer not null default 0,
  gmv numeric not null default 0,
  refund numeric not null default 0,
  ad_cost numeric not null default 0,
  remark text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_records (
  id uuid primary key default gen_random_uuid(),
  record_date date not null,
  type text not null check (type in ('收入', '支出')),
  source text not null,
  amount numeric not null default 0,
  currency text not null default 'CNY',
  status text,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.travel_costs (
  id uuid primary key default gen_random_uuid(),
  talent_id uuid references public.talents(id),
  date_start date not null,
  date_end date not null,
  flight_type text,
  flight_cost numeric not null default 0,
  hotel_cost numeric not null default 0,
  business_car_cost numeric not null default 0,
  taxi_cost numeric not null default 0,
  meal_cost numeric not null default 0,
  currency text not null default 'SGD',
  exchange_rate numeric not null default 5.35,
  session_count integer not null default 0,
  tap_session_count integer not null default 0,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.current_profile_role()
returns text
language sql
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_owner_or_finance()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_profile_role() in ('owner', 'finance'), false)
$$;

alter table public.profiles enable row level security;
alter table public.talents enable row level security;
alter table public.merchants enable row level security;
alter table public.employees enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_records enable row level security;
alter table public.finance_records enable row level security;
alter table public.travel_costs enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_self_or_admin" on public.profiles
  for select using (id = auth.uid() or public.current_profile_role() = 'owner');

create policy "profiles_update_self_or_admin" on public.profiles
  for update using (id = auth.uid() or public.current_profile_role() = 'owner');

create policy "business_select_authenticated" on public.talents
  for select using (auth.uid() is not null);
create policy "business_write_owner_operator" on public.talents
  for all using (public.current_profile_role() in ('owner', 'operator')) with check (public.current_profile_role() in ('owner', 'operator'));

create policy "merchants_select_authenticated" on public.merchants
  for select using (auth.uid() is not null);
create policy "merchants_write_owner_operator" on public.merchants
  for all using (public.current_profile_role() in ('owner', 'operator')) with check (public.current_profile_role() in ('owner', 'operator'));

create policy "employees_select_internal" on public.employees
  for select using (public.current_profile_role() in ('owner', 'finance', 'operator'));
create policy "employees_write_owner" on public.employees
  for all using (public.current_profile_role() = 'owner') with check (public.current_profile_role() = 'owner');

create policy "sessions_select_authenticated" on public.live_sessions
  for select using (auth.uid() is not null);
create policy "sessions_write_owner_operator" on public.live_sessions
  for all using (public.current_profile_role() in ('owner', 'operator')) with check (public.current_profile_role() in ('owner', 'operator'));

create policy "records_select_internal" on public.live_records
  for select using (public.current_profile_role() in ('owner', 'finance', 'operator', 'staff'));
create policy "records_write_internal" on public.live_records
  for all using (public.current_profile_role() in ('owner', 'finance', 'operator')) with check (public.current_profile_role() in ('owner', 'finance', 'operator'));

create policy "finance_select_finance" on public.finance_records
  for select using (public.is_owner_or_finance());
create policy "finance_write_finance" on public.finance_records
  for all using (public.is_owner_or_finance()) with check (public.is_owner_or_finance());

create policy "travel_select_finance" on public.travel_costs
  for select using (public.is_owner_or_finance());
create policy "travel_write_finance" on public.travel_costs
  for all using (public.is_owner_or_finance()) with check (public.is_owner_or_finance());

create policy "audit_select_owner" on public.audit_logs
  for select using (public.current_profile_role() = 'owner');
create policy "audit_insert_authenticated" on public.audit_logs
  for insert with check (auth.uid() is not null);
