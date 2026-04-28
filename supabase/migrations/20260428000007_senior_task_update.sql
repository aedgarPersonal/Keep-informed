-- Senior task edit. Symmetric with senior_create_task — same
-- autonomy gates, same own-task check, never touches `notes` or
-- `category` (those stay as the create-time defaults; caregivers
-- can refine via the regular tasks_write policy).

create or replace function public.senior_update_task(
  p_task     uuid,
  p_title    text,
  p_color    text,
  p_weekdays smallint[],
  p_due_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me        uuid := current_profile_id();
  v_autonomy  senior_autonomy_level;
  v_existing  record;
  v_title     text;
begin
  if v_me is null then
    raise exception 'caller has no profile';
  end if;

  select senior_autonomy into v_autonomy from profiles where id = v_me;
  if v_autonomy is null or v_autonomy = 'view_only' then
    raise exception 'not authorized';
  end if;

  select id, senior_id, created_by, archived_at
    into v_existing
    from tasks
   where id = p_task;
  if v_existing.id is null then
    raise exception 'task not found';
  end if;
  if v_existing.senior_id <> v_me or v_existing.created_by <> v_me then
    raise exception 'not authorized';
  end if;
  if v_existing.archived_at is not null then
    raise exception 'task is archived';
  end if;

  v_title := nullif(trim(coalesce(p_title, '')), '');
  if v_title is null then
    raise exception 'title required';
  end if;

  if (p_weekdays is null) = (p_due_date is null) then
    raise exception 'specify exactly one of weekdays or due_date';
  end if;

  if v_autonomy = 'assisted' and p_due_date is null then
    raise exception 'assisted seniors can only have one-off tasks';
  end if;

  if p_color is not null and p_color not in (
    'pink','red','orange','yellow','green','blue','purple','brown'
  ) then
    raise exception 'invalid color';
  end if;

  update tasks set
    title    = v_title,
    color    = p_color,
    weekdays = p_weekdays,
    due_date = p_due_date
   where id = p_task;
end;
$$;

grant execute on function public.senior_update_task(uuid, text, text, smallint[], date) to authenticated;
