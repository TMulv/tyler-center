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
      entry.links = Array.isArray(item.links) ? item.links.map(l => ({title:String(l.title || ''),url:link(l.url)})).filter(l => l.url) : [];
      return entry;
    });
  }
  function link(value) {
    try {const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';} catch {return '';}
  }
  function merge(local, published) {
    const sharedIds = new Set(published.map(e => e.id));
    return [...local.filter(e => e.id !== 'why-site' && !sharedIds.has(e.id)), ...published];
  }
  root.ChannelFeeds = {validate, merge};
  if (typeof module !== 'undefined') module.exports = root.ChannelFeeds;
})(globalThis);
