-- Harden the autonomy-edit trigger by pinning its search_path. The
-- function reads from `current_profile_id()` and writes back, so any
-- attacker-controlled schema reachable via search_path is a privilege
-- vector. Caught by Supabase advisor 0011_function_search_path_mutable.
-- The body is unchanged — only the function definition adds
-- `set search_path = public`.

create or replace function public.profiles_block_self_autonomy_edit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.senior_autonomy is distinct from old.senior_autonomy
     and old.id = current_profile_id()
  then
    raise exception 'senior_autonomy can only be set by a caregiver';
  end if;
  return new;
end;
$$;
