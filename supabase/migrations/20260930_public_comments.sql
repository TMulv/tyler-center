begin;
-- Only an administrator may assign Tyler's authenticated UUID here.
create table public.site_owners (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.site_owners enable row level security;
revoke all on public.site_owners from anon, authenticated;

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.reader_profiles(id) on delete cascade default auth.uid(),
  post_type text not null check (post_type in ('project','entry')),
  post_id text not null check (char_length(post_id) between 1 and 200),
  body text not null check (char_length(trim(body)) between 1 and 600),
  created_at timestamptz not null default now()
);
create index post_comments_thread on public.post_comments(post_type,post_id,created_at,id);
alter table public.post_comments enable row level security;
revoke all on public.post_comments from anon, authenticated;
grant insert(author_id,post_type,post_id,body) on public.post_comments to authenticated;
create policy comment_as_self on public.post_comments for insert to authenticated
  with check (author_id = (select auth.uid()));

create function public.read_post_comments(p_type text, p_id text)
returns table(id uuid, username text, is_owner boolean, body text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, p.username, exists(select 1 from public.site_owners o where o.user_id=c.author_id), c.body, c.created_at
  from public.post_comments c join public.reader_profiles p on p.id=c.author_id
  where c.post_type=p_type and c.post_id=p_id
  order by c.created_at desc, c.id desc limit 100
$$;
revoke all on function public.read_post_comments(text,text) from public;
grant execute on function public.read_post_comments(text,text) to anon, authenticated;

-- Serialize each user's submissions so simultaneous requests cannot evade the limit.
create function public.limit_post_comments() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.author_id::text,0));
  if (select count(*) from public.post_comments where author_id=new.author_id and created_at>now()-interval '1 hour')>=20 then
    raise exception 'Please wait before posting more comments.' using errcode='P0001';
  end if;
  return new;
end $$;
revoke all on function public.limit_post_comments() from public;
create trigger limit_post_comments before insert on public.post_comments for each row execute function public.limit_post_comments();
commit;
