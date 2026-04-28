-- Keep Informed — initial schema.
-- Mirrors docs/data-model.md. Order: extensions → enums → tables →
-- indexes → helpers → RPCs → enable RLS → policies → storage.

-- ---------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------
create extension if not exists pgcrypto;  -- gen_random_uuid, gen_random_bytes

-- ---------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------
create type link_status          as enum ('pending', 'active', 'revoked');
create type link_role            as enum ('caregiver');
create type personal_reward_kind as enum ('photo', 'note');

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------
create table profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  display_name  text not null,
  timezone      text not null default 'UTC',
  invite_code   text unique,
  created_at    timestamptz not null default now()
);
create index profiles_auth_user_id_idx on profiles (auth_user_id);

create table senior_caregiver_links (
  id            uuid primary key default gen_random_uuid(),
  senior_id     uuid not null references profiles(id) on delete cascade,
  caregiver_id  uuid references profiles(id) on delete cascade,
  role          link_role   not null default 'caregiver',
  status        link_status not null default 'pending',
  invite_code   text unique,
  invited_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz
);
create index links_senior_idx    on senior_caregiver_links (senior_id);
create index links_caregiver_idx on senior_caregiver_links (caregiver_id);

create table tasks (
  id          uuid primary key default gen_random_uuid(),
  senior_id   uuid not null references profiles(id) on delete cascade,
  title       text not null,
  weekdays    smallint[] not null check (
                array_length(weekdays, 1) between 1 and 7
                and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
              ),
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);
create index tasks_senior_active_idx
  on tasks (senior_id) where archived_at is null;

create table task_instances (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  senior_id   uuid not null references profiles(id) on delete cascade,
  date        date not null,
  created_at  timestamptz not null default now(),
  unique (task_id, date)
);
create index instances_senior_date_idx on task_instances (senior_id, date);

create table completions (
  id               uuid primary key default gen_random_uuid(),
  task_instance_id uuid not null unique references task_instances(id) on delete cascade,
  senior_id        uuid not null references profiles(id) on delete cascade,
  reward_key       text,
  completed_at     timestamptz not null default now()
);
create index completions_senior_time_idx on completions (senior_id, completed_at desc);

create table personal_rewards (
  id         uuid primary key default gen_random_uuid(),
  senior_id  uuid not null references profiles(id) on delete cascade,
  kind       personal_reward_kind not null,
  body       text,
  media_path text,
  created_by uuid not null references profiles(id),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (kind = 'photo' and media_path is not null) or
    (kind = 'note'  and body       is not null)
  )
);
create index personal_rewards_active_idx
  on personal_rewards (senior_id) where active;

-- ---------------------------------------------------------------
-- Helper functions used inside RLS policies
-- ---------------------------------------------------------------
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from profiles where auth_user_id = auth.uid();
$$;

create or replace function public.is_caregiver_for(senior uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from senior_caregiver_links
    where senior_id = senior
      and caregiver_id = current_profile_id()
      and status = 'active'
  );
$$;

-- ---------------------------------------------------------------
-- RPCs (all SECURITY DEFINER; callers checked via auth.uid())
-- ---------------------------------------------------------------

