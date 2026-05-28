-- Run this after you create users in Supabase Authentication.
-- Replace the UUID values below with the User UID copied from Authentication > Users.

insert into public.profiles (id, name, role, status)
values
  ('00000000-0000-0000-0000-000000000001', 'weilun', 'owner', 'active'),
  ('00000000-0000-0000-0000-000000000002', '财务', 'finance', 'active'),
  ('00000000-0000-0000-0000-000000000003', '运营', 'operator', 'active')
on conflict (id) do update
set
  name = excluded.name,
  role = excluded.role,
  status = excluded.status,
  updated_at = now();

insert into public.employees (profile_id, name, role_name, team, shift, commission_rate, status)
values
  ('00000000-0000-0000-0000-000000000003', '运营', '运营负责人', '直播运营组', '09:00-18:00', 0.018, '在岗')
on conflict do nothing;
