/* The public digest archive, presented as a desktop inbox. */
(function(root) {
  function editions(records) {
    return records.filter(record=>record.channel==='newsletters' && record.source==='notion')
      .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt) || String(a.id).localeCompare(String(b.id)));
  }
  function mount(config) {
    const win=document.querySelector('#emailWindow');
    const escape=config.escape;
    let selected=null, opener=null, renderedRevision='', feedStatus='loading';
    const filter={query:'',source:'',month:''};
    const records=()=>editions(config.getRecords());
    const date=(value,long=false)=>new Date(value).toLocaleDateString(undefined,long?{weekday:'long',month:'long',day:'numeric',year:'numeric'}:{month:'short',day:'numeric',year:'numeric'});
    win.innerHTML=`<header class="email-titlebar"><div class="email-window-controls"><button type="button" data-mail-close aria-label="Close Email" title="Close Email">×</button><button type="button" data-mail-minimize aria-label="Minimize Email" title="Minimize Email">−</button><button type="button" data-mail-zoom aria-label="Expand Email window" title="Expand Email window">↗</button></div><strong>✉ &nbsp; Email</strong><button type="button" class="email-return" data-mail-messages>Back to messages</button></header>
      <div class="email-layout"><aside class="email-inbox" aria-label="Newsletter inbox"><div class="email-inbox-heading"><div><span class="email-eyebrow">DAILY NEWSLETTER</span><h1>Inbox</h1></div><span id="emailInboxCount" role="status"></span></div>
      <details class="email-about"><summary>About this inbox</summary><p>I subscribe to a ton of newsletters, both paid and free. Sometimes I don't have a chance to read them, so this is a live feed of a Frankenstein version of my newsletter: the most interesting or important articles that I don't want to fall through the cracks.</p><p>Agent-written digests from my subscriptions. New editions arrive here automatically.</p></details>
      <div class="email-search-controls"><input id="emailQuery" type="search" placeholder="Search editions…" aria-label="Search newsletter editions"><details class="email-filters"><summary>Filters<span id="emailFilterCount"></span></summary><div><label>Source<select id="emailSource" aria-label="Filter editions by source"></select></label><label>Month<select id="emailMonth" aria-label="Filter editions by month"></select></label><small>Sources match publishers linked inside each edition.</small><button type="button" data-mail-clear>Clear filters</button></div></details></div>
      <p id="emailSyncStatus" class="email-sync-status" role="status"></p><div id="emailList" class="email-list" aria-label="Editions, newest first"></div></aside>
      <section class="email-reading-pane" aria-label="Read newsletter"><div class="email-reading-tools"><button type="button" data-mail-inbox>← Inbox</button><span>Daily Newsletter</span><button type="button" data-mail-fullscreen>Full screen ↗</button></div><div id="emailReader" class="email-reader" tabindex="0" aria-label="Newsletter reading area"></div></section></div>
      <button id="emailResize" class="window-resize-handle" aria-label="Resize Email window" title="Drag to resize. Arrow keys also work."></button>`;
    const $=selector=>win.querySelector(selector);
    const mark=record=>config.markRead(record);
    function updateBadge() {
      const count=records().filter(config.isUnread).length;
      document.querySelectorAll('[data-email-unread]').forEach(el=>{el.textContent=count;el.hidden=!count;});
      document.querySelector('[data-open-email].desktop-icon')?.setAttribute('aria-label',`Open Email${count?', '+count+' unread editions':''}`);
    }
    function renderList() {
      const all=records(), visible=root.ChannelFilters.apply(all,'newsletters',filter);
      const scroll=$('#emailList').scrollTop;
      $('#emailInboxCount').textContent=visible.length===all.length?`${all.length} editions`:`${visible.length} of ${all.length}`;
      $('#emailList').innerHTML=visible.length?visible.map(record=>`<button type="button" class="email-item ${config.isUnread(record)?'is-unread':''} ${record.id===selected?'is-selected':''}" data-mail-id="${escape(record.id)}" ${record.id===selected?'aria-current="true"':''} aria-label="${escape(record.title)}${config.isUnread(record)?', unread':''}"><span class="email-item-meta"><span class="email-sender">Daily Newsletter</span><time datetime="${escape(record.publishedAt)}">${escape(date(record.publishedAt))}</time></span><strong>${escape(record.title)}</strong><span class="email-excerpt">${escape(record.description || '')}</span></button>`).join(''):`<p class="email-empty-list">${all.length?'No editions match. Try another source or search.':feedStatus==='loading'?'Loading editions…':feedStatus==='error'?'The inbox could not be loaded. Please try again shortly.':'The next digest will arrive here.'}</p>`;
      $('#emailList').scrollTop=scroll;
      $('#emailFilterCount').textContent=(filter.source||filter.month)?' · '+[filter.source,filter.month].filter(Boolean).length:'';
      updateBadge();
    }
    function updateOptions() {
      const options=root.ChannelFilters.options(records(),'newsletters');
      const source=$('#emailSource'),month=$('#emailMonth');
      source.innerHTML='<option value="">All sources</option>'+options.sources.map(s=>`<option value="${escape(s)}">${escape(s)}</option>`).join('');
      const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
      month.innerHTML='<option value="">All months</option>'+options.months.map(m=>`<option value="${m}">${months[Number(m)-1]}</option>`).join('');
      if(filter.source && !options.sources.includes(filter.source))filter.source='';
      if(filter.month && !options.months.includes(filter.month))filter.month='';
      source.value=filter.source;month.value=filter.month;
    }
    function renderReader(reset=false) {
      const record=records().find(r=>r.id===selected);
      const reader=$('#emailReader');
      if(!record) {
        selected=null;renderedRevision='';win.classList.remove('reading-email');
        reader.innerHTML='<div class="email-welcome"><span aria-hidden="true">✉</span><h2>A little room to read.</h2><p>Choose an edition from the inbox.<br>Just the Daily Newsletter, all in one place.</p></div>';
        return;
      }
      const revision=JSON.stringify(record);
      if(!reset && renderedRevision===revision)return;
      const scroll=reader.scrollTop;
      renderedRevision=revision;
      const links=(record.links || []).filter(link=>config.safeUrl(link.url));
      reader.innerHTML=`<article class="email-letter"><div class="email-letter-meta"><img src="assets/daily-newsletter-avatar.png" alt="" width="42" height="42"><div><strong>Daily Newsletter</strong><time datetime="${escape(record.publishedAt)}">${escape(date(record.publishedAt,true))}</time></div></div><h1 tabindex="-1">${escape(record.title)}</h1><div class="email-letter-rule"></div><div class="digest-body">${root.ChannelFeeds.renderBody(record)}</div>${links.length?`<footer class="email-sources"><h2>From this edition</h2>${links.map(link=>`<a href="${escape(config.safeUrl(link.url))}" target="_blank" rel="noopener noreferrer">${escape(link.title || new URL(link.url).hostname)} ↗</a>`).join('')}</footer>`:''}<p class="email-signoff">Agent-written highlights from my newsletter subscriptions.</p></article>`;
      reader.scrollTop=reset?0:scroll;
      if(reset)$('.email-letter h1').focus({preventScroll:true});
    }
    function refresh(status) {
      if(status)feedStatus=status;
      $('#emailSyncStatus').textContent=feedStatus==='error'?(records().length?'Couldn’t refresh. The last received editions are still here.':'Couldn’t load the inbox. We’ll retry automatically.'):'';
      $('#emailSyncStatus').hidden=feedStatus!=='error';
      updateOptions();renderReader();renderList();
    }
    function select(id) {
      const record=records().find(r=>r.id===id);
      if(!record)return;
      selected=id;win.classList.add('reading-email');mark(record);renderReader(true);renderList();
    }
    function open(id) {
      if(win.hidden)opener=document.activeElement;
      config.beforeOpen();win.hidden=false;config.bringFront(win);refresh();
      if(id)select(id);else if(!selected)$('#emailQuery').focus();
    }
    async function close() {
      if(document.fullscreenElement===win)await document.exitFullscreen().catch(()=>{});
      win.hidden=true;
      if(matchMedia('(max-width:760px)').matches){config.showMessages();document.querySelector('#mobileMenu')?.focus();return;}
      const target=opener?.isConnected && opener.getClientRects().length?opener:document.querySelector('[data-open-email]');
      target?.focus();
    }
    function inbox() {
      win.classList.remove('reading-email');
      if(matchMedia('(max-width:760px)').matches)$('#emailList [aria-current]')?.focus();else $('#emailQuery').focus();
    }
    $('#emailQuery').addEventListener('input',event=>{filter.query=event.target.value;renderList();});
    $('#emailSource').addEventListener('change',event=>{filter.source=event.target.value;renderList();});
    $('#emailMonth').addEventListener('change',event=>{filter.month=event.target.value;renderList();});
    win.addEventListener('pointerdown',()=>config.bringFront(win));
    win.addEventListener('click',async event=>{
      const row=event.target.closest('[data-mail-id]');if(row){select(row.dataset.mailId);return;}
      if(event.target.closest('[data-mail-messages]')){await close();config.showMessages();return;}
      if(event.target.closest('[data-mail-close],[data-mail-minimize]')){await close();return;}
      if(event.target.closest('[data-mail-zoom]')){
        config.zoom(win);
        const button=$('[data-mail-zoom]'), label=win.classList.contains('zoomed')?'Restore Email window':'Expand Email window';
        button.setAttribute('aria-label',label);button.title=label;return;
      }
      if(event.target.closest('[data-mail-inbox]')){inbox();return;}
      if(event.target.closest('[data-mail-clear]')){filter.query='';filter.source='';filter.month='';$('#emailQuery').value='';updateOptions();renderList();$('.email-filters').open=false;$('.email-filters summary').focus();return;}
      if(event.target.closest('[data-mail-fullscreen]')){
        try {
          if(document.fullscreenElement===win)await document.exitFullscreen();
          else if(win.requestFullscreen)await win.requestFullscreen();
          else config.zoom(win);
        } catch {config.zoom(win);}
      }
    });
    document.addEventListener('fullscreenchange',()=>{$('[data-mail-fullscreen]').textContent=document.fullscreenElement===win?'Exit full screen ↙':'Full screen ↗';});
    document.querySelectorAll('[data-open-email]').forEach(button=>button.addEventListener('click',()=>open()));
    config.draggable(win,$('.email-titlebar'));config.resizable(win,$('#emailResize'));
    refresh();
    return {open,refresh,close};
  }
  const api={editions,mount};
  if(typeof module!=='undefined' && module.exports)module.exports=api;else root.EmailApp=api;
})(globalThis);
