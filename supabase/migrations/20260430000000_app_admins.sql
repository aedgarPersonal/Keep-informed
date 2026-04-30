-- App admins (operator role, orthogonal to senior/caregiver). Used
-- by /admin to view all billing groups. Granting admin is an
-- out-of-band action via the SQL editor; there is no in-app flow
-- for it in v1, by design — the trust boundary is the database.

create table app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table app_admins enable row level security;
-- No policies on app_admins. Reads happen via the is_app_admin
-- SECURITY DEFINER helper; writes happen via the SQL editor.

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (select 1 from app_admins where user_id = auth.uid());
$$;

grant execute on function public.is_app_admin() to authenticated;

-- One row per senior who has at least one active caregiver link.
-- "Billing group" = senior + their caregivers, which is the unit of
-- billing per the product brief. Returns engagement metrics so the
-- admin view can surface inactive groups without an extra round
-- trip. Caregivers come back as JSONB to avoid row multiplication.
create or replace function public.list_billing_groups()
returns table (
  senior_id          uuid,
  senior_name        text,
  senior_email       text,
  senior_claimed     boolean,
  senior_created_at  timestamptz,
  senior_autonomy    senior_autonomy_level,
  active_task_count  int,
  last_completion_at timestamptz,
  completions_30d    int,
  caregivers         jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_app_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select
      s.id,
      s.display_name,
      au.email::text,
      s.auth_user_id is not null,
      s.created_at,
      s.senior_autonomy,
      coalesce((
        select count(*)::int
          from tasks t
         where t.senior_id = s.id and t.archived_at is null
      ), 0),
      (select max(c.completed_at) from completions c where c.senior_id = s.id),
      coalesce((
        select count(*)::int
          from completions c
         where c.senior_id = s.id
           and c.completed_at > now() - interval '30 days'
      ), 0),
      coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'caregiver_id', cp.id,
                   'display_name', cp.display_name,
                   'email',        cau.email,
                   'joined_at',    l.accepted_at
                 )
                 order by l.accepted_at
               )
          from senior_caregiver_links l
          join profiles cp on cp.id = l.caregiver_id
          left join auth.users cau on cau.id = cp.auth_user_id
         where l.senior_id = s.id and l.status = 'active'
      ), '[]'::jsonb)
    from profiles s
    left join auth.users au on au.id = s.auth_user_id
    where exists (
      select 1 from senior_caregiver_links l2
      where l2.senior_id = s.id and l2.status = 'active'
    )
    order by s.created_at desc;
end;
$$;

grant execute on function public.list_billing_groups() to authenticated;
