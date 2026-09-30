(function(root) {
  function type(record, channel) {
    if (channel === 'watch') return record.mediaType || record.kind || 'Other';
    if (channel === 'websites') {
      try { if (new URL(record.url).hostname === 'apps.apple.com') return 'Apps'; } catch {}
      return /\bapp\b/i.test(record.category || '') ? 'Apps' : 'Websites';
    }
    return (record.kind || ({articles:'Article',watch:'Video',writing:'Betting Antelope',newsletters:'Digest',photography:'Photo'})[channel] || 'Item').split(' · ')[0];
  }
  function year(record) {
    const value = record.publishedAt || record.created || '';
    return Number.isFinite(Date.parse(value)) ? value.slice(0,4) : '';
  }
  function options(records, channel) {
    return {types: channel === 'websites' ? ['Apps','Websites'] : channel === 'watch' ? ['YouTube','Online','Movies','TV Shows','Podcasts','Documentaries','Books','Other'] : [...new Set(records.map(r=>type(r,channel)))].sort(),
      years:[...new Set(records.map(year).filter(Boolean))].sort().reverse()};
  }
  function apply(records, channel, filter={}) {
    const query = String(filter.query || '').trim().toLocaleLowerCase();
    return records.filter(record => (!filter.type || type(record,channel) === filter.type) &&
      (!filter.year || year(record) === filter.year) &&
      (!filter.status || record.readingStatus === filter.status) &&
      (!query || [record.title,record.description,record.note,record.body,record.category,record.domain].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)));
  }
  const api = {type,options,apply};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChannelFilters = api;
})(globalThis);
