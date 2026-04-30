# Keep Informed — project context

A living index of decisions, conventions, and gotchas. Schema-level
detail lives in `docs/data-model.md`; this doc is what you'd want to
read before writing new code.

## Product brief (recap)

A PWA for seniors with cognitive decline + the caregivers (often adult
children) who support them.

- **Senior view** (`/today`): one screen, today's checklist, large tap
  targets, immediate joke/photo reward on completion.
- **Caregiver view** (`/caregiver/*`): senior management, task CRUD,
  personal-reward uploads, AI medication triage.
- **Linking**: caregiver onboards first, creates a placeholder for the
  senior, sends them an invite link. Senior claims via magic link.
  Many caregivers per senior.
- **Auth**: magic link (Supabase). No passwords.

## Stack

- Next.js 16 App Router (server components by default; `"use client"`
  only when state is needed). Server actions for all mutations — no
  API routes for forms.
- Supabase: Postgres + Auth + Storage + RLS.
- Tailwind v4 (CSS-based config; no `tailwind.config.js`).
- TypeScript everywhere; SDK types (`Anthropic.MessageParam`,
  `Anthropic.Tool`, etc.) used for API objects rather than redefining
  equivalents.

## File layout

| Path | Purpose |
| --- | --- |
| `src/app/today/*` | Senior view. Layout-gated to `requireSenior`. |
| `src/app/caregiver/*` | Caregiver view. Layout-gated to `requireCaregiver`. |
| `src/app/login`, `/auth/callback`, `/onboard`, `/claim/[code]`, `/caregiver-invite/[code]` | Auth + onboarding flows. |
| `src/lib/auth.ts` | `requireSession` / `requireProfile` / `requireSenior` / `requireCaregiver` / `getCallerProfileId`. |
| `src/lib/supabase/{browser,server,middleware}.ts` | Supabase client factories. |
| `src/lib/seniors.ts` | `loadLinkedSenior` — verifies caller is a caregiver for the target. |
| `src/lib/rewards.ts` | Curated joke/fact pool + `pickReward` (hybrid picker). |
| `src/lib/task-palette.ts` | The curated 8-color palette. |
| `src/lib/task-templates.ts` | Caregiver "quick start" template library. |
| `src/lib/medication-review/*` | AI med-review types + Anthropic client. |
| `supabase/migrations/*.sql` | Applied in filename order via `supabase db reset` / `db push`. |
| `supabase/seed.sql` | Local dev seed. Inserts a fake auth user — local-only, do not run against production. |
| `docs/data-model.md` | Authoritative schema spec, RLS policies, lifecycles. |
| `docs/context.md` | This file. |
| `public/sw.js` | Minimal service worker (no offline cache for v1). |

## Identity model — the key non-obvious bit

**`profiles.id` is NOT `auth.users.id`.** Profiles have their own
generated UUID and a nullable `auth_user_id` FK to `auth.users`. This
is what lets a caregiver create a placeholder senior profile *before*
the senior has signed in. When the senior claims the invite, their
auth user is bound to the placeholder.

Practical implication: never compare `auth.uid()` directly to a
profile-id column in RLS. Use the helper:

```sql
create function current_profile_id() returns uuid
language sql stable security definer
as $$ select id from profiles where auth_user_id = auth.uid(); $$;
```

The companion helper `is_caregiver_for(senior uuid)` carries the rest
of the policy load — almost every table's RLS reduces to "caller is
the senior, or `is_caregiver_for(senior_id)` is true." Both are
`security definer` to avoid RLS recursion on `profiles` and
`senior_caregiver_links`. See `docs/data-model.md#rls-strategy`.

## Role gating in app code

`src/lib/auth.ts` exposes five helpers; pick the smallest one that
covers the route. Pages should call them directly in the layout (or
the page if the layout is shared).

| Helper | Use when |
| --- | --- |
| `requireSession()` | Page just needs an authed user (e.g. `/onboard`). Returns the auth user. |
| `requireProfile()` | Page needs a `profiles` row; redirects authed-but-unbootstrapped users to `/onboard`. |
| `requireSenior()` | Page is for the senior. Bounces caregivers (incl. fresh ones with zero links) to `/caregiver`. |
| `requireCaregiver()` | Page is for caregivers. Bounces anyone who is the senior in any active link to `/today`. |
| `requireAdmin()` | Page is for app admins (`/admin/*`). Calls `is_app_admin()` RPC; non-admins go to `/`. Does **not** require a profile — admins are orthogonal to senior/caregiver. |

"Senior-ness" is *derived* from `senior_caregiver_links`, not stored
on the profile. A new caregiver with zero links is not a senior
anywhere; a person who claims an invite becomes one. This means a
single user can never sit in both roles in v1 — `requireSenior` and
`requireCaregiver` are mutually exclusive for a given profile.

