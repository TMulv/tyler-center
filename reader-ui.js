(function(root) {
  if(document.documentElement?.classList.contains("project-preview-mode"))return;
  'use strict';
  const account=ReaderAccount.create(root.TYLER_READER_CONFIG, root.supabase?.createClient);
  let current=account.state(), pendingSave=null, email='', busy=false, refreshAt=0;
  let savedFilter='unread';
  const publicRecord=(channel,id)=>channel==='websites'?projects.find(r=>r.id===id):allEntries().find(r=>r.channel===channel && r.id===id);
  function saveButton(record) {
    if (!account.enabled) return '';
    const key=`${record.channel}:${record.id}`;
    const saved=current.saves.some(s=>s.source_key===key);
    return `<button class="save-for-later" data-reader-action="save" data-save-channel="${esc(record.channel)}" data-save-id="${esc(record.id)}" ${saved?'disabled':''}>${saved?'✓ Saved to my channel':'＋ Save for later'}</button>`;
  }
  function renderNav() {
    const host=$('#readerNav'); if (!host) return;
    host.innerHTML=current.user && current.profile
      ? `<div class="side-label side-label-small">JUST FOR YOU</div><button class="channel-link ${activeChannel==='private'?'active':''}" data-channel="private" ${activeChannel==='private'?'aria-current="page"':''}><span class="hash">#</span><span>${esc(current.profile.username)}</span><span class="channel-count">${current.saves.length}</span><span class="private-lock" aria-label="Private">▣</span></button><button class="reader-account-control" data-reader-action="account">Your account</button>`
      : `<div class="side-label side-label-small">JUST FOR YOU</div><button class="channel-link ${activeChannel==='private'?'active':''}" data-channel="private" ${activeChannel==='private'?'aria-current="page"':''}><span class="hash">#</span><span>your-username</span></button><p class="reader-nav-note">Make a private place to save things.</p>`;
    if (activeChannel==='private' && current.profile) {
      $('#headerTitle').textContent=current.profile.username;
      $('#headerDescription').textContent='Your private saved channel · only you can see it';
    }
  }
  function updateSaveButtons() {
    document.querySelectorAll('[data-reader-action="save"]').forEach(button=>{
      const saved=current.saves.some(s=>s.source_key===`${button.dataset.saveChannel}:${button.dataset.saveId}`);
      button.disabled=saved;button.textContent=saved?'✓ Saved to my channel':'＋ Save for later';
    });
  }
  function modal(title,body) {
    $('#readerModal').innerHTML=`<div class="modal-overlay" data-reader-dismiss><section class="modal reader-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-top"><span class="eyebrow">YOUR CORNER OF TYLER.CENTER</span><button class="close-button" data-reader-action="close" aria-label="Close account window">×</button></div><div class="modal-body"><h2>${esc(title)}</h2>${body}<p id="readerError" class="form-error" role="alert"></p></div></section></div>`;
    ($('#readerModal').querySelector('input') || $('#readerModal').querySelector('button'))?.focus();
  }
  function close() {$('#readerModal').innerHTML='';}
  function showAccount() {
    if (!account.enabled) return modal('Accounts are on the way.','<p>Email-code sign-in and private saved channels are being connected. Please check back soon.</p>');
    if (!current.user) return modal('A channel of your own.',`<p>Save anything from Tyler’s channels. Keep it in a private channel named after you.</p><form id="readerEmailForm"><label>Email<input name="email" type="email" autocomplete="email" required maxlength="254" value="${esc(email)}"></label><button class="primary-button" type="submit">Email me a sign-in code</button></form><p class="reader-fine-print">New here? This creates your account. No password. Your email stays private.</p>`);
    if (current.loading) return modal('Loading your account…','<p>Please wait a moment.</p>');
    if (current.error) return modal('Let’s try that again.',`<p>${esc(current.error)}</p><button class="secondary-button" data-reader-action="retry">Reload my account</button><button class="secondary-button" data-reader-action="signout">Sign out</button>`);
    if (!current.profile) return modal('Name your channel.',`<p>Choose a username. Your channel is visible only to your signed-in account.</p><form id="readerUsernameForm"><label>Username<input name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" pattern="[a-z0-9][a-z0-9_-]{2,23}" minlength="3" maxlength="24" required placeholder="your-name"></label><p class="reader-fine-print">3–24 lowercase letters, numbers, hyphens or underscores.</p><button class="primary-button" type="submit">Create my private channel</button></form>`);
    modal(`#${current.profile.username}`,`<p>Your saves are private to your account and follow you when you sign in on another device.</p><div class="reader-account-actions"><button class="primary-button" data-reader-action="open">Open my channel</button><button class="secondary-button" data-reader-action="signout">Sign out on this device</button></div>`);
  }
  function showCode() {
    modal('Check your email.',`<p>Enter the code sent to <strong>${esc(email)}</strong>.</p><form id="readerCodeForm"><label>Sign-in code<input name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" minlength="6" maxlength="10" required></label><button class="primary-button" type="submit">Sign in</button></form><div class="reader-account-actions"><button class="secondary-button" data-reader-action="resend">Send a new code</button><button class="secondary-button" data-reader-action="change-email">Use another email</button></div>`);
  }
  async function finishSignIn() {
    if (current.error || !current.profile) {showAccount();return;}
    if (pendingSave) {const record=pendingSave;pendingSave=null;await account.save(record);toast('Saved to your private channel.');}
    close();navigate('private');
  }
  async function run(operation) {
    if (busy) return;
    busy=true;
    const error=$('#readerError');if(error)error.textContent='';
    const buttons=[...document.querySelectorAll('#readerModal button')];buttons.forEach(b=>b.disabled=true);
    try {await operation();} catch(e) {if ($('#readerError'))$('#readerError').textContent=e.message;else toast(e.message);}
    finally {busy=false;buttons.forEach(b=>b.disabled=false);}
  }
  function channelGuide() {
    return `<section class="reader-guide"><h2>A channel of your own.</h2><p>Keep the good stuff. Come back to it later.</p><ol><li><strong>Create your account.</strong> Enter your email, use the code we send, then choose a username. No password.</li><li><strong>Save something.</strong> Hit “Save for later” under a post in any of my channels.</li><li><strong>Find it in #your-username.</strong> Your saved channel is private. Add your own links and mark things read as you go.</li><li><strong>Join the conversation.</strong> Open a post’s thread and leave a comment under your username. Comments are public; your saved items stay private.</li></ol><p>${VerifiedAuthor.badge()} A check next to Tyler means it’s me. Choosing the same name won’t give anyone this badge.</p>${!account.enabled?'<p class="reader-setup-note" role="status">Accounts and comments are on the way. Sign-in is still being connected.</p>':!current.profile?'<button class="primary-button" data-reader-action="account">'+(current.user?'Choose my username':'Create account / sign in')+'</button>':''}${account.enabled&&!account.commentsEnabled?'<p class="reader-setup-note">Public comments are still being connected.</p>':''}</section>`;
  }
  function renderChannel() {
    if (!current.user) {$('#content').innerHTML=channelGuide();return;}
    if (current.loading) {$('#content').innerHTML='<div class="empty-channel" role="status">Loading your private channel…</div>';return;}
    if (current.error) {$('#content').innerHTML=`<div class="empty-channel"><p role="alert">${esc(current.error)}</p><button class="primary-button" data-reader-action="retry">Try again</button></div>`;return;}
    if (!current.profile) {$('#content').innerHTML=channelGuide();return;}
    const list=current.saves.filter(s=>savedFilter==='all'||(savedFilter==='read'?s.is_read:!s.is_read));
    $('#content').innerHTML=`<div class="feed private-feed"><div class="channel-intro"><div class="channel-symbol">▣</div><h1>#${esc(current.profile.username)}</h1><p>Saved for you. Visible only to your account.</p></div><details class="reader-guide-details" ${current.saves.length?'':'open'}><summary>How my channel works</summary>${channelGuide()}</details><div class="private-toolbar"><label>Show <select aria-label="Filter my saved items" id="privateFilter"><option value="unread" ${savedFilter==='unread'?'selected':''}>To read</option><option value="read" ${savedFilter==='read'?'selected':''}>Read</option><option value="all" ${savedFilter==='all'?'selected':''}>Everything</option></select></label><button class="secondary-button" data-reader-action="add-link">＋ Add a link</button><button class="secondary-button" data-reader-action="retry">Refresh</button></div><p class="reader-fine-print">${list.length} of ${current.saves.length} saved items</p>${list.map(item=>{
      const url=ReaderAccount.safeLink(item.url);
      const source=channelMeta(item.source_channel)?.title || 'your link';
      const record=publicRecord(item.source_channel,item.source_key.slice(item.source_channel.length+1));
      return `<article class="message private-message"><div class="message-body"><div class="message-meta"><strong>${esc(current.profile.username)}</strong><span class="saved-label">Saved</span>${messageTimestamp(item.saved_at)}<span class="reading-status">${item.is_read?'Read':'To read'}</span></div><p class="saved-source">From ${item.source_channel?'#':''}${esc(source)}</p>${url?`<a class="preview-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${linkPreview({title:item.title,url,kind:'Saved link'})}</a>`:`<div class="saved-title">${esc(item.title)}</div>${record?`<button class="secondary-button" data-reader-action="source" data-save-id="${esc(item.id)}">Open original post</button>`:'<p>The original post is no longer available.</p>'}`}<div class="saved-actions"><button class="secondary-button" data-reader-action="toggle-read" data-save-id="${esc(item.id)}">${item.is_read?'Mark unread':'Mark as read'}</button><button class="secondary-button" data-reader-action="remove" data-save-id="${esc(item.id)}">Remove from my channel</button></div></div></article>`;
    }).join('')||'<div class="empty-channel">Nothing here yet. Use “Save for later” on a post, or add your own link.</div>'}</div>`;
  }
  account.subscribe(state=>{
    const previous=current.user?.id, wasLoading=current.loading;current=state;
    if (wasLoading && !current.loading && $('#readerModal [aria-label="Loading your account…"]')) showAccount();
    if (previous && previous!==current.user?.id) {pendingSave=null;closeModal();closeSearch();close();}
    renderNav();updateSaveButtons();
    if (activeChannel==='private') renderChannel();
  });
  document.addEventListener('submit',event=>{
    const form=event.target;if(!form.closest('#readerModal'))return;
    event.preventDefault();
    run(async()=>{
      if(form.id==='readerEmailForm'){email=form.elements.email.value.trim();await account.sendCode(email);showCode();}
      if(form.id==='readerCodeForm'){await account.verifyCode(email,form.elements.code.value.trim());await finishSignIn();}
      if(form.id==='readerUsernameForm'){await account.chooseUsername(form.elements.username.value.trim());await finishSignIn();}
      if(form.id==='readerLinkForm'){await account.addLink(form.elements.title.value,form.elements.url.value);close();toast('Saved to your private channel.');}
    });
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-reader-action]');
    if(!button){if(event.target.matches('[data-reader-dismiss]')&&!busy)close();return;}
    const action=button.dataset.readerAction;
    if(action==='close'){pendingSave=null;close();return;}
    if(action==='account'){showAccount();return;}
    if(action==='guide'){closeModal();close();navigate('private');const guide=$('.reader-guide-details');if(guide)guide.open=true;return;}
    if(action==='open'){close();navigate('private');return;}
    if(action==='change-email'){showAccount();return;}
    if(action==='add-link'){modal('Save a link.',`<form id="readerLinkForm"><label>Title<input name="title" maxlength="500" required></label><label>Link<input name="url" type="url" placeholder="https://" required maxlength="4000"></label><button class="primary-button" type="submit">Save to my channel</button></form>`);return;}
    run(async()=>{
      if(action==='resend'){await account.sendCode(email);toast('A new code is on its way.');}
      if(action==='retry'){await account.refresh();if($('#readerModal').children.length)showAccount();}
      if(action==='signout'){await account.signOut();close();navigate('home');toast('Signed out on this device.');}
      if(action==='save'){
        const record=publicRecord(button.dataset.saveChannel,button.dataset.saveId);if(!record)return;
        const payload={...record,channel:button.dataset.saveChannel};
        if(!current.profile){pendingSave=payload;showAccount();return;}
        await account.save(payload);toast('Saved to your private channel.');
      }
      if(action==='toggle-read'){const item=current.saves.find(s=>s.id===button.dataset.saveId);if(item)await account.markRead(item.id,!item.is_read);}
      if(action==='remove'){await account.remove(button.dataset.saveId);toast('Removed from your private channel.');}
      if(action==='source'){
        const item=current.saves.find(s=>s.id===button.dataset.saveId);if(!item)return;
        const record=publicRecord(item.source_channel,item.source_key.slice(item.source_channel.length+1));
        if(record)(item.source_channel==='websites'?showProject:showEntry)(record);
      }
    });
  });
  document.addEventListener('change',event=>{if(event.target.id==='privateFilter'){savedFilter=event.target.value;renderChannel();}});
  document.addEventListener('keydown',event=>{
    if(!$('#readerModal').children.length)return;
    if(event.key==='Escape'&&!busy){pendingSave=null;close();}
    if(event.key==='Tab'){
      const fields=[...$('#readerModal').querySelectorAll('button:not(:disabled),input,select,a[href]')];
      const first=fields[0],last=fields.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  const refreshIfVisible=()=>{if(current.user&&!document.hidden&&Date.now()-refreshAt>60000){refreshAt=Date.now();account.refresh();}};
  document.addEventListener('visibilitychange',refreshIfVisible);
  setInterval(refreshIfVisible,60000);
  root.ReaderUI={saveButton,renderNav,renderChannel,account};
  renderNav();account.initialize();
})(globalThis);
