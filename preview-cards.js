// Metadata comes from the site's public, server-fetched link cache.
let PUBLIC_PREVIEWS = {};
function publicPreviewAsset(value) {
  try {
    const u=new URL(value);
    if(u.protocol!=='https:' || u.username || u.password || !u.hostname.includes('.') || /^(?:[0-9.]+|\[)/.test(u.hostname))return '';
    if(['localhost','local','internal','notion.so','notion.com','notion-static.com','notionusercontent.com','mail.google.com'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))return '';
    return u.href;
  }catch{return '';}
}
async function refreshLinkPreviews() {
  try {
    const response=await fetch('data/previews.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)return;
    const data=await response.json();
    if(data.version!==1 || !data.previews || Array.isArray(data.previews))return;
    const records={};
    for(const [url,p] of Object.entries(data.previews)){
      if(!p || typeof p!=='object')continue;
      records[url]={};
      for(const key of ['title','description','site','domain'])if(typeof p[key]==='string' && p[key])records[url][key]=p[key].slice(0,500);
      for(const key of ['image','icon'])if(publicPreviewAsset(p[key]))records[url][key]=publicPreviewAsset(p[key]);
    }
    const changed=JSON.stringify(PUBLIC_PREVIEWS)!==JSON.stringify(records);
    PUBLIC_PREVIEWS=records;
    return changed;
  }catch{/* Existing cards remain available if a refresh fails. */}
}
function domainPreview(url,metadata,hidden=false) {
  if(!url)return '';
  const domain=domainOf(url),icon=publicPreviewAsset(metadata.icon);
  return `<div class="domain-preview" ${hidden?'hidden':''}><span class="domain-preview-mark" aria-hidden="true">${icon?`<img src="${esc(icon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true">`:esc(domain.slice(0,1).toUpperCase())}</span><span class="domain-preview-address">${esc(domain)}</span><span class="domain-preview-arrow" aria-hidden="true">↗</span></div>`;
}