Admin is the third axis. It lives on `app_admins` (an `auth.users`
mirror), not on `profiles`. Admin status doesn't grant senior or
caregiver access; it grants `/admin`. An admin who also wants to
use the app as a caregiver/senior needs a profile via the normal
onboard flow.

For server actions where redirecting is wrong, use
`getCallerProfileId()` — throws on missing rather than redirecting.

## Senior autonomy tiers

Stored on `profiles.senior_autonomy` (enum
`view_only | assisted | self_directed`, default `view_only`). The
caregiver dials it via the `set_senior_autonomy` RPC. A trigger blocks
the senior from changing their own value via a normal UPDATE — the
RPC is the only path, and it checks `is_caregiver_for()` first.

Tier semantics, enforced server-side in `senior_create_task`:

| Tier | What the senior can do on `/today` |
| --- | --- |
| `view_only` | Tap-to-complete. No task creation, no archive. |
| `assisted` | Add **one-off** tasks only (must have `due_date`, never `weekdays`). Can archive own tasks. |
| `self_directed` | Add either recurring or one-off tasks. Can archive own tasks. |

Senior task writes go through a separate RPC (`senior_create_task`,
plus update/archive RPCs) rather than the caregiver `tasks_write`
RLS policy. Keeping the caregiver and senior write paths in
*different shapes* (policy vs. SECURITY DEFINER RPC) makes the trust
boundary obvious in code review. Don't collapse them.

Other constraints baked into the senior path:

- Senior can never set `notes` — it's a caregiver-only field
  (clinical info, dosage). The RPC simply doesn't accept it.
- Archive only ever targets a task the senior themselves created.
  Caregiver-created tasks are immune to senior archive.

## Universal undo

`undo_completion(task_instance_id)` lets the senior take back a
completion, but only within **5 minutes** of the original tap. After
that the row is treated as historical record — caregivers would
need to clean it up. The window is enforced in the RPC, not the
client; don't try to extend it from the UI.

## AI medication review

Lives in `src/lib/medication-review/` and the
`run_medication_review` server action. Caregivers trigger a review
of a linked senior's medication-category tasks; the model produces a
structured triage write-up nudging the user to talk to a clinician.

Hard rules:

- **Triage, not advice.** Every prompt and every Zod field
  description in `types.ts` is calibrated to "talk to your doctor or
  pharmacist." The model never asserts dose changes. Don't loosen the
  field descriptions — the UI renders them directly, so wording
  drift is a product change, not a copy edit.
- **Disclaimer gate.** `profiles.accepted_ai_disclaimer_at` must be
  set before a review runs. Stamped exactly once via the
  `accept_ai_disclaimer()` RPC. Idempotent (`coalesce(..., now())`).
- **Structured output.** The model returns JSON conforming to
  `ReviewResultSchema`. Validate with Zod on receipt — never render
  unparsed model output. Severity is one of
  `info | possible_issue | discuss_now`; overall is one of
  `no_obvious_issues | review_with_clinician | discuss_now`.
- **`not_in_scope` is required.** The model must list things it
  couldn't see (allergies, kidney function, off-platform meds, etc.).
  Don't suppress it in the UI — it's the load-bearing honesty signal.
- **Snapshot the input.** `medication_reviews.input_snapshot` is a
  JSONB copy of what we sent: medication tasks (with notes), senior
  medical notes, tz/age context. Past reviews must be re-readable
  even after the underlying tasks change.
- **RLS:** select + insert are both gated on
  `is_caregiver_for(senior_id)`. Insert additionally requires
  `requested_by = current_profile_id()`. The server action runs with
  the caller's session — no service-role shortcut.
- **Anthropic client is lazy and optional.** `getAnthropic()` returns
  `null` if `ANTHROPIC_API_KEY` is missing. Code paths must handle
  the null (the dev environment may not have a key).