-- Idempotent: returns the caller's profile, creating it on first call.
create or replace function public.bootstrap_self_profile(
  p_display_name text,
  p_timezone     text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select id into v_id from profiles where auth_user_id = auth.uid();
  if found then
    return v_id;
  end if;

  insert into profiles (auth_user_id, display_name, timezone)
  values (auth.uid(), p_display_name, coalesce(p_timezone, 'UTC'))
  returning id into v_id;

  return v_id;
end;
$$;

-- Caregiver creates a senior placeholder + active link in one tx.
create or replace function public.create_senior_profile(
  p_display_name text,
  p_timezone     text default 'UTC'
)
returns table (senior_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caregiver uuid := current_profile_id();
  v_senior    uuid;
  v_code      text := encode(gen_random_bytes(8), 'hex');
begin
  if v_caregiver is null then
    raise exception 'caller has no profile';
  end if;

  insert into profiles (display_name, timezone, invite_code)
  values (p_display_name, coalesce(p_timezone, 'UTC'), v_code)
  returning id into v_senior;

  insert into senior_caregiver_links (
    senior_id, caregiver_id, status, invited_by, accepted_at
  ) values (
    v_senior, v_caregiver, 'active', v_caregiver, now()
  );

  return query select v_senior, v_code;
end;
$$;

-- Resolve a senior invite code to its placeholder display name. Used
-- by /claim/[code] to greet the senior by name before they sign in.
-- Returns null if the code is unknown, expired, or already claimed.
-- Safe to expose: caregivers chose the display_name they're willing
-- to put on the invite, and the code itself is the access token.
create or replace function public.lookup_senior_invite(p_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select display_name
    from profiles
   where invite_code = p_code
     and auth_user_id is null;
$$;

-- Senior signs in via magic link, then claims their placeholder profile.
create or replace function public.claim_senior_profile(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from profiles where auth_user_id = auth.uid()) then
    raise exception 'caller already has a profile';
  end if;

  update profiles
    set auth_user_id = auth.uid(),
        invite_code  = null
  where invite_code = p_code
    and auth_user_id is null
  returning id into v_id;

  if v_id is null then
    raise exception 'invalid or expired invite code';
  end if;

  return v_id;
end;
$$;

-- A second caregiver claims a pending link row.
create or replace function public.claim_caregiver_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caregiver uuid := current_profile_id();
  v_link      uuid;
begin
  if v_caregiver is null then
    raise exception 'caller has no profile';
  end if;

  update senior_caregiver_links
    set caregiver_id = v_caregiver,
        status       = 'active',
        accepted_at  = now(),
        invite_code  = null
  where invite_code = p_code
    and status = 'pending'
    and caregiver_id is null
  returning id into v_link;

  if v_link is null then
    raise exception 'invalid or expired caregiver invite';
  end if;

  return v_link;
end;
$$;

-- Senior or linked caregiver may call this. Idempotent.
-- Returns the local date the materialization ran for.
create or replace function public.materialize_today(p_senior uuid)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_today date;
  v_dow         smallint;
begin
  if not (
    p_senior = current_profile_id()
    or is_caregiver_for(p_senior)
  ) then
    raise exception 'not authorized';
  end if;

  select (now() at time zone p.timezone)::date
    into v_local_today
    from profiles p
   where id = p_senior;

  if v_local_today is null then
    raise exception 'senior not found';
  end if;

  v_dow := extract(dow from v_local_today)::smallint;

  insert into task_instances (task_id, senior_id, date)
    select t.id, t.senior_id, v_local_today
      from tasks t
     where t.senior_id = p_senior
       and t.archived_at is null
       and v_dow = any(t.weekdays)
  on conflict (task_id, date) do nothing;

  return v_local_today;
end;
$$;

-- Mark a task instance complete. Returns the inserted completion id.
-- The caller passes a reward_key chosen by the app's picker; the RPC
-- only validates that the senior owns the instance.
create or replace function public.record_completion(
  p_task_instance uuid,
  p_reward_key    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_senior     uuid;
  v_completion uuid;
begin
  select senior_id into v_senior
    from task_instances
   where id = p_task_instance;

  if v_senior is null then
    raise exception 'task instance not found';
  end if;

  if v_senior <> current_profile_id() then
    raise exception 'not authorized';
  end if;

  insert into completions (task_instance_id, senior_id, reward_key)
    values (p_task_instance, v_senior, p_reward_key)
  returning id into v_completion;

  return v_completion;
end;
$$;

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
alter table profiles               enable row level security;
alter table senior_caregiver_links enable row level security;
alter table tasks                  enable row level security;
alter table task_instances         enable row level security;
alter table completions            enable row level security;
alter table personal_rewards       enable row level security;

-- profiles
create policy profiles_select on profiles for select using (
  id = current_profile_id()
  or exists (
    select 1 from senior_caregiver_links l
    where l.status = 'active'
      and (
        (l.senior_id    = profiles.id and l.caregiver_id = current_profile_id())
        or (l.caregiver_id = profiles.id and l.senior_id    = current_profile_id())
      )
  )
);
create policy profiles_update on profiles for update using (
  id = current_profile_id()
);

-- senior_caregiver_links
create policy links_select on senior_caregiver_links for select using (
  senior_id    = current_profile_id()
  or caregiver_id = current_profile_id()
);

-- tasks
create policy tasks_select on tasks for select using (
  senior_id = current_profile_id() or is_caregiver_for(senior_id)
);
create policy tasks_write on tasks for all using (
  is_caregiver_for(senior_id)
) with check (
  is_caregiver_for(senior_id) and created_by = current_profile_id()
);

-- task_instances (insert via materialize_today RPC; no insert policy)
create policy instances_select on task_instances for select using (
  senior_id = current_profile_id() or is_caregiver_for(senior_id)
);

-- completions (insert via record_completion RPC; only senior may delete)
create policy completions_select on completions for select using (
  senior_id = current_profile_id() or is_caregiver_for(senior_id)
);
create policy completions_delete on completions for delete using (
  senior_id = current_profile_id()
);

-- personal_rewards
create policy personal_rewards_select on personal_rewards for select using (
  (senior_id = current_profile_id() and active)
  or is_caregiver_for(senior_id)
);
create policy personal_rewards_write on personal_rewards for all using (
  is_caregiver_for(senior_id)
) with check (
  is_caregiver_for(senior_id) and created_by = current_profile_id()
);

-- ---------------------------------------------------------------
-- Storage bucket: personal-rewards
-- Object key convention: <senior_id>/<reward_id>.<ext>
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('personal-rewards', 'personal-rewards', false)
  on conflict (id) do nothing;

create policy "personal_rewards_objects_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'personal-rewards'
    and (
      split_part(name, '/', 1)::uuid = current_profile_id()
      or is_caregiver_for(split_part(name, '/', 1)::uuid)
    )
  );

create policy "personal_rewards_objects_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'personal-rewards'
    and is_caregiver_for(split_part(name, '/', 1)::uuid)
  );

create policy "personal_rewards_objects_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'personal-rewards'
    and is_caregiver_for(split_part(name, '/', 1)::uuid)
  );

create policy "personal_rewards_objects_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'personal-rewards'
    and is_caregiver_for(split_part(name, '/', 1)::uuid)
  );

-- ---------------------------------------------------------------
-- Grants — RPCs are called from the client; the helpers should not be.
-- ---------------------------------------------------------------
revoke all on function public.current_profile_id()        from public;
revoke all on function public.is_caregiver_for(uuid)      from public;

grant execute on function public.bootstrap_self_profile(text, text) to authenticated;
grant execute on function public.create_senior_profile(text, text)  to authenticated;
grant execute on function public.claim_senior_profile(text)         to authenticated;
grant execute on function public.claim_caregiver_invite(text)       to authenticated;
grant execute on function public.materialize_today(uuid)            to authenticated;
grant execute on function public.record_completion(uuid, text)      to authenticated;

-- lookup_senior_invite is callable without a session — anonymous and
-- authenticated both. The code is the access token.
grant execute on function public.lookup_senior_invite(text) to anon, authenticated;
