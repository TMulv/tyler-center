// Add Tyler's real contact links here when they are available.
const CONTACT = { email: '', instagram: 'https://www.instagram.com/tyler_mulvey/', twitter: 'https://x.com/tyler_mulvey', linkedin: 'https://www.linkedin.com/in/tylermulvey/' };

const CHANNELS = [
  {id:'websites', title:"what-i've-built", description:"Apps and websites I’ve made"},
  {id:'articles', title:'read-later', managed:true, description:"this is a live feed of articles crossing my desk that i'm saving to read for later", intro:"this is a live feed of articles crossing my desk that i'm saving to read for later. All news is biased, but this is news that's biasing me. (Warning: you may become Tyler leaning after reading what I'm reading.)"},
  {id:'watch', title:'watch-or-listen-later', managed:true, description:'Videos, movies, shows and podcasts I’m saving for later', intro:'Things I want to watch or listen to. Filter by type, or see what I’ve finished.'},
  {id:'writing', title:'betting-antelope', description:'Newsletter that launched in 2019 (before AI was everywhere) and a link to sign up for our emails with me and Vince. He built a machine learning model to predict NFL games. This is our newsletter that comes out Monday, Thursday, Sundays, and Saturdays when there are games.', intro:'Newsletter that launched in 2019 (before AI was everywhere) and a link to sign up for our emails with me and Vince. He built a machine learning model to predict NFL games. This is our newsletter that comes out Monday, Thursday, Sundays, and Saturdays when there are games.', introLinks:[{text:'Vince',url:'https://dk.linkedin.com/in/vincemartin-eng'},{text:'sign up for our emails',url:'https://bettingantelope.substack.com/subscribe'}], managed:true, sourceUrl:'https://bettingantelope.substack.com/subscribe', sourceLabel:'Sign up for our emails ↗'},
  {id:'newsletters', title:'daily-newsletter', description:"I subscribe to a ton of newsletters, both paid and free. Sometimes I don't have a chance to read them, so this is a Live Feed of a Frankenstein version of my newsletter, the most interesting or important articles that came through today that I don't want to fall through the cracks", managed:true, intro:"I subscribe to a ton of newsletters, both paid and free. Sometimes I don't have a chance to read them, so this is a Live Feed of a Frankenstein version of my newsletter, the most interesting or important articles that came through today that I don't want to fall through the cracks", empty:'The first digest will appear here once the archive is connected.'},
  {id:'photography', title:'photography', description:'Photos I have taken'}
];
const STARTER_PROJECTS = [{
  id:'tomotomo', title:'TomoTomo', category:'App · iPhone & iPad',
  description:'Read and listen without losing your place. TomoTomo keeps your ebooks and audiobooks in sync, using the files you already own.',
  url:'https://apps.apple.com/us/app/tomotomo/id6778601579', image:'', created:'2026-09-30'
}, {
  id:'domain-3eb8153c8a3e80d89ceec81441ec3b55', title:'Kanye2024.com', category:'Website · Sold',
  description:'Sold the domain. Transfer confirmation below.',
  url:'', image:'', projectStatus:'Sold', created:'2016-12-03'
}];
const PROJECT_ATTACHMENTS = {
  'domain-3eb8153c8a3e80d89ceec81441ec3b55': {
    image:'assets/kanye2024-transfer-confirmation.png',
    title:'Kanye2024.com · proof of transfer',
    description:'Namecheap confirmed the new owner accepted the domain on December 21, 2016.'
  }
};
const STARTER_ENTRIES = [
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
const isAppStoreProject = project => domainOf(project.url) === 'apps.apple.com';
const domainOf = value => { const url=safeUrl(value); return url ? new URL(url).hostname.replace(/^www\./,'') : ''; };
let projects = [...STARTER_PROJECTS], entries = [...STARTER_ENTRIES], comments = [];
let database = null, activeChannel = 'home';
let publishedEntries = [], refreshingFeeds = false;
const channelFilters = {};
const allEntries = () => ChannelFeeds.merge(entries, publishedEntries.filter(e=>e.channel!=='websites'));
let toastTimer, lastSurpriseId = null, frontLayer = 4;
let readState = fallbackRead('read-state-v1', {});
let readingPositions = fallbackRead('reading-positions-v1', {});
if (!readingPositions || typeof readingPositions !== 'object' || Array.isArray(readingPositions)) readingPositions = {};
let sessionCheckpoint = null, sessionFirstUnread = null, readingTimer;
const APP_VIEWS = {private:{title:'your-username',description:'Your own channel: save posts privately and join the conversation'},spider:{title:'spider-solitaire',description:'A little break'}};

const channelRecords = channel => channel === 'websites' ? projects : allEntries().filter(entry => entry.channel === channel);
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
  return count ? `<button type="button" class="unread-badge" data-unread-menu="${esc(channel)}" aria-haspopup="menu" aria-expanded="false" aria-label="${count} new items in ${esc(channelMeta(channel)?.title || channel)}. Reading options" title="Reading options"><span aria-hidden="true">🚀</span></button>` : '';
}


