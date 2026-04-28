-- Task taxonomy: category enum, optional color (curated palette), and
-- caregiver-only notes (clinical name / dose / etc — not shown to the
-- senior). Mirrors the slice 5 design in docs/data-model.md.

create type task_category as enum
  ('hygiene', 'medication', 'appointment', 'checkin', 'other');

alter table tasks
  add column category task_category not null default 'other',
  add column color    text,
  add column notes    text;

-- Constrain color to the curated palette. Adding a new color is then
-- a one-line migration that rewrites the constraint.
alter table tasks
  add constraint tasks_color_in_palette check (
    color is null or color in (
      'pink', 'red', 'orange', 'yellow',
      'green', 'blue', 'purple', 'brown'
    )
  );
