-- Senior-side task management.
--
-- Both create and archive run as SECURITY DEFINER so we can validate
-- autonomy level and own-task-ness in one place. The existing
-- tasks_write RLS policy stays caregiver-only — keeping the
-- caregiver/senior write paths in different shapes (policy vs RPC)
-- makes the trust boundary obvious in code review.
--
-- Hard rules enforced here:
-- - view_only: cannot create or archive anything.
-- - assisted: one-off tasks only (due_date set, weekdays null).
-- - self_directed: either schedule shape.
-- - Senior cannot set `notes` on self-created tasks (caregiver-only
--   field; the RPC simply doesn't accept it).
-- - Archive only ever targets a task the senior created themselves.

create or replace function public.senior_create_task(
  p_title    text,
  p_color    text,
  p_weekdays smallint[],
  p_due_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me        uuid := current_profile_id();
  v_autonomy  senior_autonomy_level;
  v_task_id   uuid;
  v_title     text;
begin
  if v_me is null then
    raise exception 'caller has no profile';
  end if;

  select senior_autonomy into v_autonomy from profiles where id = v_me;
  if v_autonomy is null or v_autonomy = 'view_only' then
    raise exception 'not authorized to add tasks';
  end if;

  v_title := nullif(trim(coalesce(p_title, '')), '');
  if v_title is null then
    raise exception 'title required';
  end if;

  -- Exactly one of weekdays / due_date (mirrors the table check).
  if (p_weekdays is null) = (p_due_date is null) then
    raise exception 'specify exactly one of weekdays or due_date';
  end if;

  -- Assisted seniors can only add one-off tasks.
  if v_autonomy = 'assisted' and p_due_date is null then
    raise exception 'assisted seniors can only add one-off tasks';
  end if;

  -- Color must be in palette or null. Re-check here so the RPC
  -- isn't relying on the table constraint catching it (clearer error).
  if p_color is not null and p_color not in (
    'pink','red','orange','yellow','green','blue','purple','brown'
  ) then
    raise exception 'invalid color';
  end if;

  insert into tasks (
    senior_id, title, weekdays, due_date, color, category, created_by
  ) values (
    v_me, v_title, p_weekdays, p_due_date, p_color, 'other', v_me
  )
  returning id into v_task_id;

  return v_task_id;
end;
$$;

create or replace function public.senior_archive_task(p_task uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       uuid := current_profile_id();
  v_autonomy senior_autonomy_level;
  v_task     record;
begin
  if v_me is null then
    raise exception 'caller has no profile';
  end if;

  select senior_autonomy into v_autonomy from profiles where id = v_me;
  if v_autonomy is null or v_autonomy = 'view_only' then
    raise exception 'not authorized';
  end if;

  select id, senior_id, created_by, due_date
    into v_task
    from tasks
   where id = p_task;
  if v_task.id is null then
    raise exception 'task not found';
  end if;
  if v_task.senior_id <> v_me or v_task.created_by <> v_me then
    raise exception 'not authorized';
  end if;

  -- Assisted may only archive one-off tasks (the only kind they can
  -- create — but this is defense-in-depth in case autonomy was
  -- downgraded after a self_directed senior created a recurring task).
  if v_autonomy = 'assisted' and v_task.due_date is null then
    raise exception 'assisted seniors can only archive one-off tasks';
  end if;

  update tasks set archived_at = now() where id = p_task;
end;
$$;

grant execute on function public.senior_create_task(text, text, smallint[], date) to authenticated;
grant execute on function public.senior_archive_task(uuid) to authenticated;