let rocketOpener=null;
function closeRocketMenu(restoreFocus=false) {
  $('#rocketMenuHost').innerHTML='';
  document.querySelectorAll('[data-unread-menu]').forEach(button=>button.setAttribute('aria-expanded','false'));
  if(restoreFocus && rocketOpener) {
    const match=[...document.querySelectorAll('[data-unread-menu]')].find(b=>b.dataset.unreadMenu===rocketOpener.dataset.unreadMenu);
    (match || [...document.querySelectorAll('[data-channel]')].find(b=>b.dataset.channel===rocketOpener.dataset.unreadMenu))?.focus();
  }
  rocketOpener=null;
}
function openRocketMenu(button) {
  const channel=button.dataset.unreadMenu;
  if(!channelMeta(channel))return;
  closeRocketMenu();rocketOpener=button;
  const rect=button.getBoundingClientRect();
  $('#rocketMenuHost').innerHTML=`<div class="rocket-menu" role="menu" aria-label="Reading options for ${esc(channelMeta(channel).title)}" style="left:${Math.max(12,Math.min(rect.left,innerWidth-257))}px;top:${Math.max(12,Math.min(rect.bottom+5,innerHeight-160))}px"><small>#${esc(channelMeta(channel).title)}</small><button role="menuitem" data-mark-read="${esc(channel)}">Mark all as read</button><button role="menuitem" data-mark-read="all">Mark every channel as read</button></div>`;
  button.setAttribute('aria-expanded','true');
  $('#rocketMenuHost [role="menuitem"]').focus();
}
function markChannelRead(channel) {
  const targets=channel==='all'?CHANNELS:CHANNELS.filter(c=>c.id===channel);
  for(const target of targets) {
    const records=channelRecords(target.id);
    readState=ChannelReadState.markRead(records,readState,target.id);
    readingPositions[target.id]=ChannelReadState.ordered(records).at(-1)?.id || null;
  }
  try{fallbackWrite('read-state-v1',readState);fallbackWrite('reading-positions-v1',readingPositions);}catch{}
  const focusChannel=rocketOpener?.dataset.unreadMenu;
  closeRocketMenu();
  if(targets.some(c=>c.id===activeChannel)){sessionCheckpoint=readingPositions[activeChannel];sessionFirstUnread=null;}
  renderEverything();
  [...document.querySelectorAll('[data-channel]')].find(b=>b.dataset.channel===focusChannel)?.focus();
  toast(channel==='all'?'All channels marked as read.':'Channel marked as read.');
}
document.addEventListener('keydown',event=>{
  if(!event.target.closest('.rocket-menu'))return;
  const items=[...$('#rocketMenuHost').querySelectorAll('[role="menuitem"]')];
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
    event.preventDefault();
    const current=items.indexOf(document.activeElement);
    const next=event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
    items[next]?.focus();
  }
  if(event.key==='Tab')closeRocketMenu();
});

