-- pgcrypto lives in the `extensions` schema on Supabase, not `public`.
-- Our SECURITY DEFINER functions all pin `set search_path = public`
-- (closing the privilege-escalation vector), so a bare reference to
-- `gen_random_bytes` raises 'function does not exist' at runtime —
-- caught the first time a caregiver tried to add a senior in prod.
--
-- Fix: fully qualify as `extensions.gen_random_bytes`. Don't broaden
-- search_path; the strict `public`-only setting is the principled
-- choice. The source migrations 00000_init and 00002_caregiver_invites
-- have been amended in place too, so a fresh `db reset` produces the
-- same shape without needing this migration.
--
-- gen_random_uuid() is unaffected — it's a Postgres built-in since
-- v14 and lives in pg_catalog, which is implicit in any search_path.

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
  v_code      text := encode(extensions.gen_random_bytes(8), 'hex');
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

create or replace function public.create_caregiver_invite(p_senior uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caregiver uuid := current_profile_id();
  v_code      text := encode(extensions.gen_random_bytes(8), 'hex');
begin
  if v_caregiver is null then
    raise exception 'caller has no profile';
  end if;
  if not is_caregiver_for(p_senior) then
    raise exception 'not authorized for this senior';
  end if;

  insert into senior_caregiver_links (
    senior_id, caregiver_id, status, invite_code, invited_by
  ) values (
    p_senior, null, 'pending', v_code, v_caregiver
  );

  return v_code;
end;
$$;
