-- Production schema for the migrated ShopFluence system.
-- Run this in Supabase SQL Editor before importing data.
-- It intentionally uses integer IDs so the existing frontend and API behavior stay unchanged.

begin;

drop table if exists public.audit_logs cascade;
drop table if exists public.travel_costs cascade;
drop table if exists public.finance_records cascade;
drop table if exists public.live_records cascade;
drop table if exists public.profiles cascade;
drop table if exists public.income cascade;
drop table if exists public.costs cascade;
drop table if exists public.expenses cascade;
drop table if exists public.orders cascade;
drop table if exists public.live_sessions cascade;
drop table if exists public.products cascade;
drop table if exists public.merchants cascade;
drop table if exists public.influencers cascade;

create table public.influencers (
  id serial primary key,
  platform text not null,
  name text not null,
  account text not null,
  agency text,
  single_session_data text,
  product_direction text,
  commission_rate double precision not null default 0,
  contact text,
  sample_address text,
  notes text,
  status text default 'active',
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp
);

create table public.merchants (
  id serial primary key,
  name text not null,
  category text,
  contact_person text,
  email text,
  phone text,
  platform text not null,
  commission_rate double precision default 0,
  settlement_cycle text default 'monthly',
  status text default 'active',
  notes text,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp,
  cargo_sheet_url text,
  cooperation_mode text,
  brand_intro text,
  brand_assistants text,
  brand_live_venue text,
  brand_cards text,
  other_files text,
  supply_price_sheet_url text,
  cooperation_notes text,
  brand_address text,
  company_name text
);

create table public.products (
  id serial primary key,
  merchant_id integer references public.merchants(id),
  sku text unique,
  name text not null,
  category text,
  cost_price double precision not null,
  selling_price double precision not null,
  platform text not null
);

create table public.live_sessions (
  id serial primary key,
  influencer_id integer references public.influencers(id),
  merchant_id integer references public.merchants(id),
  platform text not null,
  session_date timestamptz not null,
  duration_hours double precision,
  viewers integer default 0,
  gmv double precision default 0,
  orders_count integer default 0,
  status text default 'completed',
  notes text,
  created_at timestamptz default current_timestamp,
  cargo_sheet text,
  traffic_plan text,
  estimated_ad_cost double precision default 0,
  expected_gmv double precision default 0,
  travel_cost_share double precision default 0,
  brand_receivable double precision default 0,
  owner text,
  assistant text,
  live_city text,
  live_venue text,
  live_network text,
  samples text,
  plan_notes text,
  execution_notes text,
  cost_notes text,
  actual_gmv_sgd double precision default 0,
  big_screen_screenshot text,
  actual_traffic_usd double precision default 0,
  screen_traffic_sgd double precision default 0,
  actual_traffic_provider text,
  traffic_notes text,
  post_live_notes text,
  traffic_receivable_type text,
  traffic_receivable_amount double precision default 0,
  influencer_travel_note text,
  schedule_other_note text,
  schedule_type text default 'session',
  brand_category text,
  brand_cooperation_mode text
);

create table public.orders (
  id serial primary key,
  order_no text unique not null,
  live_session_id integer references public.live_sessions(id),
  influencer_id integer references public.influencers(id),
  merchant_id integer references public.merchants(id),
  product_id integer references public.products(id),
  platform text not null,
  order_date timestamptz not null,
  product_name text,
  quantity integer not null,
  unit_price double precision not null,
  total_amount double precision not null,
  commission_rate double precision,
  commission_amount double precision default 0,
  settlement_status text default 'pending',
  settlement_date timestamptz,
  created_at timestamptz default current_timestamp
);

create table public.expenses (
  id serial primary key,
  type text not null,
  category text not null,
  amount double precision not null,
  currency text default 'SGD',
  expense_date timestamptz not null,
  related_influencer_id integer references public.influencers(id),
  related_merchant_id integer references public.merchants(id),
  related_live_session_id integer references public.live_sessions(id),
  description text,
  payment_method text,
  status text default 'paid',
  receipt_no text,
  created_at timestamptz default current_timestamp
);

create table public.costs (
  id serial primary key,
  type text not null,
  category text not null,
  amount double precision not null,
  currency text default 'SGD',
  cost_date timestamptz not null,
  related_influencer_id integer references public.influencers(id),
  related_merchant_id integer references public.merchants(id),
  related_live_session_id integer references public.live_sessions(id),
  related_order_id integer references public.orders(id),
  related_product_id integer references public.products(id),
  description text,
  allocation_method text default 'average',
  status text default 'confirmed',
  created_at timestamptz default current_timestamp
);

create table public.income (
  id serial primary key,
  type text not null,
  category text not null,
  amount double precision not null,
  currency text default 'SGD',
  income_date timestamptz not null,
  related_influencer_id integer references public.influencers(id),
  related_merchant_id integer references public.merchants(id),
  related_order_id integer references public.orders(id),
  description text,
  status text default 'confirmed',
  created_at timestamptz default current_timestamp
);

create table if not exists public.app_accounts (
  id serial primary key,
  username text unique not null,
  password text not null,
  name text not null,
  role text not null,
  status text default 'active',
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp
);

insert into public.app_accounts (username, password, name, role, status)
values
  ('weilun', '123456', 'weilun', '老板', 'active'),
  ('boss', '123456', '老板', '老板', 'active'),
  ('finance', '123456', '财务', '财务', 'active'),
  ('Mia', '123456', 'Mia', '运营', 'active'),
  ('Aaron', '123456', 'Aaron', '运营', 'active'),
  ('Sophie', '123456', 'Sophie', '运营', 'active')
on conflict (username) do nothing;

create index idx_orders_influencer on public.orders(influencer_id);
create index idx_orders_merchant on public.orders(merchant_id);
create index idx_orders_date on public.orders(order_date);
create index idx_orders_platform on public.orders(platform);
create index idx_expenses_date on public.expenses(expense_date);
create index idx_expenses_influencer on public.expenses(related_influencer_id);
create index idx_costs_date on public.costs(cost_date);
create index idx_costs_influencer on public.costs(related_influencer_id);
create index idx_live_sessions_date on public.live_sessions(session_date);
create index idx_live_sessions_influencer on public.live_sessions(influencer_id);

alter table public.influencers disable row level security;
alter table public.merchants disable row level security;
alter table public.products disable row level security;
alter table public.live_sessions disable row level security;
alter table public.orders disable row level security;
alter table public.expenses disable row level security;
alter table public.costs disable row level security;
alter table public.income disable row level security;
alter table public.app_accounts disable row level security;

commit;
