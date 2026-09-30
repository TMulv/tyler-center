begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.site_owners values ('11111111-1111-4111-8111-111111111111');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.reader_profiles(username) values ('real-owner');
insert into public.reader_saves(source_key,title) values ('private:owner','Private title');
insert into public.post_comments(post_type,post_id,body) values ('entry','example','Owner reply');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
insert into public.reader_profiles(username) values ('tyler');
insert into public.post_comments(post_type,post_id,body) values ('entry','example','Same name, not the owner');
do $$ begin
 assert (select is_owner from public.read_post_comments('entry','example') where username='real-owner'), 'Owner badge missing';
 assert not (select is_owner from public.read_post_comments('entry','example') where username='tyler'), 'Name impersonation allowed';
 assert (select count(*) from public.read_post_comments('entry','unrelated'))=0, 'Thread filtering failed';
 assert (select count(*) from public.reader_saves)=0, 'Private saves leaked';
 begin insert into public.site_owners values (auth.uid());raise exception 'Self verification allowed';exception when insufficient_privilege then null;end;
 begin insert into public.post_comments(author_id,post_type,post_id,body) values ('11111111-1111-4111-8111-111111111111','entry','example','Forged');raise exception 'Forged author allowed';exception when insufficient_privilege then null;end;
 begin insert into public.post_comments(post_type,post_id,body,created_at) values ('entry','example','Forged time','2000-01-01');raise exception 'Forged time allowed';exception when insufficient_privilege then null;end;
 begin insert into public.post_comments(post_type,post_id,body) values ('entry','example',repeat('a',601));raise exception 'Too long allowed';exception when check_violation then null;end;
end $$;
insert into public.post_comments(post_type,post_id,body) select 'entry','example','Reply '||n from generate_series(1,19) n;
do $$ declare limited boolean:=false;begin
 begin insert into public.post_comments(post_type,post_id,body) values ('entry','example','Over limit');exception when raise_exception then limited:=true;end;
 assert limited, 'Rate limit failed';
end $$;
set local role anon;
do $$ begin
 assert (select count(*) from public.read_post_comments('entry','example'))=21,'Public comment reading failed';
 begin perform * from public.post_comments;raise exception 'Raw author IDs exposed';exception when insufficient_privilege then null;end;
 begin perform * from public.site_owners;raise exception 'Owner IDs exposed';exception when insufficient_privilege then null;end;
 begin perform * from public.reader_profiles;raise exception 'Private profiles exposed';exception when insufficient_privilege then null;end;
 begin insert into public.post_comments(post_type,post_id,body) values ('entry','example','Anonymous');raise exception 'Anonymous posting allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: public reading, authenticated authorship, owner verification, private data isolation, rate limit' as result;
