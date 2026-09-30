-- Run after the migration. Test records and all changes roll back.
begin;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.reader_profiles(username) values ('test-reader-alice');
insert into public.reader_saves(source_key,title,url) values ('test:alice','Alice private title','https://example.com/a');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
insert into public.reader_profiles(username) values ('test-reader-bob');
insert into public.reader_saves(source_key,title,url) values ('test:bob','Bob private title','https://example.com/b');
do $$
declare affected integer;
begin
  assert (select count(*) from public.reader_profiles)=1, 'Other profiles exposed';
  assert (select count(*) from public.reader_saves)=1, 'Other saves exposed';
  assert not exists(select 1 from public.reader_saves where source_key='test:alice'), 'Alice visible to Bob';
  update public.reader_saves set is_read=true where source_key='test:alice';
  get diagnostics affected=row_count;
  assert affected=0, 'Cross-account update allowed';
  delete from public.reader_saves where source_key='test:alice';
  get diagnostics affected=row_count;
  assert affected=0, 'Cross-account delete allowed';
  begin
    insert into public.reader_saves(user_id,source_key,title) values ('11111111-1111-4111-8111-111111111111','test:forged','Forged owner');
    raise exception 'Cross-account insert allowed';
  exception when insufficient_privilege then null;
  end;
  update public.reader_saves set is_read=true where source_key='test:bob';
  assert (select is_read from public.reader_saves where source_key='test:bob'), 'Owner update failed';
end $$;
set local role anon;
do $$ begin
  begin perform * from public.reader_saves; raise exception 'Anonymous saves access allowed'; exception when insufficient_privilege then null; end;
  begin perform * from public.reader_profiles; raise exception 'Anonymous profile access allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: owner access, cross-account denial, and anonymous denial' as privacy_result;
