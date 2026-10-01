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
  function month(record) {
    return year(record) ? (record.publishedAt || record.created).slice(5,7) : '';
  }
  function sources(record, channel) {
    const urls = channel === 'newsletters' ? (record.links || []).map(link=>link.url) : [record.url];
    return [...new Set(urls.map(value=>{
      try {
        const url = new URL(value);
        return /^https?:$/.test(url.protocol) ? url.hostname.toLowerCase().replace(/^www\./,'') : '';
      } catch { return ''; }
    }).filter(Boolean))];
  }
  function options(records, channel) {
    return {types: channel === 'websites' ? ['Apps','Websites'] : channel === 'watch' ? ['YouTube','Online','Movies','TV Shows','Podcasts','Documentaries','Books','Other'] : [...new Set(records.map(r=>type(r,channel)))].sort(),
      years:[...new Set(records.map(year).filter(Boolean))].sort().reverse(),
      months:[...new Set(records.map(month).filter(Boolean))].sort(),
      sources:[...new Set(records.flatMap(r=>sources(r,channel)))].sort(),
      hasMissingSource:records.some(r=>!sources(r,channel).length)};
  }
  function apply(records, channel, filter={}) {
    const query = String(filter.query || '').trim().toLocaleLowerCase();
    return records.filter(record => (!filter.type || type(record,channel) === filter.type) &&
      (!filter.year || year(record) === filter.year) &&
      (!filter.month || month(record) === filter.month) &&
      (!filter.source || (filter.source === '__none__' ? !sources(record,channel).length : sources(record,channel).includes(filter.source))) &&
      (!filter.status || record.readingStatus === filter.status) &&
      (!query || [record.title,record.description,record.note,record.body,record.category,record.domain,...sources(record,channel)].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)));
  }
  const api = {type,sources,options,apply};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChannelFilters = api;
})(globalThis);
