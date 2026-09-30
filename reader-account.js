/* Auth and owner-only saves use Supabase; no private content is written to GitHub. */
(function(root) {
  'use strict';
  function safeLink(value) {
    try {
      const u = new URL(value);
      if (!['http:','https:'].includes(u.protocol) || u.username || u.password) return '';
      return u.href;
    } catch { return ''; }
  }
  function savePayload(record) {
    if (!record || !record.id || !record.channel || !record.title?.trim()) throw new Error('This item cannot be saved.');
    return {source_key:`${record.channel}:${record.id}`,source_channel:record.channel,
      title:record.title.trim().slice(0,500),url:safeLink(record.url)};
  }
  function validUsername(value) { return /^[a-z0-9][a-z0-9_-]{2,23}$/.test(value); }
  function create(config, createClient) {
    const enabled = config?.enabled === true && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.url || '') && /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey || '');
    const client = enabled && createClient ? createClient(config.url, config.publishableKey, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'tyler-center-reader-session'}
    }) : null;
    let state={user:null,profile:null,saves:[],loading:false,error:''};
    let generation=0, authRefreshTimer, listeners=new Set();
    function emit() { for (const fn of listeners) fn({...state}); }
    function reset(user=null) { generation++; state={user,profile:null,saves:[],loading:!!user,error:''}; emit(); }
    async function refresh() {
      if (!client || !state.user) return;
      const userId=state.user.id, current=++generation;
      state={...state,loading:true,error:''}; emit();
      try {
        const profile=await client.from('reader_profiles').select('id,username').eq('id',userId).maybeSingle();
        if (profile.error) throw profile.error;
        const saves=[];
        if (profile.data) {
          for (let offset=0;;offset+=500) {
            const page=await client.from('reader_saves').select('id,source_key,source_channel,title,url,is_read,saved_at').eq('user_id',userId).order('saved_at').order('id').range(offset,offset+499);
            if (page.error) throw page.error;
            saves.push(...page.data);
            if (page.data.length<500) break;
          }
        }
        if (generation!==current || state.user?.id!==userId) return;
        state={...state,profile:profile.data,saves,loading:false,error:''}; emit();
      } catch {
        if (generation!==current) return;
        state={...state,loading:false,error:'Your private channel could not load. Please try again.'}; emit();
      }
    }
    function requireClient() { if (!client) throw new Error('Accounts are not ready yet. Please check back soon.'); return client; }
    function requireUser() { requireClient(); if (!state.user || !state.profile) throw new Error('Sign in and choose your username first.'); return state.user.id; }
    function friendly(error) {
      if (error?.status===429 || error?.code==='over_email_send_rate_limit') return new Error('Too many requests. Please wait a minute and try again.');
      return new Error('That didn’t work. Please try again.');
    }
    return {
      enabled:!!client, state:()=>({...state}), subscribe(fn) {listeners.add(fn);return()=>listeners.delete(fn);},
      async initialize() {
        if (!client) return;
        // Defer data calls outside Supabase’s synchronous auth callback.
        client.auth.onAuthStateChange((event,session)=>{
          const id=session?.user?.id || null;
          if (state.user?.id===id) return;
          reset(session?.user || null);
          clearTimeout(authRefreshTimer);
          if (session?.user) authRefreshTimer=setTimeout(()=>refresh(),0);
        });
        const {data,error}=await client.auth.getSession();
        if (error) {reset();return;}
        if (data.session && state.user?.id!==data.session.user.id) {reset(data.session.user);await refresh();}
      },
      refresh,
      async sendCode(email) {
        const {error}=await requireClient().auth.signInWithOtp({email,options:{shouldCreateUser:true}});
        if (error) throw friendly(error);
      },
      async verifyCode(email,token) {
        const {data,error}=await requireClient().auth.verifyOtp({email,token,type:'email'});
        if (error || !data.user) throw new Error('That code is invalid or expired. Try again or request a new one.');
        clearTimeout(authRefreshTimer); reset(data.user); await refresh();
      },
      async chooseUsername(username) {
        requireClient();
        if (!state.user) throw new Error('Please sign in first.');
        if (!validUsername(username)) throw new Error('Use 3–24 lowercase letters, numbers, hyphens or underscores. Start with a letter or number.');
        const {error}=await client.from('reader_profiles').insert({id:state.user.id,username});
        if (error) throw new Error(error.code==='23505' ? 'That username is taken. Try another.' : 'Could not create your channel. Please try again.');
        await refresh();
      },
      async save(record) {
        const user_id=requireUser(), payload=savePayload(record);
        const {error}=await client.from('reader_saves').insert({...payload,user_id});
        if (error && error.code!=='23505') throw friendly(error);
        await refresh();
      },
      async addLink(title,url) {
        const user_id=requireUser(), link=safeLink(url);
        if (!link || !title.trim() || title.trim().length>500) throw new Error('Add a title and a valid http or https link.');
        const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(link));
        const key=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
        const {error}=await client.from('reader_saves').insert({user_id,source_key:'link:'+key,source_channel:'',title:title.trim(),url:link});
        if (error && error.code!=='23505') throw friendly(error);
        await refresh();
      },
      async markRead(id,value) {
        const user_id=requireUser();
        const {error}=await client.from('reader_saves').update({is_read:!!value}).eq('id',id).eq('user_id',user_id);
        if (error) throw friendly(error);
        await refresh();
      },
      async remove(id) {
        const user_id=requireUser();
        const {error}=await client.from('reader_saves').delete().eq('id',id).eq('user_id',user_id);
        if (error) throw friendly(error);
        await refresh();
      },
      async signOut() {
        const {error}=await requireClient().auth.signOut({scope:'local'});
        if (error) throw new Error('Could not sign out. Please try again.');
        reset();
      }
    };
  }
  const api={create,safeLink,savePayload,validUsername};
  if (typeof module!=='undefined') module.exports=api; else root.ReaderAccount=api;
})(globalThis);
