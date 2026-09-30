(function(root) {
  'use strict';
  function validate(payload, channel) {
    if (payload?.version !== 1 || !Array.isArray(payload.entries)) throw new Error('Invalid feed');
    const seen = new Set();
    return payload.entries.map(item => {
      if (!item || item.channel !== channel || typeof item.id !== 'string' || seen.has(item.id) ||
          !item.id.startsWith(channel === 'writing' ? 'rss-' : 'digest-') ||
          typeof item.title !== 'string' || !item.title.trim() || !Number.isFinite(Date.parse(item.publishedAt))) {
        throw new Error('Invalid feed entry');
      }
      seen.add(item.id);
      const entry = {id:item.id, channel, source:channel === 'writing' ? 'rss' : 'notion', publishedAt:item.publishedAt};
      for (const key of ['title','kind','domain','description','body']) entry[key] = typeof item[key] === 'string' ? item[key] : '';
      entry.url = link(item.url);
      if (previewImage(item.image)) entry.image = previewImage(item.image);
      entry.links = Array.isArray(item.links) ? item.links.filter(l => l && typeof l === 'object').map(l => ({title:String(l.title || ''),text:String(l.text || ''),url:link(l.url)})).filter(l => l.url) : [];
      entry.blocks = Array.isArray(item.blocks) ? item.blocks.filter(b => b && Array.isArray(b.runs)).map(b => ({
        type:['heading_1','heading_2','heading_3','bulleted_list_item','numbered_list_item','quote'].includes(b.type) ? b.type : 'paragraph',
        runs:b.runs.filter(r => r && typeof r.text === 'string').map(r => ({text:r.text,url:link(r.url),bold:r.bold === true,italic:r.italic === true}))
      })) : [];
      return entry;
    });
  }
  function link(value) {
    try {
      const url = new URL(value);
      const privateHosts = ['mail.google.com','gmail.com','outlook.com','outlook.office.com','notion.so','notion.com','accounts.google.com','localhost'];
      if (privateHosts.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) return '';
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch {return '';}
  }
  function previewImage(value) {
    const safe = link(value);
    if (!safe || !safe.startsWith('https://')) return '';
    const host = new URL(safe).hostname;
    return /^(?:is\d+-ssl\.mzstatic\.com|substackcdn\.com|substack-post-media\.s3\.amazonaws\.com|i\.ytimg\.com|(?:www\.)?waitbutwhy\.com|maggieappleton\.com|images\.ctfassets\.net)$/.test(host) ? safe : '';
  }
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const anchor = (text,url) => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(text)}</a>`;
  function linkedText(text, sources=[]) {
    const named = sources.filter(s => s.text && link(s.url)).sort((a,b) => b.text.length-a.text.length);
    const escaped = named.map(s => s.text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    const matcher = new RegExp([...escaped, 'https?:\\/\\/[^\\s<>]+'].join('|'),'g');
    let result='', start=0;
    for (const match of String(text).matchAll(matcher)) {
      result += escape(text.slice(start,match.index));
      const source = named.find(s => s.text === match[0]);
      const candidate = source?.url || match[0].replace(/[.,;!?\)\]]+$/,'');
      const url = link(candidate);
      result += url ? anchor(source ? match[0] : candidate,url) + (source ? '' : escape(match[0].slice(candidate.length))) : escape(match[0]);
      start=match.index+match[0].length;
    }
    return result+escape(text.slice(start));
  }
  function renderBody(entry) {
    if (!entry.blocks?.length) return String(entry.body || '').split(/\n\n+/).map(p => `<p>${linkedText(p,entry.links)}</p>`).join('');
    return entry.blocks.map(block => {
      const tag = block.type.startsWith('heading_') ? 'h3' : block.type === 'quote' ? 'blockquote' : 'p';
      const bullet = ['bulleted_list_item','numbered_list_item'].includes(block.type) ? '• ' : '';
      const text = block.runs.map(run => {
        let html = link(run.url) ? anchor(run.text,link(run.url)) : linkedText(run.text,entry.links);
        if (run.bold) html = `<strong>${html}</strong>`;
        if (run.italic) html = `<em>${html}</em>`;
        return html;
      }).join('');
      return `<${tag}>${bullet}${text}</${tag}>`;
    }).join('');
  }
  function merge(local, published) {
    const sharedIds = new Set(published.map(e => e.id));
    return [...local.filter(e => e.id !== 'why-site' && !sharedIds.has(e.id)), ...published];
  }
  root.ChannelFeeds = {validate, merge, linkedText, renderBody, previewImage};
  if (typeof module !== 'undefined') module.exports = root.ChannelFeeds;
})(globalThis);
