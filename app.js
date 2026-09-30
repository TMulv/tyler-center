// Add Tyler's real contact links here when they are available.
const CONTACT = { email: '', instagram: '', linkedin: 'https://www.linkedin.com/in/tylermulvey/' };

const CHANNELS = [
  {id:'websites', title:'websites', description:"Websites I've built"},
  {id:'articles', title:'articles', description:'Articles worth sharing'},
  {id:'watch', title:'watch', description:'Videos I recommend watching'},
  {id:'writing', title:'writing', description:'Blogs and published writing'},
  {id:'photography', title:'photography', description:'Photos I have taken'}
];
const STARTER_PROJECTS = [{
  id:'tylers-shelf', title:"Tyler.Center", category:'Personal website · prototype',
  description:'A home for the links, books, films, and ideas worth sharing. The original Finder-style concept that started this site.',
  url:'', image:'assets/shelf-preview.svg', builtIn:true, created:'2026-09-29'
}];
const STARTER_ENTRIES = [
  {id:'great-work', channel:'articles', title:'How to Do Great Work', kind:'Essay', domain:'paulgraham.com', url:'https://paulgraham.com/greatwork.html', description:'A long essay on picking a field, following curiosity, and making things that matter.', note:'A reminder to keep following the interesting questions.', image:''},
  {id:'tail-end', channel:'articles', title:'The Tail End', kind:'Article', domain:'waitbutwhy.com', url:'https://waitbutwhy.com/2015/12/the-tail-end.html', description:'Your life in weeks, and the time you have with the people you love.', note:'The one that makes you call home.', image:''},
  {id:'garden', channel:'articles', title:'A Brief History of the Digital Garden', kind:'Article', domain:'maggieappleton.com', url:'https://maggieappleton.com/garden-history', description:'Why personal sites that grow slowly are so compelling.', note:'A fitting idea for a place like this.', image:''},
  {id:'viral-video', channel:'watch', title:'Never Gonna Give You Up', kind:'Video · demo', domain:'YouTube', url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ', description:'A demo video from the original site. Replace it with your own recommendations.', note:'A small piece of internet history.', image:''},
  {id:'why-site', channel:'writing', title:'Why this site exists', kind:'Sample post', domain:"Tyler.Center", url:'', description:'A shelf for the stuff I keep texting people about.', note:'A sample introduction. Replace this with your own blog post or a Betting Antelope article.', image:''}
];
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const safeUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
const safeImage = value => ((/^assets\/[A-Za-z0-9._/-]+\.(png|jpe?g|webp|gif|svg)$/i.test(value || '') && !value.includes('..')) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value || '')) ? value : '';
const contactEmail = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(CONTACT.email.trim()) ? CONTACT.email.trim() : '';
const instagramUrl = () => safeUrl(CONTACT.instagram);
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const channelMeta = id => CHANNELS.find(channel => channel.id === id);
const commentCount = (type,id) => comments.filter(comment => comment.type === type && comment.entryId === id).length;
const domainOf = value => { const url=safeUrl(value); return url ? new URL(url).hostname.replace(/^www\./,'') : ''; };
let projects = [...STARTER_PROJECTS], entries = [...STARTER_ENTRIES], comments = [];
let database = null, activeChannel = 'home';
let toastTimer, lastSurpriseId = null, frontLayer = 4;
let readState = fallbackRead('read-state-v1', {});
let readingPositions = fallbackRead('reading-positions-v1', {});
if (!readingPositions || typeof readingPositions !== 'object' || Array.isArray(readingPositions)) readingPositions = {};
let sessionCheckpoint = null, sessionFirstUnread = null, readingTimer;
const APP_VIEWS = {spider:{title:'spider-solitaire',description:'A little break'}};

