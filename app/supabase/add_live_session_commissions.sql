alter table public.live_sessions
  add column if not exists influencer_commission_rate double precision default 0;

alter table public.live_sessions
  add column if not exists brand_commission_rate double precision default 0;
