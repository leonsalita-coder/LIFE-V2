-- Vitality Base — Train progress-photo storage (optional)
--
-- Run this ONCE in your own Supabase project (Dashboard → SQL Editor → paste →
-- Run). Creates a Storage bucket for Train's progress photos. Personal,
-- single-user deployment, so the policy is open — reached only via your own
-- anon key. Photo bytes live here; only the resulting URL + a short AI note
-- are stored in your tile data (supabase/sync.sql's table).

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', true)
on conflict (id) do nothing;

drop policy if exists "progress-photos open" on storage.objects;
create policy "progress-photos open" on storage.objects
  for all using (bucket_id = 'progress-photos') with check (bucket_id = 'progress-photos');
