const test=require('node:test');
const assert=require('node:assert/strict');
const {create,savePayload,safeLink,validUsername}=require('../reader-account.js');
const config={enabled:true,url:'https://testproject.supabase.co',publishableKey:'sb_publishable_test'};
function fixture() {
  let authCallback,session=null,rows=[],profile=null,queries=[],fail=false;
  const client={auth:{
    onAuthStateChange(fn){authCallback=fn;},
    async getSession(){return {data:{session}};},
    async signInWithOtp(){return {error:null};},
    async verifyOtp(){session={user:{id:'alice'}};return {data:session};},
    async signOut(){session=null;authCallback('SIGNED_OUT',null);return {error:null};}
  },from(table){
    const q={table,filters:[],verb:'select'};
    const chain={select(){return chain;},eq(k,v){q.filters.push([k,v]);return chain;},order(){return chain;},range(start,end){q.range=[start,end];return chain;},maybeSingle(){q.single=true;return chain;},insert(data){q.verb='insert';q.data=data;return chain;},update(data){q.verb='update';q.data=data;return chain;},delete(){q.verb='delete';return chain;},then(resolve,reject){
      queries.push(q);
      if(fail)return Promise.resolve({error:{status:500}}).then(resolve,reject);
      if(q.verb==='insert'&&table==='reader_profiles')profile=q.data;
      if(q.verb==='insert'&&table==='reader_saves')rows.push({id:'save1',saved_at:'2026-09-30T00:00:00Z',is_read:false,...q.data});
      if(q.verb==='update')rows=rows.map(r=>r.id===q.filters.find(f=>f[0]==='id')[1]?{...r,...q.data}:r);
      if(q.verb==='delete')rows=rows.filter(r=>r.id!==q.filters.find(f=>f[0]==='id')[1]);
      return Promise.resolve({data:table==='reader_profiles'?profile:rows,error:null}).then(resolve,reject);
    }};
    return chain;
  }};
  return {client,queries,fail:()=>fail=true,changeSession(user){session=user?{user}:null;authCallback('SIGNED_IN',session);}};
}
test('saved records contain only title, link and public source identity',()=>{
  assert.deepEqual(savePayload({channel:'articles',id:'a',title:' Story ',url:'https://example.com/a',note:'private',body:'full body'}),{source_key:'articles:a',source_channel:'articles',title:'Story',url:'https://example.com/a'});
  assert.equal(safeLink('javascript:alert(1)'),'');assert.equal(safeLink('https://user:password@example.com'),'');
  assert.throws(()=>savePayload({id:'a',channel:'articles',title:''}));
  assert.ok(validUsername('sam-reader'));for(const name of ['a','Sam','<script>','first last','_name'])assert.equal(validUsername(name),false);
});
test('unconfigured accounts cannot create a fake session or save locally',async()=>{
  const account=create({enabled:false},()=>{throw new Error('must not initialize');});
  assert.equal(account.enabled,false);
  await assert.rejects(account.sendCode('a@example.com'),/not ready/);
  await assert.rejects(account.save({}),/not ready/);
  assert.equal(account.state().user,null);
});
test('verified email creates an owner-scoped private channel and handles saved item actions',async()=>{
  const f=fixture(),account=create(config,()=>f.client);await account.initialize();
  await assert.rejects(account.save({}),/Sign in/);
  await account.verifyCode('alice@example.com','123456');
  await account.chooseUsername('alice');
  await account.save({id:'a',channel:'articles',title:'Story',url:'https://example.com/a'});
  assert.equal(account.state().saves.length,1);
  const insert=f.queries.find(q=>q.table==='reader_saves'&&q.verb==='insert');
  assert.equal(insert.data.user_id,'alice');
  await account.markRead('save1',true);assert.equal(account.state().saves[0].is_read,true);
  await account.remove('save1');assert.equal(account.state().saves.length,0);
  for(const q of f.queries.filter(q=>q.table==='reader_saves'&&q.verb!=='insert'))assert.ok(q.filters.some(([k,v])=>k==='user_id'&&v==='alice'));
  await account.signOut();assert.deepEqual(account.state().saves,[]);assert.equal(account.state().profile,null);
});
test('switching accounts immediately clears prior private data and errors are explicit',async()=>{
  const f=fixture(),account=create(config,()=>f.client);await account.initialize();
  await account.verifyCode('alice@example.com','123456');await account.chooseUsername('alice');
  await account.save({id:'a',channel:'writing',title:'Story',url:''});
  f.fail();f.changeSession({id:'bob'});
  assert.equal(account.state().profile,null);assert.deepEqual(account.state().saves,[]);
  await account.refresh();assert.match(account.state().error,/could not load/);
});
test('a failed save never reports success',async()=>{
  const f=fixture(),account=create(config,()=>f.client);await account.initialize();
  await account.verifyCode('alice@example.com','123456');await account.chooseUsername('alice');f.fail();
  await assert.rejects(account.save({id:'a',channel:'articles',title:'Story',url:'https://example.com'}),/try again/);
});

test('comments require activation, verified sign-in, and use the authenticated author only',async()=>{
 const f=fixture(),a=create({...config,commentsEnabled:true},()=>f.client);await a.initialize();
 await assert.rejects(a.postComment('entry','post','Hello'),/Sign in/);
 await a.verifyCode('alice@example.com','123456');await a.chooseUsername('tyler');
 await a.postComment('entry','post',' Hello ');
 const q=f.queries.find(q=>q.table==='post_comments');
 assert.deepEqual(q.data,{author_id:'alice',post_type:'entry',post_id:'post',body:'Hello'});
 await assert.rejects(a.postComment('entry','post',' '.repeat(10)),/1–600/);
 await assert.rejects(a.postComment('entry','post','x'.repeat(601)),/1–600/);
 const off=create(config,()=>f.client);assert.equal(off.commentsEnabled,false);
 await assert.rejects(off.postComment('entry','post','Hello'),/not ready/);
 f.client.rpc=async(name,args)=>{assert.equal(name,'read_post_comments');assert.deepEqual(args,{p_type:'entry',p_id:'post'});return {data:[{username:'owner',is_owner:true}]};};
 assert.equal((await a.listComments('entry','post'))[0].is_owner,true);
});
