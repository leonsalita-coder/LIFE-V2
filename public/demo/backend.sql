-- Ep 2 lays the one table everything rides on
create table if not exists workout_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid(),
  lift       text not null,
  weight     numeric not null default 0,   -- kg
  sets       jsonb   not null default '[]', -- [{weight,reps,done}]
  hidden     boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table workout_log enable row level security;
create policy "own" on workout_log using (auth.uid() = user_id);

-- Ep 3 adds ONE column (no new table)
alter table workout_log add column if not exists lib_key text;
-- Ep 4 adds ONE more
alter table workout_log add column if not exists rest_sec int not null default 150;