const channelRecords = channel => channel === 'websites' ? projects : entries.filter(entry => entry.channel === channel);
function markVisibleMessages() {
  if (!channelMeta(activeChannel) || document.hidden || $('#appWindow').classList.contains('hidden-window')) return;
  const viewport = $('#contentScroll').getBoundingClientRect();
  const ids = [...document.querySelectorAll('[data-message-id]')].filter(element => {
    const rect = element.getBoundingClientRect();
    return Math.min(rect.bottom,viewport.bottom)-Math.max(rect.top,viewport.top) >= Math.min(80,rect.height*.25);
  }).map(element=>element.dataset.messageId);
  if (!ids.length) return;
  const visible = channelRecords(activeChannel).filter(record=>ids.includes(String(record.id)));
  readState = ChannelReadState.markSeen(visible,readState,activeChannel);
  readingPositions = {...readingPositions,[activeChannel]:ids.at(-1)};
  try {fallbackWrite('read-state-v1',readState);fallbackWrite('reading-positions-v1',readingPositions);} catch {}
  renderNav();
}
function positionChannelAtBottom() {
  const channel = activeChannel;
  requestAnimationFrame(()=>{
    if (activeChannel!==channel || !channelMeta(channel)) return;
    $('#contentScroll').scrollTop=$('#contentScroll').scrollHeight;
    clearTimeout(readingTimer);readingTimer=setTimeout(markVisibleMessages,350);
  });
}
function jumpToLastRead() {
  const id=sessionCheckpoint || sessionFirstUnread;
  const row=[...document.querySelectorAll('[data-message-id]')].find(element=>element.dataset.messageId===String(id));
  if(!row)return;
  const viewport=$('#contentScroll');
  viewport.scrollTo({top:viewport.scrollTop+row.getBoundingClientRect().top-viewport.getBoundingClientRect().top-30,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
}
function unreadBadge(channel) {
  const count = ChannelReadState.count(channelRecords(channel), readState, channel);
  return count ? `<span class="unread-badge" role="img" aria-label="${count} new ${count === 1 ? 'item' : 'items'}" title="${count} new ${count === 1 ? 'item' : 'items'}"><span aria-hidden="true">🚀</span></span>` : '';
}

function openDatabase() {
  return new Promise((resolve,reject) => {
    if (!('indexedDB' in window)) return reject(new Error('Browser storage unavailable'));
    const request = indexedDB.open('tylers-shelf-showcase', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) {
        const store = db.createObjectStore('projects',{keyPath:'id'});
        STARTER_PROJECTS.forEach(project => store.put(project));
      }
      if (!db.objectStoreNames.contains('entries')) {
        const store = db.createObjectStore('entries',{keyPath:'id'});
        STARTER_ENTRIES.forEach(entry => store.put(entry));
      }
      if (!db.objectStoreNames.contains('comments')) db.createObjectStore('comments',{keyPath:'id'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function readStore(name) {
  return new Promise((resolve,reject) => {
    const request = database.transaction(name).objectStore(name).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function writeStore(name,mode,value) {
  return new Promise((resolve,reject) => {
    const request = database.transaction(name,'readwrite').objectStore(name)[mode](value);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}
function fallbackRead(name,defaultValue) { try { return JSON.parse(localStorage.getItem(`tylers-shelf-${name}`)) || defaultValue; } catch { return defaultValue; } }
function fallbackWrite(name,value) { localStorage.setItem(`tylers-shelf-${name}`,JSON.stringify(value)); }
async function initialize() {
  try {
    database = await openDatabase();
    [projects,entries,comments] = await Promise.all(['projects','entries','comments'].map(readStore));
  } catch {
    projects = fallbackRead('projects',[...STARTER_PROJECTS]);
    entries = fallbackRead('entries',[...STARTER_ENTRIES]);
    comments = fallbackRead('comments',[]);
  }
  const original = projects.find(project => project.id === 'tylers-shelf');
  if (original?.title === "Tyler's Shelf") {
    original.title = 'Tyler.Center';
    if (database) await writeStore('projects','put',original);
    else fallbackWrite('projects',projects);
  }
  const firstPost = entries.find(entry => entry.id === 'why-site');
  if (firstPost?.domain === "Tyler's Shelf") {
    firstPost.domain = 'Tyler.Center';
    if (database) await writeStore('entries','put',firstPost);
    else fallbackWrite('entries',entries);
  }
  navigate('home');
}
async function saveRecord(type,record) {
  const store = type === 'project' ? 'projects' : 'entries';
  if (database) await writeStore(store,'put',record);
  const list = type === 'project' ? projects : entries;
  const updated = [...list.filter(item => item.id !== record.id),record];
  if (type === 'project') projects = updated; else entries = updated;
  if (!database) fallbackWrite(store,updated);
  renderEverything();
}
async function removeRecord(type,id) {
  const store = type === 'project' ? 'projects' : 'entries';
  if (database) await writeStore(store,'delete',id);
  if (type === 'project') projects = projects.filter(item => item.id !== id);
  else entries = entries.filter(item => item.id !== id);
  if (!database) fallbackWrite(store,type === 'project' ? projects : entries);
  renderEverything();
}
async function addComment(comment) {
  if (database) await writeStore('comments','put',comment);
  comments = [...comments,comment];
  if (!database) fallbackWrite('comments',comments);
  renderEverything();
}
function renderEverything() { const top=$('#contentScroll').scrollTop; renderNav(); render(); $('#contentScroll').scrollTop=top; }
function renderNav() {
  $('#channelNav').innerHTML = CHANNELS.map(channel => `<button class="channel-link ${activeChannel === channel.id ? 'active' : ''}" data-channel="${channel.id}" ${activeChannel === channel.id ? 'aria-current="page"' : ''}><span class="hash">#</span><span>${channel.title}</span><span class="channel-count">${channelRecords(channel.id).length}</span>${unreadBadge(channel.id)}</button>`).join('');
  $('.home-link').classList.toggle('active',activeChannel === 'home');
}
function navigate(channel) {
  if(channel!=='home' && !channelMeta(channel) && !APP_VIEWS[channel])return;
  markVisibleMessages();clearTimeout(readingTimer);
  SpiderGame.unmount();
  activeChannel = channel;
  const meta = channelMeta(channel) || APP_VIEWS[channel];
  const records=channelMeta(channel)?ChannelReadState.ordered(channelRecords(channel)):[];
  const savedCheckpoint=readingPositions[channel];
  sessionCheckpoint=records.some(record=>String(record.id)===savedCheckpoint)?savedCheckpoint:null;
  sessionFirstUnread=records.find(record=>ChannelReadState.count([record],readState,channel))?.id || null;
  $('#headerTitle').textContent = channel === 'home' ? 'about-tyler' : meta.title;
  $('#headerDescription').textContent = channel === 'home' ? 'Work, field notes & the rest' : meta.description;
  $('#headerAdd').hidden = !channelMeta(channel);
  $('#headerAdd').setAttribute('aria-label', channel === 'websites' ? 'Add a website' : `Add to ${channel}`);
  $('#channelReadingBar').hidden=!channelMeta(channel);
  $('#lastReadButton').disabled=!sessionCheckpoint && !sessionFirstUnread;
  $('#lastReadButton').textContent=sessionCheckpoint?'↑ Last read':'↑ First unread';
  $('#content').classList.toggle('app-view-content',!!APP_VIEWS[channel]);
  renderNav();render();
  if(channelMeta(channel))positionChannelAtBottom();else $('#contentScroll').scrollTop=0;
  closeSidebar();
}
function projectCard(project) {
  const image = safeImage(project.image), url = safeUrl(project.url);
  return `<button class="project-card" data-project="${esc(project.id)}" aria-label="View ${esc(project.title)}"><div class="project-preview">${image ? `<img src="${esc(image)}" alt="Preview of ${esc(project.title)}">` : '<div class="project-art">✦</div>'}<span class="preview-badge">${project.builtIn ? 'Original prototype' : 'Website'}</span></div><div class="project-details"><span class="project-category">${esc(project.category)}</span><h3>${esc(project.title)}</h3><p>${esc(project.description)}</p><div class="project-bottom"><span>${url ? esc(domainOf(url)) : 'Concept preview'}</span><b>${commentCount('project',project.id)} comments · Explore ↗</b></div></div></button>`;
}
function render() {
  if(activeChannel==='home')renderHome();
  else if(activeChannel==='spider')SpiderGame.mount($('#content'));
  else renderChannel();
}
function renderHome() {$('#content').innerHTML=aboutThread();}
function linkPreview(entry) {
  const image = safeImage(entry.image), url = safeUrl(entry.url);
  return `<div class="link-preview"><div class="link-preview-visual">${image ? `<img src="${esc(image)}" alt="Preview of ${esc(entry.title)}">` : `<div class="link-preview-art"><span>${esc(entry.domain || domainOf(url) || 'THE WEB')}</span><strong>${esc(entry.title)}</strong></div>`}</div><div class="link-preview-copy"><small>${esc(entry.domain || domainOf(url) || entry.kind)}</small><strong>${esc(entry.title)}</strong><p>${esc(entry.description)}</p></div></div>`;
}
function renderChannel() {
  const meta=channelMeta(activeChannel),list=ChannelReadState.ordered(channelRecords(activeChannel));
  const type=activeChannel==='websites'?'project':'entry';
  const body=list.map(record=>{
    const date=record.publishedAt||record.created;
    const dateLabel=date && Number.isFinite(Date.parse(date))?new Date(date).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'from the collection';
    let attachment='';
    if(activeChannel==='websites') attachment=projectCard(record);
    else if(activeChannel==='photography') attachment=`<button class="chat-photo" data-entry="${esc(record.id)}">${safeImage(record.image)?`<img src="${esc(safeImage(record.image))}" alt="${esc(record.title)}">`:'<span class="photo-placeholder">▧</span>'}<strong>${esc(record.title)}</strong></button>`;
    else attachment=safeUrl(record.url)?`<a href="${esc(safeUrl(record.url))}" target="_blank" rel="noopener noreferrer" class="preview-link">${linkPreview(record)}</a>`:`<button class="preview-link" data-entry="${esc(record.id)}">${linkPreview(record)}</button>`;
    const divider=String(record.id)===sessionCheckpoint?'<div class="read-divider last-read-divider">You left off here</div>':record.id===sessionFirstUnread?'<div class="read-divider">New since your last visit</div>':'';
    return `${divider}<article class="message timeline-message" data-message-id="${esc(record.id)}"><div class="message-avatar tyler-avatar"><img src="assets/tyler-avatar.png" alt="" width="40" height="40"></div><div class="message-body"><div class="message-meta"><strong>Tyler</strong><span>${esc(dateLabel)}</span></div><p>${esc(record.note||record.description)}</p>${attachment}<button class="comment-link" data-${type}="${esc(record.id)}">♧ &nbsp; ${commentCount(type,record.id)} comments · Open thread</button></div></article>`;
  }).join('');
  $('#content').innerHTML=`<div class="feed channel-feed"><div class="channel-intro"><div class="channel-symbol">#</div><h1>${esc(meta.title)}</h1><p>${esc(meta.description)}.</p></div><div class="feed-day">Beginning of #${esc(activeChannel)}</div>${body||'<div class="empty-channel">Nothing here yet. More to share soon.</div>'}<div class="feed-end">You’re at the latest.</div></div>`;
}
function renderShore() {
  $('#shoreContent').innerHTML=`<div class="shore-player"><iframe id="shorePlayer" title="Live beach camera: Seaside Park, New Jersey" src="https://coastalcameranetwork.com/webcams/seaside-park/webcam-demo.php" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div><div class="shore-caption"><span>Seaside Park · beach<br>Borough of Seaside Park / Coastal Camera Network</span><button class="secondary-button" data-action="reload-shore">Reconnect ↻</button></div><p class="shore-help">Live from the beach. Press play if needed; use the player for fullscreen. If the feed stops, try reconnecting.</p><a class="shore-source" href="https://www.seasideparknj.org/community/live_webcam.php" target="_blank" rel="noopener">Camera source & current broadcast ↗</a>`;
}
function openShore() {
  closeSidebar();closeDesktopMenu();
  const camera=$('#shoreWindow');
  if(camera.hidden){camera.hidden=false;renderShore();}
  bringFront(camera);$('#shoreClose').focus();
}
function closeShore() {
  $('#shoreWindow').hidden=true;$('#shoreContent').innerHTML='';
  const trigger=matchMedia('(max-width:760px)').matches?$('#mobileMenu'):document.querySelector('[data-desktop-open="shore"]');
  trigger.focus();
}
function commentSection(type,id) {
  const thread = comments.filter(comment => comment.type === type && comment.entryId === id).sort((a,b) => a.created.localeCompare(b.created));
  return `<div class="comment-section"><h3>Comments <span>${thread.length}</span></h3><p class="comment-disclosure">Comments in this prototype are saved on this device. Shared comments need a connected database.</p><div class="comment-list">${thread.length ? thread.map(comment => `<div class="comment"><span class="comment-avatar">${esc(comment.name.slice(0,1).toUpperCase())}</span><div><strong>${esc(comment.name)}</strong><small>${esc(new Date(comment.created).toLocaleDateString())}</small><p>${esc(comment.text)}</p></div></div>`).join('') : '<p class="no-comments">Be the first to leave a comment.</p>'}</div><form id="commentForm" data-type="${type}" data-id="${esc(id)}"><label>Your name<input name="name" maxlength="40" required placeholder="Name"></label><label>Leave a comment<textarea name="text" maxlength="600" required placeholder="What did you think?"></textarea></label><div class="form-error" id="commentError" role="alert"></div><button class="primary-button" type="submit">Post comment</button></form></div>`;
}
function showProject(project) {
  const image=safeImage(project.image),url=safeUrl(project.url);
  $('#modalRoot').innerHTML = `<div class="modal-overlay" data-close-modal><div class="modal detail-modal" role="dialog" aria-modal="true" aria-label="${esc(project.title)}"><div class="modal-top"><span class="eyebrow">${esc(project.category)}</span><button class="close-button" data-close-modal aria-label="Close">×</button></div><div class="modal-body"><h2>${esc(project.title)}</h2><p class="modal-description">${esc(project.description)}</p><div class="modal-preview">${image ? `<img src="${esc(image)}" alt="Preview of ${esc(project.title)}">` : ''}</div><div class="modal-actions">${url ? `<a class="primary-button" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Visit website ↗</a>` : '<span class="empty-note">Add a live link when this site is ready.</span>'}<button class="secondary-button" data-action="edit-project" data-id="${esc(project.id)}">Edit</button><button class="secondary-button delete" data-action="delete-project" data-id="${esc(project.id)}">Remove</button></div>${commentSection('project',project.id)}</div></div></div>`;
  bindCommentForm();
}
function showEntry(entry) {
  const image=safeImage(entry.image),url=safeUrl(entry.url);
  $('#modalRoot').innerHTML = `<div class="modal-overlay" data-close-modal><div class="modal detail-modal" role="dialog" aria-modal="true" aria-label="${esc(entry.title)}"><div class="modal-top"><span class="eyebrow">#${esc(entry.channel)} · ${esc(entry.kind)}</span><button class="close-button" data-close-modal aria-label="Close">×</button></div><div class="modal-body"><h2>${esc(entry.title)}</h2><p class="modal-description">${esc(entry.description)}</p>${image ? `<div class="modal-preview"><img src="${esc(image)}" alt="${esc(entry.title)}"></div>` : ''}<p class="modal-description">${esc(entry.note || '')}</p><div class="modal-actions">${url ? `<a class="primary-button" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open link ↗</a>` : ''}<button class="secondary-button" data-action="edit-entry" data-id="${esc(entry.id)}">Edit</button><button class="secondary-button delete" data-action="delete-entry" data-id="${esc(entry.id)}">Remove</button></div>${commentSection('entry',entry.id)}</div></div></div>`;
  bindCommentForm();
}
function bindCommentForm() {
  $('#commentForm').addEventListener('submit',async event => {
    event.preventDefault();
    const form=event.currentTarget,name=form.elements.name.value.trim(),text=form.elements.text.value.trim();
    if (!name || !text) return;
    try {
      await addComment({id:uid(),type:form.dataset.type,entryId:form.dataset.id,name,text,created:new Date().toISOString()});
      const item=form.dataset.type === 'project' ? projects.find(p => p.id === form.dataset.id) : entries.find(e => e.id === form.dataset.id);
      if (item) (form.dataset.type === 'project' ? showProject : showEntry)(item);
      toast('Comment saved on this device.');
    } catch { $('#commentError').textContent='Could not save this comment. Please try again.'; }
  });
}
function closeModal() { $('#modalRoot').innerHTML=''; }
function readImage(file) { return new Promise((resolve,reject) => { const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error('Could not read image')); reader.readAsDataURL(file); }); }
function imageField(current) { return `<label class="field-label">Preview image<div class="upload-box">Upload an image<input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><span class="field-help">PNG, JPG, WebP, or GIF · up to 8 MB</span></div></label>${safeImage(current) ? `<img class="current-image" src="${esc(current)}" alt="Current preview">` : ''}`; }
function validImage(file) { return !file || (['image/png','image/jpeg','image/webp','image/gif'].includes(file.type) && file.size <= 8*1024*1024); }
function projectEditor(project=null) {
  const editing=!!project;
  $('#modalRoot').innerHTML=`<div class="modal-overlay" data-close-modal><div class="modal" role="dialog" aria-modal="true" aria-label="${editing?'Edit website':'Add a website'}"><div class="modal-top"><span class="eyebrow">${editing?'EDIT PROJECT':'NEW PROJECT'}</span><button class="close-button" data-close-modal aria-label="Close">×</button></div><div class="modal-body"><h2>${editing?'Edit website':'Add a website'}</h2><p class="modal-description">Give your site a home on the shelf.</p><form id="projectForm" class="form-grid"><label class="field-label">Website name<input name="title" value="${esc(project?.title||'')}" maxlength="70" required placeholder="e.g. My portfolio"></label><label class="field-label">What kind of site?<input name="category" value="${esc(project?.category||'')}" maxlength="60" placeholder="e.g. Portfolio · 2026"></label><label class="field-label">Short description<textarea name="description" maxlength="240" required>${esc(project?.description||'')}</textarea></label><label class="field-label">Live website URL<input name="url" type="url" value="${esc(project?.url||'')}" placeholder="https://example.com"></label>${imageField(project?.image)}<span class="field-help">Changes made here are saved in this browser. Publishing them for everyone needs a shared content source.</span><div class="form-error" id="formError" role="alert"></div><div class="form-actions"><button class="secondary-button" type="button" data-close-modal>Cancel</button><button class="primary-button" type="submit">${editing?'Save changes':'Add website'}</button></div></form></div></div></div>`;
  $('#projectForm').addEventListener('submit',event=>submitProject(event,project));
  $('#projectForm [name="title"]').focus();
}
async function submitProject(event,existing) {
  event.preventDefault(); const form=event.currentTarget,error=$('#formError');
  const title=form.elements.title.value.trim(),category=form.elements.category.value.trim()||'Website',description=form.elements.description.value.trim(),urlText=form.elements.url.value.trim(),file=form.elements.image.files[0];
  if (!title||!description) {error.textContent='Add a name and description.';return;}
  if (urlText&&!safeUrl(urlText)) {error.textContent='Enter an http or https URL.';return;}
  if (!validImage(file)) {error.textContent='Choose an image under 8 MB.';return;}
  const button=form.querySelector('[type="submit"]'); button.disabled=true;button.textContent='Saving…';
  try { const image=file?await readImage(file):existing?.image||''; await saveRecord('project',{id:existing?.id||uid(),title,category,description,url:safeUrl(urlText),image,builtIn:!!existing?.builtIn,created:existing?.created||new Date().toISOString()});closeModal();navigate('websites');toast('Website saved.'); }
  catch {error.textContent='Could not save this website. Try a smaller image.';button.disabled=false;button.textContent='Save website';}
}
function entryEditor(channel='articles',entry=null) {
  const editing=!!entry;
  $('#modalRoot').innerHTML=`<div class="modal-overlay" data-close-modal><div class="modal" role="dialog" aria-modal="true" aria-label="${editing?'Edit item':'Add an item'}"><div class="modal-top"><span class="eyebrow">${editing?'EDIT ITEM':'NEW ITEM'}</span><button class="close-button" data-close-modal aria-label="Close">×</button></div><div class="modal-body"><h2>${editing?'Edit item':'Add to the shelf'}</h2><p class="modal-description">The same item appears here and in its channel.</p><form id="entryForm" class="form-grid"><label class="field-label">Channel<select name="channel">${CHANNELS.filter(c=>c.id!=='websites').map(c=>`<option value="${c.id}" ${(entry?.channel||channel)===c.id?'selected':''}>${c.title}</option>`).join('')}</select></label><label class="field-label">Title<input name="title" value="${esc(entry?.title||'')}" maxlength="100" required></label><label class="field-label">Kind<input name="kind" value="${esc(entry?.kind||'')}" maxlength="50" placeholder="Article, video, blog post, photo…"></label><label class="field-label">Link<input name="url" type="url" value="${esc(entry?.url||'')}" placeholder="https://example.com"></label><label class="field-label">Description<textarea name="description" maxlength="300" required>${esc(entry?.description||'')}</textarea></label><label class="field-label">Why share it?<textarea name="note" maxlength="300">${esc(entry?.note||'')}</textarea></label>${imageField(entry?.image)}<span class="field-help">Changes made here are saved in this browser. Shared publishing needs a connected database.</span><div class="form-error" id="formError" role="alert"></div><div class="form-actions"><button class="secondary-button" type="button" data-close-modal>Cancel</button><button class="primary-button" type="submit">${editing?'Save changes':'Add item'}</button></div></form></div></div></div>`;
  $('#entryForm').addEventListener('submit',event=>submitEntry(event,entry));
  $('#entryForm [name="title"]').focus();
}
async function submitEntry(event,existing) {
  event.preventDefault();const form=event.currentTarget,error=$('#formError');
  const channel=form.elements.channel.value,title=form.elements.title.value.trim(),kind=form.elements.kind.value.trim()||channelMeta(channel)?.title||'Item',description=form.elements.description.value.trim(),note=form.elements.note.value.trim(),urlText=form.elements.url.value.trim(),file=form.elements.image.files[0];
  if (!title||!description) {error.textContent='Add a title and description.';return;}
  if (urlText&&!safeUrl(urlText)) {error.textContent='Enter an http or https URL.';return;}
  if (channel==='watch'&&!safeUrl(urlText)) {error.textContent='Videos need a link so Surprise Me can open them.';return;}
  if (!validImage(file)) {error.textContent='Choose an image under 8 MB.';return;}
  const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Saving…';
  try {const image=file?await readImage(file):existing?.image||'';const url=safeUrl(urlText);await saveRecord('entry',{id:existing?.id||uid(),channel,title,kind,description,note,url,domain:domainOf(url)||existing?.domain||'',image,created:existing?.created||new Date().toISOString()});closeModal();navigate(channel);toast('Item saved.');}
  catch {error.textContent='Could not save this item. Try a smaller image.';button.disabled=false;button.textContent='Save item';}
}
function bringFront(element) {element.style.zIndex=++frontLayer;}
function showShelf(channel) {
  const windowEl=$('#appWindow');
  const wasHidden=windowEl.classList.contains('hidden-window');
  windowEl.classList.remove('hidden-window');
  bringFront(windowEl);
  if(channel) navigate(channel);
  else { renderNav(); clearTimeout(readingTimer); readingTimer=setTimeout(markVisibleMessages,350); }
  if(wasHidden) $('#windowMinimize').focus();
}
function hideShelf() {
  markVisibleMessages();clearTimeout(readingTimer);closeSearch();closeModal();closeSidebar();closeDesktopMenu();
  $('#desktopMenuHost').dataset.open='';
  $('#appWindow').classList.add('hidden-window');
  document.querySelector('[data-desktop-open="home"]').focus();
}
let unzoomedLayout = null;
function toggleZoom(element) {
  const properties = ['left','top','transform','width','height'];
  if (element.classList.contains('zoomed')) {
    element.classList.remove('zoomed');
    properties.forEach(key => {element.style[key]=unzoomedLayout?.[key] || '';});
  } else {
    unzoomedLayout = Object.fromEntries(properties.map(key => [key,element.style[key]]));
    properties.forEach(key => {element.style[key]='';});
    element.classList.add('zoomed');
  }
}
function makeResizable(element, handle) {
  let resize = null;
  const begin = () => {
    const rect = element.getBoundingClientRect();
    const minWidth = Math.min(520, innerWidth - 24);
    const minHeight = Math.min(300, innerHeight - 68);
    const left = Math.max(8, Math.min(rect.left, innerWidth - minWidth - 12));
    const top = Math.max(36, Math.min(rect.top, innerHeight - minHeight - 12));
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    element.style.transform = 'none';
    bringFront(element);
    return {width:rect.width,height:rect.height,minWidth,minHeight,maxWidth:innerWidth-left-12,maxHeight:innerHeight-top-12};
  };
  const apply = (start, dx, dy) => {
    element.style.width = `${Math.max(start.minWidth, Math.min(start.maxWidth, start.width + dx))}px`;
    element.style.height = `${Math.max(start.minHeight, Math.min(start.maxHeight, start.height + dy))}px`;
  };
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || matchMedia('(max-width:760px)').matches || element.classList.contains('zoomed')) return;
    event.preventDefault();
    resize = {...begin(), x:event.clientX, y:event.clientY};
    element.classList.add('resizing');
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', event => {
    if (resize) apply(resize, event.clientX-resize.x, event.clientY-resize.y);
  });
  const end = () => {resize=null;element.classList.remove('resizing');};
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  handle.addEventListener('lostpointercapture', end);
  handle.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key) || element.classList.contains('zoomed') || matchMedia('(max-width:760px)').matches) return;
    event.preventDefault();
    const step = event.shiftKey ? 50 : 10;
    apply(begin(), event.key==='ArrowLeft' ? -step : event.key==='ArrowRight' ? step : 0, event.key==='ArrowUp' ? -step : event.key==='ArrowDown' ? step : 0);
  });
}
function makeDraggable(element,handle) {
  let drag=null;
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('button')||matchMedia('(max-width:760px)').matches||element.classList.contains('zoomed'))return;
    const rect=element.getBoundingClientRect();drag={x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,width:rect.width};
    element.style.left=`${rect.left}px`;element.style.top=`${rect.top}px`;element.style.transform='none';element.classList.add('dragging');bringFront(element);handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove',event=>{if(!drag)return;const left=Math.min(innerWidth-110,Math.max(110-drag.width,drag.left+event.clientX-drag.x));const top=Math.min(innerHeight-90,Math.max(32,drag.top+event.clientY-drag.y));element.style.left=`${left}px`;element.style.top=`${top}px`;});
  const end=()=>{drag=null;element.classList.remove('dragging');};handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
}
function closeDesktopMenu() {$('#desktopMenuHost').innerHTML='';document.querySelectorAll('[data-menu]').forEach(button=>button.classList.remove('active'));}
function openDesktopMenu(name,button) {
  if($('#desktopMenuHost').dataset.open===name) {closeDesktopMenu();$('#desktopMenuHost').dataset.open='';return;}
  closeDesktopMenu();$('#desktopMenuHost').dataset.open=name;button.classList.add('active');
  const items={file:[['linkedin','in','LinkedIn ↗'],['email','✉','Email me'],['instagram','◎','Instagram']],rec:[['recommend','✦','Recommend something to me'],['drafts','▤','Saved drafts on this device']],view:[['shore','◉','Jersey Shore live'],['surprise','▶','Surprise me with a video'],['spider','✳','Take a break']],window:[['show-shelf','✦','Show Tyler.Center'],['center-window','▣','Center window']]}[name];
  const rect=button.getBoundingClientRect();
  $('#desktopMenuHost').innerHTML=`<div class="desktop-dropdown" style="left:${Math.round(rect.left)}px">${items.map(([action,icon,label])=>`<button data-menu-action="${action}"><span>${icon}</span>${label}</button>`).join('')}</div>`;
}
function surpriseMe() {
  const videos=entries.filter(entry=>entry.channel==='watch'&&safeUrl(entry.url));
  if(!videos.length){toast('Add a video to #watch first.');return;}
  const choices=videos.length>1?videos.filter(video=>video.id!==lastSurpriseId):videos;
  const chosen=choices[Math.floor(Math.random()*choices.length)];lastSurpriseId=chosen.id;
  window.open(safeUrl(chosen.url),'_blank','noopener,noreferrer');
  toast(`Surprise: ${chosen.title}`);
}
function recommendModal() {
  $('#modalRoot').innerHTML=`<div class="modal-overlay" data-close-modal><div class="modal" role="dialog" aria-modal="true" aria-label="Recommend something"><div class="modal-top"><span class="eyebrow">SEND ME A REC</span><button class="close-button" data-close-modal aria-label="Close">×</button></div><div class="modal-body"><h2>Got a good one?</h2><p class="modal-description">An article, video, website, or anything else I should see.</p><form id="recForm" class="form-grid"><label class="field-label">Your name<input name="name" maxlength="60" required></label><label class="field-label">Your email (optional)<input name="from" type="email" maxlength="120"></label><label class="field-label">What is it?<select name="kind"><option>Article</option><option>Video</option><option>Website</option><option>Writing</option><option>Other</option></select></label><label class="field-label">Link<input name="url" type="url" placeholder="https://..."></label><label class="field-label">Why should I check it out?<textarea name="note" maxlength="700" required></textarea></label><p class="field-help">${contactEmail()?'Submitting opens your email app with the recommendation ready to send.':'Delivery is waiting for Tyler’s contact email. Your recommendation can be saved as a local draft for now.'}</p><div class="form-error" id="recError" role="alert"></div><div class="form-actions"><button class="secondary-button" data-close-modal type="button">Cancel</button><button class="primary-button" type="submit">${contactEmail()?'Open email draft':'Save local draft'}</button></div></form></div></div></div>`;
  $('#recForm').addEventListener('submit',event=>{
    event.preventDefault();const form=event.currentTarget;const name=form.elements.name.value.trim(),from=form.elements.from.value.trim(),kind=form.elements.kind.value,url=form.elements.url.value.trim(),note=form.elements.note.value.trim();
    if(!name||!note)return;if(url&&!safeUrl(url)){$('#recError').textContent='Enter an http or https URL.';return;}
    const body=`From: ${name}${from?` (${from})`:''}\nType: ${kind}\nLink: ${url||'No link'}\n\n${note}`;
    if(contactEmail()){window.location.href=`mailto:${contactEmail()}?subject=${encodeURIComponent(`A ${kind.toLowerCase()} recommendation for Tyler`)}&body=${encodeURIComponent(body)}`;closeModal();}
    else {try{const drafts=fallbackRead('recommendations',[]);drafts.push({name,from,kind,url,note,created:new Date().toISOString()});fallbackWrite('recommendations',drafts);closeModal();toast('Saved on this device. This has not been sent to Tyler.');}catch{$('#recError').textContent='Could not save this draft.';}}
  });
}
function draftsModal() {
  const drafts=fallbackRead('recommendations',[]);
  $('#modalRoot').innerHTML=`<div class="modal-overlay" data-close-modal><div class="modal" role="dialog" aria-modal="true" aria-label="Saved recommendation drafts"><div class="modal-top"><span class="eyebrow">REC DRAFTS</span><button class="close-button" data-close-modal aria-label="Close">×</button></div><div class="modal-body"><h2>Saved drafts</h2><p class="modal-description">These recommendations are on this device only. They have not been sent to Tyler.</p><div class="draft-list">${drafts.length?drafts.map(draft=>`<div><strong>${esc(draft.kind)} from ${esc(draft.name)}</strong><p>${esc(draft.note)}</p>${safeUrl(draft.url)?`<a href="${esc(safeUrl(draft.url))}" target="_blank" rel="noopener noreferrer">Open link ↗</a>`:''}</div>`).join(''):'<p>No drafts saved yet.</p>'}</div></div></div></div>`;
}

function openLinkedIn() {
  const url = safeUrl(CONTACT.linkedin);
  if (url) window.open(url, '_blank', 'noopener');
  else toast('LinkedIn link is waiting for Tyler’s profile URL.');
}
function wallpaperCredit() {
  $('#modalRoot').innerHTML = `<div class="modal-overlay" data-close-modal><div class="modal credit-modal" role="dialog" aria-modal="true" aria-label="Wallpaper credit"><div class="modal-top"><span class="eyebrow">WALLPAPER / NASA</span><button class="close-button" data-close-modal aria-label="Close">×</button></div><div class="modal-body"><img class="credit-photo" src="assets/challenger-launch.jpg" alt="Space Shuttle Challenger launching from Complex 39 at Kennedy Space Center"><h2>Space Shuttle Challenger launches from Kennedy Space Center</h2><p class="modal-description">The Space Shuttle Challenger launching from Complex 39<br>Kennedy Space Center, Florida, USA</p><p class="modal-description">Photo: NASA, via Unsplash.<br>Published on March 2, 2021 (UTC).</p><div class="modal-actions"><a href="https://unsplash.com/photos/dCgbRAQmTQA" target="_blank" rel="noopener">View original photograph ↗</a><a href="https://unsplash.com/license" target="_blank" rel="noopener">Free to use under the Unsplash License ↗</a></div></div></div></div>`;
  $('#modalRoot [data-close-modal] button').focus();
}
function initializeLinkedIn() {
  document.querySelectorAll('.linkedin-link').forEach(link => {
    const url = safeUrl(CONTACT.linkedin);
    if (url) link.href = url;
    else link.addEventListener('click', event => { event.preventDefault(); openLinkedIn(); });
  });
}

function toast(message) {const element=$('#toast');element.textContent=message;element.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>element.classList.remove('show'),3500);}
function closeSearch() {$('#searchRoot').innerHTML='';}
function openSearch() {$('#searchRoot').innerHTML=`<div class="search-overlay" data-close-search><div class="search-panel" role="dialog" aria-modal="true" aria-label="Search the shelf"><div class="search-box"><span>⌕</span><input id="searchInput" type="search" placeholder="Search the shelf…" autocomplete="off"><button data-close-search>ESC</button></div><div class="search-results" id="searchResults"></div></div></div>`;$('#searchInput').addEventListener('input',renderSearch);$('#searchInput').focus();renderSearch();}
function renderSearch() {
  const query=$('#searchInput').value.trim().toLowerCase();if(!query){$('#searchResults').innerHTML='<div class="search-empty">Search websites, articles, videos, writing, and photos.</div>';return;}
  const results=[...projects.filter(p=>`${p.title} ${p.description}`.toLowerCase().includes(query)).map(p=>`<button class="search-result" data-search-project="${esc(p.id)}"><small>Website</small><strong>${esc(p.title)}</strong><span>${esc(p.description)}</span></button>`),...entries.filter(e=>`${e.title} ${e.description} ${e.channel}`.toLowerCase().includes(query)).map(e=>`<button class="search-result" data-search-entry="${esc(e.id)}"><small>#${esc(e.channel)}</small><strong>${esc(e.title)}</strong><span>${esc(e.description)}</span></button>`),...CHANNELS.filter(c=>`${c.title} ${c.description}`.toLowerCase().includes(query)).map(c=>`<button class="search-result" data-channel="${esc(c.id)}"><small>Channel</small><strong>#${esc(c.title)}</strong><span>${esc(c.description)}</span></button>`)];
  $('#searchResults').innerHTML=results.length?results.join(''):'<div class="search-empty">No matches yet.</div>';
}
function closeSidebar() {$('#sidebar').classList.remove('open');$('#mobileScrim').hidden=true;}
function toggleSidebar() {const open=$('#sidebar').classList.toggle('open');$('#mobileScrim').hidden=!open;}
function updateDesktopClock() {$('#desktopClock').textContent=new Date().toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}

document.addEventListener('click',async event=>{
  const target=event.target;
  const caseFile=target.closest('[data-case-study]');if(caseFile){showCaseStudy(Number(caseFile.dataset.caseStudy));return;}
  const menuButton=target.closest('[data-menu]');if(menuButton){openDesktopMenu(menuButton.dataset.menu,menuButton);return;}
  const menuAction=target.closest('[data-menu-action]');if(menuAction){const action=menuAction.dataset.menuAction;closeDesktopMenu();$('#desktopMenuHost').dataset.open='';if(action==='shore')openShore();if(action==='spider')showShelf(action);if(action==='linkedin')openLinkedIn();if(action==='email')contactEmail()?window.location.href=`mailto:${contactEmail()}`:toast('Add Tyler’s email to enable this link.');if(action==='instagram')instagramUrl()?window.open(instagramUrl(),'_blank','noopener,noreferrer'):toast('Add Tyler’s Instagram profile to enable this link.');if(action==='recommend')recommendModal();if(action==='drafts')draftsModal();if(action==='surprise')surpriseMe();if(action==='show-shelf')showShelf();if(action==='center-window'){const element=$('#appWindow');element.style.left='';element.style.top='';element.style.transform='';toast('Window centered.');}return;}
  if(!target.closest('.desktop-dropdown')){closeDesktopMenu();$('#desktopMenuHost').dataset.open='';}
  const channel=target.closest('[data-channel]');if(channel){closeSearch();showShelf(channel.dataset.channel);return;}
  const project=target.closest('[data-project]');if(project){const record=projects.find(item=>item.id===project.dataset.project);if(record)showProject(record);return;}
  const entry=target.closest('[data-entry]');if(entry){const record=entries.find(item=>item.id===entry.dataset.entry);if(record)showEntry(record);return;}
  const searchProject=target.closest('[data-search-project]');if(searchProject){const record=projects.find(item=>item.id===searchProject.dataset.searchProject);closeSearch();showShelf('websites');if(record)showProject(record);return;}
  const searchEntry=target.closest('[data-search-entry]');if(searchEntry){const record=entries.find(item=>item.id===searchEntry.dataset.searchEntry);closeSearch();if(record){showShelf(record.channel);showEntry(record);}return;}
  const actionButton=target.closest('[data-action]');if(actionButton){const action=actionButton.dataset.action,id=actionButton.dataset.id;if(action==='reload-shore')renderShore();if(action==='wallpaper-credit')wallpaperCredit();if(action==='add-project')projectEditor();if(action==='edit-project'){const record=projects.find(item=>item.id===id);if(record)projectEditor(record);}if(action==='delete-project'){const record=projects.find(item=>item.id===id);if(record&&confirm(`Remove "${record.title}" from this browser?`)){try{await removeRecord('project',id);closeModal();toast('Website removed.');}catch{toast('Could not remove the website.');}}}if(action==='edit-entry'){const record=entries.find(item=>item.id===id);if(record)entryEditor(record.channel,record);}if(action==='delete-entry'){const record=entries.find(item=>item.id===id);if(record&&confirm(`Remove "${record.title}" from this browser?`)){try{await removeRecord('entry',id);closeModal();toast('Item removed.');}catch{toast('Could not remove the item.');}}}if(action==='add-entry')entryEditor(activeChannel);if(action==='surprise')surpriseMe();return;}
  if(target.closest('[data-close-modal]')&&(target===target.closest('[data-close-modal]')||target.tagName==='BUTTON')){closeModal();return;}
  if(target.closest('[data-close-search]')&&(target===target.closest('[data-close-search]')||target.tagName==='BUTTON'))closeSearch();
});
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openSearch();}if(event.key==='Escape'){closeSearch();closeModal();closeDesktopMenu();closeSidebar();}});
$('#searchTrigger').addEventListener('click',openSearch);
$('#headerSearch').addEventListener('click',openSearch);
$('#headerAdd').addEventListener('click',()=>activeChannel==='websites'?projectEditor():entryEditor(activeChannel));
$('#lastReadButton').addEventListener('click',jumpToLastRead);
$('#latestButton').addEventListener('click',()=>{$('#contentScroll').scrollTo({top:$('#contentScroll').scrollHeight,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});});
$('#contentScroll').addEventListener('scroll',()=>{clearTimeout(readingTimer);readingTimer=setTimeout(markVisibleMessages,200);},{passive:true});
$('#mobileMenu').addEventListener('click',toggleSidebar);
$('#mobileScrim').addEventListener('click',closeSidebar);
$('#windowClose').addEventListener('click',hideShelf);
$('#windowMinimize').addEventListener('click',hideShelf);
$('#windowZoom').addEventListener('click',()=>toggleZoom($('#appWindow')));
document.querySelectorAll('[data-desktop-open]').forEach(button=>button.addEventListener('click',()=>button.dataset.desktopOpen==='shore'?openShore():showShelf(button.dataset.desktopOpen)));
$('#appWindow').addEventListener('pointerdown',()=>bringFront($('#appWindow')));
makeDraggable($('#appWindow'),$('#appWindow .topbar'));
makeResizable($('#appWindow'),$('#windowResize'));
$('#shoreClose').addEventListener('click',closeShore);
$('#shoreWindow').addEventListener('pointerdown',()=>bringFront($('#shoreWindow')));
makeDraggable($('#shoreWindow'),$('#shoreWindow .topbar'));
makeResizable($('#shoreWindow'),$('#shoreResize'));
updateDesktopClock();setInterval(updateDesktopClock,30000);
initializeLinkedIn();
initialize();