function openDatabase() {
  return new Promise((resolve,reject) => {
    if (!('indexedDB' in window)) return reject(new Error('Browser storage unavailable'));
    const request = indexedDB.open('tylers-shelf-showcase', 3);
    request.onupgradeneeded = event => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) {
        const store = db.createObjectStore('projects',{keyPath:'id'});
        STARTER_PROJECTS.forEach(project => store.put(project));
      } else if (event.oldVersion < 3) {
        // Publish the new app to returning visitors without replacing their projects.
        const store = request.transaction.objectStore('projects');
        const existing = store.get('tomotomo');
        existing.onsuccess = () => {
          if (!existing.result) store.put(STARTER_PROJECTS.find(project => project.id === 'tomotomo'));
        };
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
  // The self-preview renders About me without accounts, feed polling, or nested cards.
  if(window.self!==window.top && new URLSearchParams(location.search).get('project-preview')==='1') {
    document.documentElement.classList.add('project-preview-mode');
    navigate('home');
    return;
  }
  try {
    database = await openDatabase();
    [projects,entries,comments] = await Promise.all(['projects','entries','comments'].map(readStore));
  } catch {
    projects = fallbackRead('projects',[...STARTER_PROJECTS]);
    entries = fallbackRead('entries',[...STARTER_ENTRIES]);
    comments = fallbackRead('comments',[]);
    if (!fallbackRead('tomotomo-added-v1', false)) {
      if (!projects.some(project => project.id === 'tomotomo')) projects.push({...STARTER_PROJECTS.find(project => project.id === 'tomotomo')});
      try {
        fallbackWrite('projects', projects);
        fallbackWrite('tomotomo-added-v1', true);
      } catch { /* The app still appears when browser storage is unavailable. */ }
    }
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
  // Public projects come from the canonical app list and Notion, never old browser copies.
  projects = ChannelFeeds.projects(STARTER_PROJECTS, publishedEntries);
  navigate('home');
  refreshFeeds();
  setInterval(() => {if (!document.hidden) refreshFeeds();}, 60000);
  document.addEventListener('visibilitychange', () => {if (!document.hidden) refreshFeeds();});
}
async function refreshFeeds() {
  if (refreshingFeeds) return;
  refreshingFeeds = true;
  const oldEntries = JSON.stringify(publishedEntries);
  try {
    const previewsChanged=await refreshLinkPreviews();
    const results = await Promise.allSettled(['writing','newsletters','articles','websites','watch'].map(async channel => {
      const response = await fetch(`data/${channel}.json`, {cache:'no-store', signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('Feed unavailable');
      return {channel, records:ChannelFeeds.validate(await response.json(), channel)};
    }));
    for (const result of results) if (result.status === 'fulfilled') {
      publishedEntries = [...publishedEntries.filter(e => e.channel !== result.value.channel), ...result.value.records];
    }
    if (JSON.stringify(publishedEntries) !== oldEntries || previewsChanged) {
      projects = ChannelFeeds.projects(STARTER_PROJECTS, publishedEntries.filter(e=>e.channel==='websites'));
      const viewport = $('#contentScroll');
      const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80;
      const anchor = [...document.querySelectorAll('[data-message-id]')].find(el => el.getBoundingClientRect().bottom > viewport.getBoundingClientRect().top);
      const anchorId = anchor?.dataset.messageId, anchorTop = anchor?.getBoundingClientRect().top;
      renderNav();
      if (['writing','newsletters','articles','websites','watch'].includes(activeChannel)) {
        const oldTop = viewport.scrollTop;
        if (!sessionFirstUnread) sessionFirstUnread = ChannelReadState.ordered(channelRecords(activeChannel)).find(record => ChannelReadState.count([record],readState,activeChannel))?.id || null;
        $('#lastReadButton').disabled = !sessionCheckpoint && !sessionFirstUnread;
        renderChannel();
        viewport.scrollTop = oldTop;
        const replacement = [...document.querySelectorAll('[data-message-id]')].find(el => el.dataset.messageId === anchorId);
        viewport.scrollTop = oldTop + (replacement ? replacement.getBoundingClientRect().top - anchorTop : 0);
        if (atBottom) positionChannelAtBottom();
        else {clearTimeout(readingTimer);readingTimer=setTimeout(markVisibleMessages,350);}
      } else if (activeChannel === 'home') {
        const top = viewport.scrollTop; renderHome(); viewport.scrollTop = top;
      }
    }
  } finally {refreshingFeeds = false;}
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
  $('#channelNav').innerHTML = CHANNELS.map(channel => `<div class="channel-nav-row"><button class="channel-link ${activeChannel === channel.id ? 'active' : ''}" data-channel="${channel.id}" ${activeChannel === channel.id ? 'aria-current="page"' : ''}><span class="hash">#</span><span>${channel.title}</span><span class="channel-count">${channelRecords(channel.id).length}</span></button>${unreadBadge(channel.id)}</div>`).join('');
  globalThis.ReaderUI?.renderNav();
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
  $('#headerDescription').innerHTML = channel === 'home'
    ? 'Work, field notes &amp; the rest'
    : ChannelFeeds.linkedText(meta.description || '', meta.introLinks || []);
  $('#headerAdd').hidden = channel === 'websites' || !channelMeta(channel) || !!meta.managed;
  $('#headerAdd').setAttribute('aria-label', `Add to ${channel}`);
  $('#channelReadingBar').hidden=!channelMeta(channel);
  $('#channelFilters').hidden=!channelMeta(channel);
  $('#lastReadButton').disabled=!sessionCheckpoint && !sessionFirstUnread;
  $('#lastReadButton').textContent=sessionCheckpoint?'↑ Last read':'↑ First unread';
  $('#content').classList.toggle('app-view-content',!!APP_VIEWS[channel]);
  renderNav();render();
  if(channelMeta(channel))positionChannelAtBottom();else $('#contentScroll').scrollTop=0;
  closeSidebar();
}
function projectCard(project) {
  const url = safeUrl(project.url);
  const attachment = PROJECT_ATTACHMENTS[project.id];
  if (project.projectStatus==='Sold') return `<div class="sold-project"><div class="sold-project-heading"><span class="sold-stamp">SOLD</span><span class="project-status">${esc(project.title)} - first domain purchase and sale i made</span></div>${attachment ? `<a class="preview-link transfer-preview" href="${esc(attachment.image)}" target="_blank" rel="noopener noreferrer" aria-label="Open proof of Kanye2024.com ownership transfer"><div class="link-preview source-preview"><div class="transfer-preview-image"><img src="${esc(attachment.image)}" alt="Namecheap confirms the transfer of Kanye2024.com on December 21, 2016" loading="lazy"></div><div class="link-preview-copy"><small>Namecheap · December 21, 2016</small><strong>${esc(attachment.title)}</strong><p>${esc(attachment.description)}</p><span class="source-preview-open">View proof of transfer ↗</span></div></div></a>` : ''}</div>`;
  if (url) return `<a class="preview-link project-source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(project.title)} on ${isAppStoreProject(project) ? 'the App Store' : esc(domainOf(url))}">${linkPreview({...project,channel:'websites',kind:project.category})}</a>`;
  const image = safeImage(project.image);
  return `<button class="project-card" data-project="${esc(project.id)}" aria-label="View ${esc(project.title)}"><div class="project-preview">${image ? `<img src="${esc(image)}" alt="Preview of ${esc(project.title)}">` : '<div class="project-art">✦</div>'}<span class="preview-badge">${project.builtIn ? 'Original prototype' : 'Website'}</span></div><div class="project-details"><span class="project-category">${esc(project.category)}</span><h3>${esc(project.title)}</h3><p>${esc(project.description)}</p><div class="project-bottom"><span>Concept preview</span><b>Explore ↗</b></div></div></button>`;
}
function render() {
  if(activeChannel==='home')renderHome();
  else if(activeChannel==='private')globalThis.ReaderUI?.renderChannel();
  else if(activeChannel==='spider')SpiderGame.mount($('#content'));
  else renderChannel();
}
function renderHome() {$('#content').innerHTML=aboutThread();}
function linkPreview(entry) {
  const url = safeUrl(entry.url), metadata = {...(LINK_PREVIEWS[url] || {}),...(PUBLIC_PREVIEWS[url] || {})};
  const image = safeImage(entry.image) || ChannelFeeds.previewImage(entry.image) || publicPreviewAsset(metadata.image);
  const title = entry.channel==='websites' || entry.projectStatus ? entry.title : metadata.title || entry.title;
  const description = entry.channel==='websites' ? entry.description || metadata.description : metadata.description || entry.description;
  const site = metadata.site || entry.domain || domainOf(url) || entry.kind;
  const projectVisual=entry.channel==='websites'?projectPreviewVisual(entry,metadata,image):'';
  const artwork=image ? `<div class="source-preview-image"><img src="${esc(image)}" alt="${esc(title)} — preview from ${esc(site)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentElement.hidden=true;this.parentElement.nextElementSibling.hidden=false"></div>` : '';
  return `<div class="link-preview source-preview ${image ? 'has-source-image' : ''}">${projectVisual || artwork+domainPreview(url, metadata, !!image)}<div class="link-preview-copy"><small>${esc(site)}${domainOf(url) && site !== domainOf(url) ? ` · ${esc(domainOf(url))}` : ''}</small><strong>${esc(title)}</strong><p>${esc(description)}</p>${url ? '<span class="source-preview-open">Open original ↗</span>' : ''}</div></div>`;
}
function renderChannelFilters() {
  const records = channelRecords(activeChannel), options = ChannelFilters.options(records,activeChannel);
  const filter = channelFilters[activeChannel] ||= {type:'',year:'',status:'',query:''};
  const typeControls = activeChannel === 'websites'
    ? `<div class="filter-types" role="group" aria-label="Project type">${['',...options.types].map(type=>`<button type="button" data-filter-type="${esc(type)}" aria-pressed="${filter.type===type}">${type||'All'}</button>`).join('')}</div>`
    : options.types.length > 1 ? `<label class="filter-select">Type <select id="channelTypeFilter" aria-label="Filter by type"><option value="">All types</option>${options.types.map(type=>`<option ${filter.type===type?'selected':''}>${esc(type)}</option>`).join('')}</select></label>` : '';
  const statusOptions = activeChannel==='watch' ? ['Want to see','Want to listen','Want to read','Watching','Listening','Reading','Finished','Skipped','Not marked'] : ['To Read','Priority','Reading','Read','Archive','Not marked'];
  const statusControl = ['articles','watch'].includes(activeChannel) ? `<label class="filter-select">Tyler’s status <select id="channelStatusFilter" aria-label="Filter by Tyler’s status"><option value="">All statuses</option>${statusOptions.map(status=>`<option value="${status}" ${filter.status===status?'selected':''}>${status}</option>`).join('')}</select></label>` : '';
  $('#channelFilters').innerHTML = `${typeControls}${statusControl}${options.years.length > 1 ? `<label class="filter-select">Year <select id="channelYearFilter" aria-label="Filter by year"><option value="">All years</option>${options.years.map(year=>`<option ${filter.year===year?'selected':''}>${year}</option>`).join('')}</select></label>` : ''}<input id="channelQueryFilter" type="search" aria-label="Search this channel" placeholder="Search this channel…" value="${esc(filter.query)}"><span id="channelFilterCount" role="status" aria-live="polite"></span>`;
}
function applyChannelFilter() {
  renderChannel(false);
  positionChannelAtBottom();
}

function messageTimestamp(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '<span class="message-timestamp">from the collection</span>';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T12:00:00` : value);
  const options = {month:'short',day:'numeric',year:'numeric'};
  if (!dateOnly) Object.assign(options,{hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  return `<time class="message-timestamp" datetime="${esc(value)}">${esc(date.toLocaleString(undefined,options))}</time>`;
}
function messageAuthor(record) {
  if (record.channel === 'writing' && record.source === 'rss') return {name:'Betting Antelope',image:'assets/betting-antelope-textured.png',className:'publication-avatar'};
  if (record.channel === 'newsletters' && record.source === 'notion') return {name:'Daily Newsletter',image:'assets/daily-newsletter-avatar.png',className:'publication-avatar'};
  return {name:'Tyler',image:'assets/tyler-avatar.png',className:'tyler-avatar'};
}
function renderChannel(refreshControls=true) {
  const meta=channelMeta(activeChannel), records=channelRecords(activeChannel);
  if (refreshControls) renderChannelFilters();
  const filter=channelFilters[activeChannel] || {};
  const list=ChannelReadState.ordered(ChannelFilters.apply(records,activeChannel,filter));
  const filtered=!!(filter.type || filter.year || filter.status || filter.query?.trim());
  $('#channelFilterCount').textContent=`${list.length} of ${records.length}`;
  $('#lastReadButton').disabled=!list.some(record=>String(record.id)===String(sessionCheckpoint || sessionFirstUnread));
  const type=activeChannel==='websites'?'project':'entry';
  const body=list.map(record=>{
    const date=record.publishedAt||record.created;
    const author=messageAuthor(record);
    let attachment='';
    if(activeChannel==='websites') attachment=projectCard(record);
    else if(activeChannel==='photography') attachment=`<button class="chat-photo" data-entry="${esc(record.id)}">${safeImage(record.image)?`<img src="${esc(safeImage(record.image))}" alt="${esc(record.title)}">`:'<span class="photo-placeholder">▧</span>'}<strong>${esc(record.title)}</strong></button>`;
    else attachment=safeUrl(record.url)?`<a href="${esc(safeUrl(record.url))}" target="_blank" rel="noopener noreferrer" class="preview-link">${linkPreview(record)}</a>`:`<button class="preview-link" data-entry="${esc(record.id)}">${linkPreview(record)}</button>`;
    const divider=String(record.id)===sessionCheckpoint?'<div class="read-divider last-read-divider">You left off here</div>':record.id===sessionFirstUnread?'<div class="read-divider">New since your last visit</div>':'';
    return `${divider}<article class="message timeline-message" data-message-id="${esc(record.id)}"><div class="message-avatar ${author.className}"><img src="${author.image}" alt="" width="40" height="40"></div><div class="message-body"><div class="message-meta"><strong>${esc(author.name)}</strong>${VerifiedAuthor.trustedPost({...record,channel:activeChannel},publishedEntries,STARTER_PROJECTS)?VerifiedAuthor.badge():''}${['articles','watch'].includes(record.channel)?'<span class="saved-label">Saved</span>':''}${activeChannel==='websites'&&!date?'<span class="message-timestamp">Date not set</span>':messageTimestamp(date)}${record.readingStatus?`<span class="reading-status">${esc(record.readingStatus)}</span>`:''}</div><p>${ChannelFeeds.linkedText(record.note||record.description||'')}</p>${attachment}${globalThis.ReaderUI?.saveButton({...record,channel:activeChannel}) || ''}<button class="comment-link" data-${type}="${esc(record.id)}">♧ &nbsp; Comments · Open thread</button></div></article>`;
  }).join('');
  $('#content').innerHTML=`<div class="feed channel-feed"><div class="channel-intro"><div class="channel-symbol">#</div><h1>${esc(meta.title)}</h1><p>${ChannelFeeds.linkedText(meta.intro || meta.description, meta.introLinks || [])}</p>${safeUrl(meta.sourceUrl)?`<a class="channel-source-link" href="${esc(safeUrl(meta.sourceUrl))}" target="_blank" rel="noopener">${esc(meta.sourceLabel)}</a>`:''}</div><div class="feed-day">Beginning of #${esc(meta.title)}</div>${body||`<div class="empty-channel">${esc(filtered ? 'No matches. Try another filter or search.' : meta.empty || 'Nothing here yet. More to share soon.')}</div>`}<div class="feed-end">${filtered ? 'End of these results.' : 'You’re at the latest.'}</div></div>`;
}
function commentSection(type,id) {
  return globalThis.ReaderComments?.section(type,id) || '<p>Comments are being connected.</p>';
}
function showProject(project) {
  const image=safeImage(project.image),url=project.projectStatus==='Sold'?'':safeUrl(project.url);
  $('#modalRoot').innerHTML = `<div class="modal-overlay" data-close-modal><div class="modal detail-modal" role="dialog" aria-modal="true" aria-label="${esc(project.title)}"><div class="modal-top"><span class="eyebrow">${esc(project.category)}</span><button class="close-button" data-close-modal aria-label="Close">×</button></div><div class="modal-body"><h2>${esc(project.title)}</h2><p class="modal-description">${esc(project.description)}</p>${project.projectStatus==='Sold'?projectCard(project):image ? `<div class="modal-preview"><img src="${esc(image)}" alt="Preview of ${esc(project.title)}"></div>` : ''}<div class="modal-actions">${url ? `<a class="primary-button" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${isAppStoreProject(project) ? 'View on the App Store' : 'Visit website'} ↗</a>` : project.projectStatus==='Sold'?'':'<span class="empty-note">Original website prototype.</span>'}</div>${commentSection('project',project.id)}</div></div></div>`;
  bindCommentForm();
}
function showEntry(entry) {
  const image=safeImage(entry.image),url=safeUrl(entry.url);
  $('#modalRoot').innerHTML = `<div class="modal-overlay" data-close-modal><div class="modal detail-modal" role="dialog" aria-modal="true" aria-label="${esc(entry.title)}"><div class="modal-top"><span class="eyebrow">#${esc(channelMeta(entry.channel)?.title || entry.channel)} · ${esc(entry.kind)}</span><button class="close-button" data-close-modal aria-label="Close">×</button></div><div class="modal-body"><h2>${esc(entry.title)}</h2>${entry.body ? '' : `<p class="modal-description">${ChannelFeeds.linkedText(entry.description||'')}</p>`}${image ? `<div class="modal-preview"><img src="${esc(image)}" alt="${esc(entry.title)}"></div>` : ''}<p class="modal-description">${ChannelFeeds.linkedText(entry.note || '')}</p>${entry.body ? `<div class="digest-body">${ChannelFeeds.renderBody(entry)}</div><p class="digest-label">Agent-written highlights from my newsletter subscriptions.</p>` : ''}${entry.links?.length ? `<div class="digest-sources"><h3>Sources</h3>${entry.links.map(link => `<a href="${esc(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer">${esc(link.title)} ↗</a>`).join('')}</div>` : ''}<div class="modal-actions">${url ? `<a class="primary-button" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open link ↗</a>` : ''}${entry.source ? '' : `<button class="secondary-button" data-action="edit-entry" data-id="${esc(entry.id)}">Edit</button><button class="secondary-button delete" data-action="delete-entry" data-id="${esc(entry.id)}">Remove</button>`}</div>${commentSection('entry',entry.id)}</div></div></div>`;
  bindCommentForm();
}
function bindCommentForm() { globalThis.ReaderComments?.mount(); }
function closeModal() { $('#modalRoot').innerHTML=''; }
function readImage(file) { return new Promise((resolve,reject) => { const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error('Could not read image')); reader.readAsDataURL(file); }); }
function imageField(current) { return `<label class="field-label">Preview image<div class="upload-box">Upload an image<input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><span class="field-help">PNG, JPG, WebP, or GIF · up to 8 MB</span></div></label>${safeImage(current) ? `<img class="current-image" src="${esc(current)}" alt="Current preview">` : ''}`; }
function validImage(file) { return !file || (['image/png','image/jpeg','image/webp','image/gif'].includes(file.type) && file.size <= 8*1024*1024); }
function entryEditor(channel='articles',entry=null) {
  if (entry?.source || channelMeta(channel)?.managed) return;
  const editing=!!entry;
  $('#modalRoot').innerHTML=`<div class="modal-overlay" data-close-modal><div class="modal" role="dialog" aria-modal="true" aria-label="${editing?'Edit item':'Add an item'}"><div class="modal-top"><span class="eyebrow">${editing?'EDIT ITEM':'NEW ITEM'}</span><button class="close-button" data-close-modal aria-label="Close">×</button></div><div class="modal-body"><h2>${editing?'Edit item':'Add to the shelf'}</h2><p class="modal-description">The same item appears here and in its channel.</p><form id="entryForm" class="form-grid"><label class="field-label">Channel<select name="channel">${CHANNELS.filter(c=>c.id!=='websites'&&!c.managed).map(c=>`<option value="${c.id}" ${(entry?.channel||channel)===c.id?'selected':''}>${c.title}</option>`).join('')}</select></label><label class="field-label">Title<input name="title" value="${esc(entry?.title||'')}" maxlength="100" required></label><label class="field-label">Kind<input name="kind" value="${esc(entry?.kind||'')}" maxlength="50" placeholder="Article, video, blog post, photo…"></label><label class="field-label">Link<input name="url" type="url" value="${esc(entry?.url||'')}" placeholder="https://example.com"></label><label class="field-label">Description<textarea name="description" maxlength="300" required>${esc(entry?.description||'')}</textarea></label><label class="field-label">Why share it?<textarea name="note" maxlength="300">${esc(entry?.note||'')}</textarea></label>${imageField(entry?.image)}<span class="field-help">Changes made here are saved in this browser. Shared publishing needs a connected database.</span><div class="form-error" id="formError" role="alert"></div><div class="form-actions"><button class="secondary-button" type="button" data-close-modal>Cancel</button><button class="primary-button" type="submit">${editing?'Save changes':'Add item'}</button></div></form></div></div></div>`;
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
  const items={file:[['linkedin','in','LinkedIn ↗'],['email','✉','Email me'],['instagram','◎','Instagram ↗'],['twitter','𝕏','Twitter / X ↗']],rec:[['recommend','✦','Recommend something to me'],['drafts','▤','Saved drafts on this device']],view:[['surprise','▶','Surprise me with a video'],['spider','✳','Take a break']],window:[['show-shelf','✦','Show Tyler.Center'],['center-window','▣','Center window']]}[name];
  const rect=button.getBoundingClientRect();
  $('#desktopMenuHost').innerHTML=`<div class="desktop-dropdown" style="left:${Math.round(rect.left)}px">${items.map(([action,icon,label])=>`<button data-menu-action="${action}"><span>${icon}</span>${label}</button>`).join('')}</div>`;
}
function surpriseMe() {
  const videos=allEntries().filter(entry=>entry.channel==='watch'&&safeUrl(entry.url));
  if(!videos.length){toast('No watch-or-listen-later links are available yet.');return;}
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
  const query=$('#searchInput').value.trim().toLowerCase();if(!query){$('#searchResults').innerHTML='<div class="search-empty">Search apps, websites, articles, videos, writing, newsletters, and photos.</div>';return;}
  const results=[...projects.filter(p=>`${p.title} ${p.description}`.toLowerCase().includes(query)).map(p=>`<button class="search-result" data-search-project="${esc(p.id)}"><small>${isAppStoreProject(p) ? 'App' : 'Website'}</small><strong>${esc(p.title)}</strong><span>${esc(p.description)}</span></button>`),...allEntries().filter(e=>`${e.title} ${e.description} ${e.channel}`.toLowerCase().includes(query)).map(e=>`<button class="search-result" data-search-entry="${esc(e.id)}"><small>#${esc(e.channel)}</small><strong>${esc(e.title)}</strong><span>${esc(e.description)}</span></button>`),...CHANNELS.filter(c=>`${c.title} ${c.description}`.toLowerCase().includes(query)).map(c=>`<button class="search-result" data-channel="${esc(c.id)}"><small>Channel</small><strong>#${esc(c.title)}</strong><span>${esc(c.description)}</span></button>`)];
  $('#searchResults').innerHTML=results.length?results.join(''):'<div class="search-empty">No matches yet.</div>';
}
function closeSidebar() {$('#sidebar').classList.remove('open');$('#mobileScrim').hidden=true;}
function toggleSidebar() {const open=$('#sidebar').classList.toggle('open');$('#mobileScrim').hidden=!open;}
function updateDesktopClock() {$('#desktopClock').textContent=new Date().toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}

document.addEventListener('click',async event=>{
  const target=event.target;
  const rocket=target.closest('[data-unread-menu]');if(rocket){openRocketMenu(rocket);return;}
  const mark=target.closest('[data-mark-read]');if(mark){markChannelRead(mark.dataset.markRead);return;}
  if(!target.closest('.rocket-menu'))closeRocketMenu();
  const caseFile=target.closest('[data-case-study]');if(caseFile){showCaseStudy(Number(caseFile.dataset.caseStudy));return;}
  const menuButton=target.closest('[data-menu]');if(menuButton){openDesktopMenu(menuButton.dataset.menu,menuButton);return;}
  const menuAction=target.closest('[data-menu-action]');if(menuAction){const action=menuAction.dataset.menuAction;closeDesktopMenu();$('#desktopMenuHost').dataset.open='';if(action==='spider')showShelf(action);if(action==='linkedin')openLinkedIn();if(action==='email')contactEmail()?window.location.href=`mailto:${contactEmail()}`:toast('Add Tyler’s email to enable this link.');if(action==='instagram')instagramUrl()?window.open(instagramUrl(),'_blank','noopener,noreferrer'):toast('Add Tyler’s Instagram profile to enable this link.');if(action==='twitter')window.open(safeUrl(CONTACT.twitter),'_blank','noopener,noreferrer');if(action==='recommend')recommendModal();if(action==='drafts')draftsModal();if(action==='surprise')surpriseMe();if(action==='show-shelf')showShelf();if(action==='center-window'){const element=$('#appWindow');element.style.left='';element.style.top='';element.style.transform='';toast('Window centered.');}return;}
  if(!target.closest('.desktop-dropdown')){closeDesktopMenu();$('#desktopMenuHost').dataset.open='';}
  const channel=target.closest('[data-channel]');if(channel){closeSearch();showShelf(channel.dataset.channel);return;}
  const project=target.closest('[data-project]');if(project){const record=projects.find(item=>item.id===project.dataset.project);if(record)showProject(record);return;}
  const entry=target.closest('[data-entry]');if(entry){const record=allEntries().find(item=>item.id===entry.dataset.entry);if(record)showEntry(record);return;}
  const searchProject=target.closest('[data-search-project]');if(searchProject){const record=projects.find(item=>item.id===searchProject.dataset.searchProject);closeSearch();showShelf('websites');if(record)showProject(record);return;}
  const searchEntry=target.closest('[data-search-entry]');if(searchEntry){const record=allEntries().find(item=>item.id===searchEntry.dataset.searchEntry);closeSearch();if(record){showShelf(record.channel);showEntry(record);}return;}
  const actionButton=target.closest('[data-action]');if(actionButton){const action=actionButton.dataset.action,id=actionButton.dataset.id;if(action==='wallpaper-credit')wallpaperCredit();if(action==='edit-entry'){const record=entries.find(item=>item.id===id);if(record)entryEditor(record.channel,record);}if(action==='delete-entry'){const record=entries.find(item=>item.id===id);if(record&&confirm(`Remove "${record.title}" from this browser?`)){try{await removeRecord('entry',id);closeModal();toast('Item removed.');}catch{toast('Could not remove the item.');}}}if(action==='add-entry')entryEditor(activeChannel);if(action==='surprise')surpriseMe();return;}
  if(target.closest('[data-close-modal]')&&(target===target.closest('[data-close-modal]')||target.closest('[data-close-modal]').tagName==='BUTTON')){closeModal();return;}
  if(target.closest('[data-close-search]')&&(target===target.closest('[data-close-search]')||target.tagName==='BUTTON'))closeSearch();
});
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openSearch();}if(event.key==='Escape'){closeRocketMenu(true);closeSearch();closeModal();closeDesktopMenu();closeSidebar();}});
$('#channelFilters').addEventListener('click',event=>{
  const button=event.target.closest('[data-filter-type]');if(!button)return;
  channelFilters[activeChannel].type=button.dataset.filterType;
  $('#channelFilters').querySelectorAll('[data-filter-type]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  applyChannelFilter();
});
$('#channelFilters').addEventListener('input',event=>{
  if(event.target.id!=='channelQueryFilter')return;
  channelFilters[activeChannel].query=event.target.value;applyChannelFilter();
});
$('#channelFilters').addEventListener('change',event=>{
  const key={channelTypeFilter:'type',channelYearFilter:'year',channelStatusFilter:'status'}[event.target.id];
  if(key){channelFilters[activeChannel][key]=event.target.value;applyChannelFilter();}
});
document.addEventListener('error',event=>{
  if(event.target.matches?.('.source-preview-image img')) {
    event.target.closest('.source-preview-image').hidden=true;
    event.target.closest('.source-preview').classList.remove('has-source-image');
  }
},true);
$('#searchTrigger').addEventListener('click',openSearch);
$('#headerSearch').addEventListener('click',openSearch);
$('#headerAdd').addEventListener('click',()=>{if(activeChannel!=='websites' && channelMeta(activeChannel))entryEditor(activeChannel);});
$('#lastReadButton').addEventListener('click',jumpToLastRead);
$('#latestButton').addEventListener('click',()=>{$('#contentScroll').scrollTo({top:$('#contentScroll').scrollHeight,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});});
$('#contentScroll').addEventListener('scroll',()=>{clearTimeout(readingTimer);readingTimer=setTimeout(markVisibleMessages,200);},{passive:true});
$('#mobileMenu').addEventListener('click',toggleSidebar);
$('#mobileScrim').addEventListener('click',closeSidebar);
$('#windowClose').addEventListener('click',hideShelf);
$('#windowMinimize').addEventListener('click',hideShelf);
$('#windowZoom').addEventListener('click',()=>toggleZoom($('#appWindow')));
document.querySelectorAll('[data-desktop-open]').forEach(button=>button.addEventListener('click',()=>showShelf(button.dataset.desktopOpen)));
$('#appWindow').addEventListener('pointerdown',()=>bringFront($('#appWindow')));
makeDraggable($('#appWindow'),$('#appWindow .topbar'));
makeResizable($('#appWindow'),$('#windowResize'));
updateDesktopClock();setInterval(updateDesktopClock,30000);
initializeLinkedIn();
initialize();
