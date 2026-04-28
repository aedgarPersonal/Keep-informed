-- AI medication review.
-- Adds caregiver-curated medical context to senior profiles, an
-- acceptance timestamp for the AI disclaimer gate, and a history
-- table for past reviews.
--
-- This feature is a triage prompt to talk to a doctor or pharmacist,
-- not a substitute. The disclaimer gate and rate limit live here in
-- the schema so they're enforced server-side, not just in the UI.

alter table profiles
  add column medical_notes              text,
  add column accepted_ai_disclaimer_at  timestamptz;

create table medication_reviews (
  id              uuid primary key default gen_random_uuid(),
  senior_id       uuid not null references profiles(id) on delete cascade,
  requested_by    uuid not null references profiles(id),
  -- Snapshot of what we sent to the model: medication tasks (with notes),
  -- senior medical notes, and tz/age context. Stored so reviewing the
  -- past output makes sense even if tasks have changed since.
  input_snapshot  jsonb not null,
  -- Structured response from the model. Shape mirrors the Zod schema
  -- in src/lib/medication-review/types.ts.
  result          jsonb not null,
  model           text not null,
  created_at      timestamptz not null default now()
);
create index medication_reviews_senior_time_idx
  on medication_reviews (senior_id, created_at desc);

alter table medication_reviews enable row level security;

-- Caregivers may read reviews for seniors they're linked to.
create policy medication_reviews_select on medication_reviews for select using (
  is_caregiver_for(senior_id)
);
-- Inserts are server-only (run_medication_review action uses the
-- caller's session, so we still need a write policy that scopes to
-- linked caregivers).
create policy medication_reviews_insert on medication_reviews for insert with check (
  is_caregiver_for(senior_id) and requested_by = current_profile_id()
);

-- Caregiver records the senior's acceptance of the disclaimer once.
-- One-shot; idempotent (only stamps if currently null).
create or replace function public.accept_ai_disclaimer()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := current_profile_id();
  v_at timestamptz;
begin
  if v_id is null then
    raise exception 'caller has no profile';
  end if;

  update profiles
     set accepted_ai_disclaimer_at = coalesce(accepted_ai_disclaimer_at, now())
   where id = v_id
   returning accepted_ai_disclaimer_at into v_at;

  return v_at;
end;
$$;

grant execute on function public.accept_ai_disclaimer() to authenticated;
