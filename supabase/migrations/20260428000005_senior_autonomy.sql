-- Senior autonomy levels + universal completion undo.
--
-- senior_autonomy controls how much agency the senior has on /today.
-- The default is view_only (tap-to-complete only); caregivers can dial
-- it up via set_senior_autonomy(). It's stored on the senior's
-- profile but a trigger prevents the senior themselves from changing
-- it via a direct UPDATE — the only path is the SECURITY DEFINER RPC,
-- which checks is_caregiver_for() before applying.
--
-- undo_completion lets any senior take back a completion they tapped
-- by accident, but only within 5 minutes. After that it's read-only
-- history; the caregiver would have to fix it.

create type senior_autonomy_level as enum
  ('view_only', 'assisted', 'self_directed');

alter table profiles
  add column senior_autonomy senior_autonomy_level not null
    default 'view_only';

-- Trigger: a senior can update their own profile (display_name,
-- timezone, etc.) but not their senior_autonomy field. Caregiver
-- updates flow through set_senior_autonomy and have OLD.id != caller.
create or replace function public.profiles_block_self_autonomy_edit()
returns trigger
language plpgsql
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

create trigger profiles_protect_senior_autonomy
  before update on profiles
  for each row
  execute function public.profiles_block_self_autonomy_edit();

-- Caregiver dials a linked senior's autonomy up or down.
create or replace function public.set_senior_autonomy(
  p_senior uuid,
  p_level  senior_autonomy_level
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_caregiver_for(p_senior) then
    raise exception 'not authorized';
  end if;

  update profiles set senior_autonomy = p_level where id = p_senior;
end;
$$;

-- Senior takes back an accidental tap. 5-minute window — past that,
-- the completion is treated as historical record.
create or replace function public.undo_completion(p_task_instance uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_senior       uuid;
  v_completed_at timestamptz;
begin
  select c.senior_id, c.completed_at
    into v_senior, v_completed_at
    from completions c
   where c.task_instance_id = p_task_instance;

  if v_senior is null then
    raise exception 'completion not found';
  end if;
  if v_senior <> current_profile_id() then
    raise exception 'not authorized';
  end if;
  if now() - v_completed_at > interval '5 minutes' then
    raise exception 'completion is too old to undo';
  end if;

  delete from completions where task_instance_id = p_task_instance;
end;
$$;

grant execute on function public.set_senior_autonomy(uuid, senior_autonomy_level) to authenticated;
grant execute on function public.undo_completion(uuid) to authenticated;
