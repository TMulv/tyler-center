/* Per-browser read markers; no account or tracking service required. */
(function (root) {
  function revision(record) {
    const content = JSON.stringify(Object.keys(record).sort().map(key => [key, record[key]]));
    // Keep stored markers small even when a record contains a local image.
    let hash = 2166136261;
    for (let i = 0; i < content.length; i++) hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
    return `${content.length}:${hash >>> 0}`;
  }
  function normalize(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }
  function count(records, state, channel) {
    const seen = normalize(normalize(state)[channel]);
    return records.filter(record => !Object.hasOwn(seen, record.id) || seen[record.id] !== revision(record)).length;
  }
  function markRead(records, state, channel) {
    return {...normalize(state), [channel]: Object.fromEntries(records.map(record => [record.id, revision(record)]))};
  }
  const api = {count, markRead};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChannelReadState = api;
})(globalThis);