Model pin: Sonnet 4.6 (per the migration's commit message). Bumping
the model is a deliberate change, not a drive-by.

## Tasks: recurring vs. one-off

A task is **either** recurring (`weekdays` set, `due_date` null) **or**
one-off (`due_date` set, `weekdays` null). Enforced by
`tasks_recurrence_xor` and a matching RPC check. `weekdays` is a
`smallint[]` of 0..6 (Sun..Sat); "daily" is the full array.

`materialize_today(senior)` is the only path into `task_instances` —
it runs on the first read of `/today` for a given senior on a given
day, idempotent via `unique (task_id, date)`. It picks up:

- recurring tasks where today's DOW is in `weekdays`,
- one-off tasks where `due_date` equals the senior's local today,

…in the **senior's** timezone, not the caller's. A caregiver in
NYC viewing a senior in Tokyo gets Tokyo's today.

`task_instances` has no INSERT policy — this RPC is the only
materializer.

## Rewards

Two pools picked at completion time (see
`docs/data-model.md#rewards` for the full picker spec):

- **Curated** — static module `src/lib/rewards.ts`. Keys are
  `"curated:<key>"`.
- **Personal** — `personal_rewards` rows + Supabase Storage
  (`personal-rewards` bucket). Keys are `"personal:<uuid>"`.

Picker bias: 70/30 toward personal when both pools have fresh items;
empty personal degrades silently to 100% curated. Recent-key dedup
window is 4. Picker always returns something — never throws on
empty pools.

Photo URLs are signed by the same server action that runs the
picker. Clients never see the bucket key directly.

## Conventions

- **Server actions for all mutations.** No API routes for forms.
  `"use server"` at the top of the action file.
- **Server components by default.** Reach for `"use client"` only
  when there's interactive state.
- **Color is a name, not hex.** Constrained to the 8-name palette
  (`src/lib/task-palette.ts`) and the matching DB CHECK. Tailwind
  classes live in the palette module so hover/active states come
  for free.
- **Templates are code, not config.** `src/lib/task-templates.ts`
  ships with the app; adding a template is a PR.
- **Anthropic SDK types over hand-rolled equivalents.** Use
  `Anthropic.MessageParam` etc. directly.
- **SECURITY DEFINER + `set search_path = public`.** Every RPC
  uses both. Don't omit the search_path — it closes a real
  privilege-escalation vector.

## Migrations

Applied in filename order. Current set:

1. `..._init.sql` — profiles, links, tasks, instances, completions,
   personal rewards, base RLS, helper functions.
2. `..._task_taxonomy.sql` — categories + curated color palette
   constraint.
3. `..._caregiver_invites.sql` — secondary-caregiver invite flow
   (`claim_caregiver_invite`).
4. `..._one_off_tasks.sql` — relaxes `weekdays` to nullable, adds
   `due_date` + the XOR constraint, updates `materialize_today`.
5. `..._ai_medication_review.sql` — `medical_notes`,
   `accepted_ai_disclaimer_at`, `medication_reviews` table,
   `accept_ai_disclaimer()` RPC.
6. `..._senior_autonomy.sql` — autonomy enum, autonomy-edit guard
   trigger, `set_senior_autonomy()`, `undo_completion()`.
7. `..._senior_task_rpcs.sql` — `senior_create_task`,
   `senior_archive_task`.
8. `..._senior_task_update.sql` — senior task edit RPC.
9. `..._harden_trigger_search_path.sql` — pins `search_path = public`
   on the autonomy-edit trigger (closes Supabase advisor 0011).
10. `..._app_admins.sql` — `app_admins` table, `is_app_admin()`,
    and the `list_billing_groups()` admin RPC. See
    [Admin role](#admin-role).

Local: `supabase db reset` (drops, re-runs migrations + `seed.sql`).
Hosted: `supabase db push`. **Never** run `seed.sql` against
production — it inserts a fake `auth.users` row.

## Admin role

The `/admin` route is for operators (you), not seniors or
caregivers. It lives on its own axis: `app_admins` is an
`auth.users` mirror (just `user_id` + `created_at`), separate from
`profiles`. Admin access doesn't imply caregiver or senior status,
and doesn't require a `profiles` row at all.

Architecture choices and their reasoning:

- **Granting admin is out-of-band.** No in-app flow. The trust
  boundary is the database — to make someone an admin, run in the
  Supabase SQL editor:
  ```sql
  insert into app_admins (user_id)
    select id from auth.users where email = '<email>';
  ```
  This avoids an "admin invite" attack surface and keeps the role
  obviously privileged.
- **`app_admins` has RLS enabled with no policies.** Reads happen
  only via the `is_app_admin()` SECURITY DEFINER helper; writes
  happen via the SQL editor (postgres role bypasses RLS).
  PostgREST cannot reach the table.
- **Billing data via RPC, not raw selects.** `list_billing_groups()`
  returns one row per senior with at least one active caregiver
  link, plus engagement metrics (active task count, last
  completion, completions in the last 30 days) and the linked
  caregivers as a JSONB array. The shape mirrors the billable unit
  in the product brief: senior + their circle.
- **The `/admin` page renders the RPC output directly.** Admins
  read `auth.users.email` for both senior and caregiver via the
  RPC's SECURITY DEFINER cross-schema read. Don't route admin
  reads through PostgREST — RLS would have to grant cross-table
  visibility, which weakens the rest of the policy surface.

## Deferred (out of v1)

Tracked in `docs/data-model.md#deferred-out-of-v1`. Highlights:
time-of-day slots, time-of-day on appointments, auto-archive of
past one-offs, RRULE-shaped recurrence, photo proof of completion,
push notifications, caregiver-to-caregiver permissions
(`link_role` enum has the seat reserved).

## Working agreements

- Update this doc in the same commit as any meaningful product or
  architectural decision (autonomy tiers, AI med review constraints,
  trust-boundary changes, etc.). Treat it as code, not as memory.
- Schema specifics belong in `docs/data-model.md`. This doc is the
  index that points at it.
- If a section here describes a behavior the code no longer
  matches, that's a bug in the doc — fix it before fixing anything
  else.
