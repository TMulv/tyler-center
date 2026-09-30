(function(root) {
  const badge=()=>'<span class="verified-owner" role="img" aria-label="Verified Tyler — site owner" title="Verified Tyler · site owner">✓</span>';
  function trustedPost(record, published, builtIns) {
    if (record.channel==='writing' || record.channel==='newsletters') return false;
    return published.some(p=>p.id===record.id && p.channel===record.channel && p.source==='notion') ||
      (record.channel==='websites' && builtIns.some(p=>p.id===record.id));
  }
  // Only RPC-returned server identities use this path. Display names never verify anyone.
  const commentBadge=record=>record.is_owner === true ? badge() : '';
  const api={badge,trustedPost,commentBadge};
  if(typeof module!=='undefined')module.exports=api;else root.VerifiedAuthor=api;
})(globalThis);
