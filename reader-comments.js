(function(root) {
  let threadVersion=0;
  const account=()=>root.ReaderUI?.account;
  function section(type,id) {
    return `<section class="comment-section" id="sharedComments" data-type="${esc(type)}" data-id="${esc(id)}"><h3>Comments</h3><div id="sharedCommentList" aria-live="polite"></div><div id="sharedCommentComposer"></div></section>`;
  }
  function composer() {
    const host=$('#sharedCommentComposer');if(!host)return;
    const a=account(),state=a?.state();
    if(!a?.commentsEnabled){host.innerHTML='<p class="comment-disclosure">Account sign-in and public comments are still being connected.</p><button class="secondary-button" data-reader-action="guide">How channels and comments work</button>';return;}
    if(!state?.profile){host.innerHTML='<p class="comment-disclosure">Sign in to comment under your username. Comments here are public; your saved channel stays private.</p><button class="primary-button" data-reader-action="account">Sign in to comment</button>';return;}
    host.innerHTML=`<form id="sharedCommentForm"><p class="comment-disclosure">Posting as <strong>${esc(state.profile.username)}</strong>. Your comment will be public.</p><label>Leave a comment<textarea name="body" required maxlength="600" rows="3" placeholder="What did you think?"></textarea></label><p id="sharedCommentError" role="alert" class="form-error"></p><button class="primary-button" type="submit">Post comment</button></form>`;
  }
  async function load() {
    const section=$('#sharedComments');if(!section)return;
    const version=++threadVersion,{type,id}=section.dataset;
    composer();
    if(!account()?.commentsEnabled)return;
    $('#sharedCommentList').textContent='Loading comments…';
    try {
      const rows=await account().listComments(type,id);
      if(version!==threadVersion || $('#sharedComments')!==section)return;
      $('#sharedCommentList').innerHTML=rows.length ? `<p class="comment-disclosure">${rows.length===100?'Latest 100 comments':`${rows.length} comments`}</p>`+rows.slice().reverse().map(r=>`<div class="comment"><span class="comment-avatar" aria-hidden="true">${esc(r.username.slice(0,1).toUpperCase())}</span><div><strong>${esc(r.is_owner?'Tyler':r.username)}</strong>${VerifiedAuthor.commentBadge(r)}${messageTimestamp(r.created_at)}<p>${esc(r.body)}</p></div></div>`).join('') : '<p class="no-comments">No comments yet. Start the conversation.</p>';
    } catch(e) {if($('#sharedComments')===section)$('#sharedCommentList').innerHTML='<p role="alert">Comments could not load.</p><button class="secondary-button" data-retry-comments>Try again</button>';}
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-retry-comments]'))load();});
  document.addEventListener('submit',async e=>{
    if(e.target.id!=='sharedCommentForm')return;e.preventDefault();
    const form=e.target,section=$('#sharedComments'),button=form.querySelector('button'),body=form.elements.body.value.trim();
    if(!body||button.disabled)return;
    button.disabled=true;$('#sharedCommentError').textContent='';
    try {await account().postComment(section.dataset.type,section.dataset.id,body);if($('#sharedComments')===section)await load();toast('Comment posted.');}
    catch(error){if(form.isConnected)$('#sharedCommentError').textContent=error.message;}
    finally{button.disabled=false;}
  });
  let identity='';
  account()?.subscribe(state=>{
    const next=`${state.user?.id||''}:${state.profile?.username||''}`;
    if(next!==identity){identity=next;if($('#sharedComments'))composer();}
  });
  root.ReaderComments={section,mount:load};
})(globalThis);
