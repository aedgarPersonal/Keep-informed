-- One-off tasks (a.k.a. specific-date appointments). The recurring
-- model already in `tasks` keeps weekdays as the schedule; this
-- migration relaxes the column so a task can carry a single
-- due_date instead. Exactly one of (weekdays, due_date) is set.

-- Drop the existing weekdays NOT NULL + size check; we replace
-- both with the XOR constraint below.
alter table tasks
  alter column weekdays drop not null;

alter table tasks
  drop constraint if exists tasks_weekdays_check;

-- Add due_date and the XOR constraint. The check on weekday
-- contents stays — when present it must still be a valid 1..7
-- subset of 0..6.
alter table tasks
  add column due_date date;

alter table tasks
  add constraint tasks_weekdays_shape check (
    weekdays is null or (
      array_length(weekdays, 1) between 1 and 7
      and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
    )
  );

alter table tasks
  add constraint tasks_recurrence_xor check (
    (weekdays is not null and due_date is null) or
    (weekdays is null and due_date is not null)
  );

create index tasks_due_date_idx
  on tasks (senior_id, due_date)
  where due_date is not null and archived_at is null;

-- Update materialize_today to also pick up one-off tasks whose
-- due_date matches the senior's local today.
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
       and (
         (t.weekdays is not null and v_dow = any(t.weekdays))
         or (t.due_date is not null and t.due_date = v_local_today)
       )
  on conflict (task_id, date) do nothing;

  return v_local_today;
end;
$$;
