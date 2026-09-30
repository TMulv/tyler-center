-- Private visitor channels. Apply once in the dedicated Tyler.Center project.
begin;
create table public.reader_profiles (
  id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9_-]{2,23}$'),
  created_at timestamptz not null default now()
);
create table public.reader_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.reader_profiles(id) on delete cascade default auth.uid(),
  source_key text not null check (char_length(source_key) between 1 and 300),
  source_channel text not null default '' check (char_length(source_channel) <= 80),
  title text not null check (char_length(title) between 1 and 500),
  url text not null default '' check (url = '' or (url ~ '^https?://' and char_length(url) <= 4000)),
  is_read boolean not null default false,
  saved_at timestamptz not null default now(),
  unique (user_id, source_key)
);
create index reader_saves_order on public.reader_saves(user_id, saved_at, id);
alter table public.reader_profiles enable row level security;
alter table public.reader_saves enable row level security;
revoke all on public.reader_profiles, public.reader_saves from anon, authenticated;
grant select, insert on public.reader_profiles to authenticated;
grant select, insert, delete on public.reader_saves to authenticated;
grant update (is_read) on public.reader_saves to authenticated;
create policy profile_read_own on public.reader_profiles for select to authenticated using ((select auth.uid()) = id);
create policy profile_create_own on public.reader_profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy saves_read_own on public.reader_saves for select to authenticated using ((select auth.uid()) = user_id);
create policy saves_create_own on public.reader_saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy saves_update_own on public.reader_saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy saves_delete_own on public.reader_saves for delete to authenticated using ((select auth.uid()) = user_id);
commit;
