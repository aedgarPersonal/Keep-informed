# Keep Informed

A PWA that gives seniors a simple daily checklist (meds, hygiene, etc.)
and gives their caregivers progress visibility plus task management.

## Stack

- Next.js (App Router) as a PWA
- Supabase: Postgres + auth + RLS + Storage
- Tailwind v4

## Getting started

```bash
# 1. Install Node deps
npm install

# 2. Set up env
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Apply DB schema (requires Supabase CLI)
supabase db reset      # local: drops, re-runs migrations + seed.sql
# OR for a hosted project:
# supabase db push

# 4. Run the dev server
npm run dev
```

Open <http://localhost:3000>.

## Repo layout

| Path | Purpose |
| --- | --- |
| `src/app/` | Next App Router routes (pages, layouts, route handlers). |
| `src/lib/supabase/` | Browser + server Supabase client factories. |
| `src/lib/rewards.ts` | Curated reward pool + picker. |
| `supabase/migrations/` | SQL migrations, applied in filename order. |
| `supabase/seed.sql` | Local-dev seed (creates one caregiver + senior). |
| `docs/data-model.md` | Schema, lifecycles, RLS strategy, open questions. |
| `public/sw.js` | Minimal PWA service worker. |
| `public/icon*.svg` | App icons used by `app/manifest.ts`. |
