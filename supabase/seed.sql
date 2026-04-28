-- Local-dev seed. Runs as the `postgres` role after migrations, so it
-- bypasses RLS. Don't ship this to a real environment.
--
-- Creates one caregiver, one senior they care for, a handful of
-- tasks, and a couple of personal rewards. Sign in to the local
-- Supabase Studio and use the email below to issue a magic link.

-- ---------------------------------------------------------------
-- Auth users
-- ---------------------------------------------------------------
-- A realistic auth.users row needs more than `id + email`, but the
-- minimum for local-dev sign-in is sufficient here. Passwords are
-- unused (we sign in with magic link).
insert into auth.users (
  id, instance_id, aud, role, email,
  email_confirmed_at, raw_user_meta_data,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'caregiver@example.com',
  now(), '{}'::jsonb,
  now(), now()
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Caregiver profile (auth-backed)
-- ---------------------------------------------------------------
insert into profiles (id, auth_user_id, display_name, timezone)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000001',
  'Alex (caregiver)',
  'America/New_York'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Senior placeholder + active link to the caregiver
-- ---------------------------------------------------------------
insert into profiles (id, auth_user_id, display_name, timezone, invite_code)
values (
  '22222222-2222-2222-2222-222222222222',
  null,
  'Mom',
  'America/New_York',
  'devseedinvite'
)
on conflict (id) do nothing;

insert into senior_caregiver_links (
  id, senior_id, caregiver_id, status, invited_by, accepted_at
) values (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'active',
  '11111111-1111-1111-1111-111111111111',
  now()
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Tasks (daily, except the walk on weekdays only)
-- ---------------------------------------------------------------
insert into tasks (id, senior_id, title, weekdays, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222',
   'Take morning medication',
   array[0,1,2,3,4,5,6]::smallint[],
   '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222',
   'Brush teeth',
   array[0,1,2,3,4,5,6]::smallint[],
   '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000003',
   '22222222-2222-2222-2222-222222222222',
   'Drink a glass of water',
   array[0,1,2,3,4,5,6]::smallint[],
   '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000004',
   '22222222-2222-2222-2222-222222222222',
   'Short walk outside',
   array[1,2,3,4,5]::smallint[],  -- weekdays only
   '11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- One personal reward (note) so the senior sees something familiar
-- on their first completion. Photo seeding needs Storage upload,
-- which the seed file can't do — add via the caregiver UI.
-- ---------------------------------------------------------------
insert into personal_rewards (id, senior_id, kind, body, created_by)
values (
  'bbbbbbbb-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  'note',
  'We love you, Mom. — Alex & the kids',
  '11111111-1111-1111-1111-111111111111'
)
on conflict (id) do nothing;
