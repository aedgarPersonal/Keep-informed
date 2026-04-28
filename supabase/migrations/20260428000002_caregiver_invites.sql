-- Secondary-caregiver invite plumbing. The schema already supports
-- pending links; this migration adds the create + revoke RPCs and
-- grants them to authenticated users so the existing caregiver UI
-- can call them without bypassing RLS.

-- Existing caregiver creates a pending link row carrying the invite
-- code. Returns the code so the UI can build the share URL.
create or replace function public.create_caregiver_invite(p_senior uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caregiver uuid := current_profile_id();
  v_code      text := encode(gen_random_bytes(8), 'hex');
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

-- Revoke a pending invite or remove an active caregiver. Any active
-- caregiver for the senior may call this — caregivers are peers in
-- v1; hierarchy comes later.
create or replace function public.revoke_caregiver_link(p_link uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_senior uuid;
begin
  select senior_id into v_senior
    from senior_caregiver_links
   where id = p_link;
  if v_senior is null then
    raise exception 'link not found';
  end if;
  if not is_caregiver_for(v_senior) then
    raise exception 'not authorized';
  end if;

  update senior_caregiver_links
     set status      = 'revoked',
         invite_code = null
   where id = p_link;
end;
$$;

-- Resolve a caregiver invite code to the inviting senior's display
-- name + the inviting caregiver's display name. Lets the
-- /caregiver-invite/[code] page greet the new caregiver with context
-- before they sign in. Safe to expose: the code is the access token.
create or replace function public.lookup_caregiver_invite(p_code text)
returns table (senior_name text, inviter_name text)
language sql
stable
security definer
set search_path = public
as $$
  select s.display_name as senior_name,
         i.display_name as inviter_name
    from senior_caregiver_links l
    join profiles s on s.id = l.senior_id
    join profiles i on i.id = l.invited_by
   where l.invite_code = p_code
     and l.status = 'pending'
     and l.caregiver_id is null;
$$;

grant execute on function public.create_caregiver_invite(uuid) to authenticated;
grant execute on function public.revoke_caregiver_link(uuid)   to authenticated;
grant execute on function public.lookup_caregiver_invite(text) to anon, authenticated;
