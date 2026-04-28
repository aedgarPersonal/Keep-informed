# Data model — v1

Scope: the smallest schema that supports the v1 senior + caregiver flows.
Everything here lives in Supabase Postgres. Auth identities come from
`auth.users` (Supabase-managed); our own tables live in `public`.

## Entities

| Table | Purpose |
| --- | --- |
| `profiles` | One row per `auth.users` row, with display name and metadata. |
| `senior_caregiver_links` | Many-to-many: links a senior to one or more caregivers, with invite state. |
| `tasks` | A recurring item to do (e.g. "Take morning meds"). Owned by a senior, edited by their caregivers. |
| `task_instances` | One materialized occurrence of a task on a specific date. The senior's daily checklist is a query against this table. |
| `completions` | Records a senior tapping "done" on a task instance. One per instance. |
| `personal_rewards` | Caregiver-uploaded photos / notes shown to their senior after a completion. |

Rewards are a hybrid of two pools, only one of which is in the
database (see [Rewards](#rewards) below):

- **Curated**: jokes / fun facts, shipped as a static module
  (`src/lib/rewards.ts`). No table.
- **Personal**: caregiver-uploaded photos and short notes, scoped to
  one senior. Lives in `personal_rewards` + Supabase Storage.

A "senior" and a "caregiver" are both `profiles` rows — the role is
attached to the *link*, not the user, so the same identity could in
principle be a caregiver in one circle and a senior in another. v1
won't expose that, but the schema doesn't preclude it.

## Tables

```sql
-- profiles: one row per auth user.
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  created_at    timestamptz not null default now()
);

-- senior_caregiver_links: M:N with invite state.
-- caregiver_id is null while the invite is pending and not yet claimed.
create type link_status as enum ('pending', 'active', 'revoked');
create type link_role   as enum ('caregiver');  -- room for 'primary' etc.

create table senior_caregiver_links (
  id            uuid primary key default gen_random_uuid(),
  senior_id     uuid not null references profiles(id) on delete cascade,
  caregiver_id  uuid references profiles(id) on delete cascade,
  role          link_role   not null default 'caregiver',
  status        link_status not null default 'pending',
  invite_code   text unique,           -- present while pending; cleared on claim
  invited_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz
);
create index on senior_caregiver_links (senior_id);
create index on senior_caregiver_links (caregiver_id);

-- tasks: a recurring checklist item.
-- weekdays is an int[] of 0..6 (Sun..Sat). "Daily" = [0,1,2,3,4,5,6].
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
create index on tasks (senior_id) where archived_at is null;

-- task_instances: one row per (task, date). Materialized lazily on
-- first read of a given day for a senior.
create table task_instances (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  senior_id   uuid not null references profiles(id) on delete cascade, -- denormalized for RLS
  date        date not null,
  created_at  timestamptz not null default now(),
  unique (task_id, date)
);
create index on task_instances (senior_id, date);

-- completions: one per task_instance. reward_key records *what* was
-- shown, encoded as "curated:<key>" or "personal:<uuid>" so we can
-- dedup across both pools without a second FK.
create table completions (
  id              uuid primary key default gen_random_uuid(),
  task_instance_id uuid not null unique references task_instances(id) on delete cascade,
  senior_id       uuid not null references profiles(id) on delete cascade, -- denormalized for RLS
  reward_key      text,
  completed_at    timestamptz not null default now()
);
create index on completions (senior_id, completed_at);

-- personal_rewards: caregiver-uploaded photos and notes for one senior.
-- Photo files live in the `personal-rewards` Storage bucket; media_path
-- is the object path within that bucket.
create type personal_reward_kind as enum ('photo', 'note');

create table personal_rewards (
  id         uuid primary key default gen_random_uuid(),
  senior_id  uuid not null references profiles(id) on delete cascade,
  kind       personal_reward_kind not null,
  body       text,                 -- caption (photo) or note text
  media_path text,                 -- Storage object path; null when kind='note'
  created_by uuid not null references profiles(id),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (kind = 'photo' and media_path is not null) or
    (kind = 'note'  and body       is not null)
  )
);
create index on personal_rewards (senior_id) where active;
```

### Notes on shape

- `senior_id` is denormalized onto `task_instances` and `completions`.
  That's deliberate — every RLS check needs to know "which senior does
  this row belong to," and joining through `tasks` on every policy
  evaluation gets expensive.
- `weekdays` as a `smallint[]` keeps recurrence trivially queryable
  (`extract(dow from current_date) = any(weekdays)`). Anything
  RRULE-shaped (monthly, every-N-days, holidays) is out of v1 scope —
  see Deferred at the bottom.
- `archived_at` on `tasks` is a soft delete. Hard-deleting a task
  would cascade to its instances and completions, which we don't want
  — caregivers should still be able to look at last week's history.

## Lifecycles

### Invite → link
1. Caregiver A signs up, creates a senior profile (or invites an
   existing senior), generates a row in `senior_caregiver_links` with
   `senior_id` set, `caregiver_id` null, `invite_code` set, `status`
   = `'pending'`.
2. Senior opens the invite link (code in URL), authenticates via
   magic link.
3. A `claim_invite(code text)` SECURITY DEFINER RPC validates the
   code, sets `caregiver_id` (or `senior_id` — see open question
   below), `status = 'active'`, `accepted_at = now()`, and clears
   `invite_code`.

Open question: who does the inviting? The brief says
"caregiver-generated invite code/link pairs accounts." Two readable
flows:

- **Caregiver-first**: caregiver signs up, creates the senior's
  profile, sends the invite link to the senior, who then claims it.
  The pending row has `senior_id` set, `caregiver_id` filled in by the
  RPC at claim time.
- **Senior-first**: senior signs up, generates a code, hands it to a
  family member who claims it as a caregiver. The pending row has
  `caregiver_id` set, `senior_id` filled in by the RPC at claim time.

The schema supports both because either FK can be null while pending.
We'll pick one in the auth/onboarding spike.

### Daily materialization
On the first read of `/today` for a given senior on a given date, a
server function materializes `task_instances` for tasks whose
`weekdays` include today and that aren't archived. Idempotent via the
`(task_id, date)` unique constraint. We'll likely run this through
a `materialize_today(senior uuid)` RPC so the policy surface stays
small.

### Completion → reward
1. Senior taps a checklist item.
2. Insert into `completions` with the `task_instance_id`.
3. The server runs the picker (see [Rewards](#rewards)) over the
   senior's personal pool + the static curated module, biased
   against anything in the senior's recent `completions.reward_key`
   history. The chosen `reward_key` is written back to the row.
4. UI shows the reward card.

Picking server-side keeps the personal pool's media URLs scoped to
the senior and lets the dedup window read directly from
`completions` without a client round-trip.

## Rewards

Two pools, picked from at completion time:

- **Curated pool** — jokes / fun facts in `src/lib/rewards.ts`,
  shipped with the app. Each item has a stable string `key` used
  in `completions.reward_key` as `"curated:<key>"`.
- **Personal pool** — rows in `personal_rewards` for the senior,
  with `active = true`. Recorded as `"personal:<uuid>"`.

### Picker

```
input:  personal_pool, curated_pool, recent_keys (last N completions
        for this senior, default N = 4)
output: one reward (with key)

1. Drop anything whose key is in recent_keys to make a "fresh" view
   of each pool.
2. If fresh_personal is non-empty, pick from it with probability
   PERSONAL_RATIO (default 0.7); otherwise from fresh_curated.
3. If the chosen pool's fresh view is empty, fall back to the other
   fresh view.
4. If both fresh views are empty, ignore recent_keys and pick from
   the union — guarantees we always return something.
```

Why it's structured this way:

- Personal beats curated 70/30 when both are available, so
  caregiver-uploaded content is the dominant experience without
  starving the curated fallback (which adds variety).
- Empty personal pool degrades silently to 100% curated — important
  on day one before any caregiver has uploaded anything.
- `recent_keys` is a soft constraint, not hard. With ~6 curated items
  and a recent buffer of 4, there's always something fresh; if the
  curated module ever shrinks, the picker still returns instead of
  throwing.

### Storage

Personal photos live in a private Supabase Storage bucket
`personal-rewards`. Object paths follow `<senior_id>/<reward_id>.<ext>`,
which makes the per-senior RLS predicate trivial:

```sql
-- Pseudocode for bucket policy:
-- read:  current user is the senior or a caregiver for split_part(name, '/', 1)
-- write: current user is_caregiver_for(split_part(name, '/', 1))
```

Senior reads happen via signed URLs minted by the same server
action that runs the picker — clients never get the bucket key.

## RLS strategy

Two predicates carry almost all the work:

```sql
-- True iff the current user is an active caregiver for `senior`.
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
      and caregiver_id = auth.uid()
      and status = 'active'
  );
$$;

-- True iff the current user *is* `senior`.
-- (auth.uid() = senior is fine inline; this is just for symmetry.)
```

`security definer` on `is_caregiver_for` is intentional: without it,
the policy on `senior_caregiver_links` itself would be evaluated
recursively whenever any other policy calls the helper. With definer,
the helper bypasses RLS on its single, narrow query.

### Policy stubs

```sql
alter table profiles enable row level security;
alter table senior_caregiver_links enable row level security;
alter table tasks enable row level security;
alter table task_instances enable row level security;
alter table completions enable row level security;
alter table personal_rewards enable row level security;

-- profiles: a user can see their own row, plus the rows of anyone
-- they're linked to in either direction.
create policy profiles_select on profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from senior_caregiver_links l
    where l.status = 'active'
      and (
        (l.senior_id = profiles.id and l.caregiver_id = auth.uid())
        or (l.caregiver_id = profiles.id and l.senior_id = auth.uid())
      )
  )
);
create policy profiles_insert on profiles for insert with check (id = auth.uid());
create policy profiles_update on profiles for update using (id = auth.uid());

-- senior_caregiver_links: visible to either side of the link.
-- Inserts/updates that cross the trust boundary go through RPCs.
create policy links_select on senior_caregiver_links for select using (
  senior_id = auth.uid() or caregiver_id = auth.uid()
);

-- tasks: senior reads own; caregivers read+write linked seniors' tasks.
create policy tasks_select on tasks for select using (
  senior_id = auth.uid() or is_caregiver_for(senior_id)
);
create policy tasks_write on tasks for all using (
  is_caregiver_for(senior_id)
) with check (
  is_caregiver_for(senior_id) and created_by = auth.uid()
);

-- task_instances: read by senior + caregivers; writes via RPC.
create policy instances_select on task_instances for select using (
  senior_id = auth.uid() or is_caregiver_for(senior_id)
);

-- completions: senior writes their own; both sides can read.
create policy completions_select on completions for select using (
  senior_id = auth.uid() or is_caregiver_for(senior_id)
);
create policy completions_insert on completions for insert with check (
  senior_id = auth.uid()
);
create policy completions_delete on completions for delete using (
  senior_id = auth.uid()
);

-- personal_rewards: senior reads own active rewards; caregivers
-- read + write any reward for a senior they're linked to.
create policy personal_rewards_select on personal_rewards for select using (
  (senior_id = auth.uid() and active)
  or is_caregiver_for(senior_id)
);
create policy personal_rewards_write on personal_rewards for all using (
  is_caregiver_for(senior_id)
) with check (
  is_caregiver_for(senior_id) and created_by = auth.uid()
);
```

`task_instances` has no insert policy — materialization is done by a
SECURITY DEFINER RPC that the senior calls. This avoids letting a
malicious client backfill arbitrary dates.

## Deferred (out of v1)

- Time-of-day slots ("morning meds" vs "evening meds"). The brief
  treats today as one flat list.
- Streaks and gamification beyond a per-completion reward.
- Recurrence beyond weekday selection (every-other-day, monthly).
- Photo proof of completion; caregiver-to-caregiver messaging; push notifications.
- Auto-sourced reward content (live web fetch, "this day in
  history," etc.). If we ever want fresher content than the curated
  module, the path is batch-generate-then-approve, not runtime
  scraping — the harm asymmetry is too steep.
- Caregiver-to-caregiver permissions ("primary" vs "viewer"). The
  `link_role` enum has the seat reserved.

## Open questions

1. Invite direction (see lifecycle above). _Decided: caregiver-first.
   Schema update for placeholder profiles still pending in this doc._
2. Timezone of "today". _Decided: store IANA tz on profiles, "today"
   evaluated in the senior's tz, app prompts on detected change.
   Schema update still pending in this doc._
3. ~~Whether to keep `rewards` in Postgres or move it to a static
   JSON bundle.~~ Resolved: hybrid — curated stays as a static
   module, personal lives in `personal_rewards`. See [Rewards](#rewards).
