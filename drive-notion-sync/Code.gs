/**
 * One Google Doc becomes one Notion edition. The existing 15-minute trigger
 * captures the first available Doc text in each New York time window.
 */
const NEWSLETTER_FOLDER_ID = '1mhNmOwgL3lBMlrWAdNZQNiHZ3uZ-Lk9o';
const NOTION_EDITIONS_DATA_SOURCE_ID = 'aab9f113-6439-4714-9185-0cc08f9d70df';
const NOTION_VERSION = '2026-03-11';
const NEWSLETTER_TIME_ZONE = 'America/New_York';
const SNAPSHOT_WINDOWS = [
  { hour: 10, name: 'Morning edition' },
  { hour: 12, name: 'Midday pass' },
  { hour: 16, name: 'Afternoon edition' },
  { hour: 20, name: 'Evening edition' }
];

function syncNewsletterDocs() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const token = PropertiesService.getScriptProperties().getProperty('NOTION_TOKEN');
    if (!token) throw new Error('Set NOTION_TOKEN in Script properties before running the sync.');
    const existing = getEditionPages_(token);
    const now = new Date();
    const today = Utilities.formatDate(now, NEWSLETTER_TIME_ZONE, 'yyyy-MM-dd');
    const hour = Number(Utilities.formatDate(now, NEWSLETTER_TIME_ZONE, 'H'));
    const window = [...SNAPSHOT_WINDOWS].reverse().find(item => hour >= item.hour);
    const files = DriveApp.getFolderById(NEWSLETTER_FOLDER_ID).getFilesByType(MimeType.GOOGLE_DOCS);
    const pending = [];
    while (files.hasNext()) {
      const file = files.next();
      const title = file.getName().replace(/\.md$/i, '').trim();
      if (title) pending.push({ file, title });
    }
    pending.sort((a, b) => a.file.getDateCreated() - b.file.getDateCreated());
    let created = 0, captured = 0;
    for (const { file, title } of pending) {
      const key = title.toLocaleLowerCase();
      const page = existing.get(key);
      const date = editionDate_(title);
      if (date === today && !window) continue;
      if (date !== today || !window) {
        // Historical Docs keep the old one-time import behavior. A future-dated
        // Doc waits for its own day rather than appearing early.
        if (page || (date && date > today)) continue;
        const markdown = checkedDocText_(file.getId(), title);
        const result = notionRequest_('post', '/pages', token, {
          parent: { type: 'data_source_id', data_source_id: NOTION_EDITIONS_DATA_SOURCE_ID },
          properties: { Name: { title: [{ text: { content: title } }] } },
          markdown
        });
        existing.set(key, result.id);
        created++;
        Logger.log('Published historical newsletter edition: ' + title);
        continue;
      }
      if (page) {
        const snapshots = snapshotNames_(token, page);
        // Never overwrite a manually written or legacy page with the same title.
        if (!snapshots.length || snapshots.includes(window.name)) continue;
      }
      const markdown = checkedDocText_(file.getId(), title);
      const snapshot = snapshotBlock_(window.name, markdown);
      const overflow = snapshot.toggle.children.splice(100);
      if (page) {
        const result = notionRequest_('patch', '/blocks/' + page + '/children', token, { children: [snapshot] });
        if (overflow.length) appendSnapshotOverflow_(token, result.results[0].id, overflow);
      } else {
        const result = notionRequest_('post', '/pages', token, {
          parent: { type: 'data_source_id', data_source_id: NOTION_EDITIONS_DATA_SOURCE_ID },
          properties: { Name: { title: [{ text: { content: title } }] } },
          children: [snapshot]
        });
        existing.set(key, result.id);
        created++;
        if (overflow.length) {
          const toggle = snapshotBlocks_(token, result.id).find(block =>
            block.type === 'toggle' && block.toggle.rich_text.some(part =>
              (part.plain_text || (part.text || {}).content) === window.name));
          if (!toggle) throw new Error('New Notion snapshot could not be found for ' + title);
          appendSnapshotOverflow_(token, toggle.id, overflow);
        }
      }
      captured++;
      Logger.log('Captured ' + window.name + ': ' + title);
    }
    Logger.log('Newsletter sync complete: ' + created + ' new edition(s), ' + captured + ' snapshot(s).');
    return created;
  } finally {
    lock.releaseLock();
  }
}

function editionDate_(title) {
  const match = title.match(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\b/i);
  if (!match) return '';
  const month = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 }[match[1].toLowerCase()];
  if (!month) return '';
  const day = Number(match[2]), year = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return '';
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function checkedDocText_(fileId, title) {
  const markdown = exportDocText_(fileId).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (markdown.length < 100) throw new Error('Newsletter Doc is empty or too short: ' + title);
  if (/https?:\/\/(?:mail\.google\.com|gmail\.com|outlook\.com|outlook\.office\.com|notion\.so|notion\.com)\b/i.test(markdown)) {
    throw new Error('Newsletter Doc has a private inbox or Notion link: ' + title);
  }
  return markdown;
}

function exportDocText_(fileId) {
  const url = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '/export?mimeType=text%2Fplain';
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('Google Doc export failed (HTTP ' + response.getResponseCode() + ').');
  return response.getContentText('UTF-8');
}

function richText_(line) {
  const parts = [];
  const token = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g;
  let offset = 0, match;
  function add(text, url, style) {
    for (let at = 0; at < text.length; at += 1900) {
      const part = { type: 'text', text: { content: text.slice(at, at + 1900) } };
      if (url) part.text.link = { url };
      if (style) part.annotations = { [style]: true };
      parts.push(part);
    }
  }
  while ((match = token.exec(line))) {
    add(line.slice(offset, match.index));
    if (match[1]) add(match[1], match[2]);
    else if (match[3]) add(match[3], null, 'bold');
    else add(match[4] || match[5], null, 'italic');
    offset = token.lastIndex;
  }
  add(line.slice(offset));
  return parts.length ? parts : [{ type: 'text', text: { content: ' ' } }];
}

function snapshotBlock_(name, markdown) {
  const children = [];
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    const quote = /^>\s*(.+)$/.exec(line);
    if (/^---+$/.test(line)) {
      children.push({ object: 'block', type: 'divider', divider: {} });
      continue;
    }
    const type = heading ? 'heading_' + heading[1].length : bullet ? 'bulleted_list_item' :
      numbered ? 'numbered_list_item' : quote ? 'quote' : 'paragraph';
    const content = heading ? heading[2] : bullet ? bullet[1] : numbered ? numbered[1] : quote ? quote[1] : line;
    children.push({ object: 'block', type, [type]: { rich_text: richText_(content) } });
  }
  if (!children.length) throw new Error('Newsletter snapshot has no content.');
  return { object: 'block', type: 'toggle', toggle: { rich_text: richText_(name), children } };
}

function appendSnapshotOverflow_(token, toggleId, children) {
  if (!toggleId) throw new Error('Notion did not return a snapshot block ID.');
  for (let offset = 0; offset < children.length; offset += 100) {
    notionRequest_('patch', '/blocks/' + toggleId + '/children', token,
      { children: children.slice(offset, offset + 100) });
  }
}

function getEditionPages_(token) {
  const pages = new Map();
  let cursor;
  do {
    const body = cursor ? { page_size: 100, start_cursor: cursor } : { page_size: 100 };
    const result = notionRequest_('post', '/data_sources/' + NOTION_EDITIONS_DATA_SOURCE_ID + '/query', token, body);
    for (const page of result.results || []) {
      const title = ((page.properties || {}).Name || {}).title || [];
      const name = title.map(part => part.plain_text || (part.text || {}).content || '').join('').trim();
      if (name) pages.set(name.toLocaleLowerCase(), page.id);
    }
    cursor = result.has_more ? result.next_cursor : null;
    if (result.has_more && !cursor) throw new Error('Notion returned an incomplete Editions listing.');
  } while (cursor);
  return pages;
}

function snapshotNames_(token, pageId) {
  return snapshotBlocks_(token, pageId).filter(block => block.type === 'toggle')
    .map(block => ((block.toggle || {}).rich_text || [])
      .map(part => part.plain_text || (part.text || {}).content || '').join(''))
    .filter(name => SNAPSHOT_WINDOWS.some(item => item.name === name));
}

function snapshotBlocks_(token, pageId) {
  const blocks = [];
  let cursor;
  do {
    const suffix = '?page_size=100' + (cursor ? '&start_cursor=' + encodeURIComponent(cursor) : '');
    const result = notionRequest_('get', '/blocks/' + pageId + '/children' + suffix, token);
    blocks.push(...(result.results || []));
    cursor = result.has_more ? result.next_cursor : null;
    if (result.has_more && !cursor) throw new Error('Notion returned an incomplete snapshot listing.');
  } while (cursor);
  return blocks;
}

function notionRequest_(method, path, token, body) {
  const options = {
    method, contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, 'Notion-Version': NOTION_VERSION },
    muteHttpExceptions: true
  };
  if (body !== undefined) options.payload = JSON.stringify(body);
  const response = UrlFetchApp.fetch('https://api.notion.com/v1' + path, options);
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    let errorCode = '';
    try { errorCode = JSON.parse(response.getContentText()).code || ''; } catch (_) {}
    throw new Error('Notion ' + path + ' failed (HTTP ' + status + (errorCode ? ', ' + errorCode : '') + ').');
  }
  return JSON.parse(response.getContentText());
}

function checkNewsletterConnections() {
  const token = PropertiesService.getScriptProperties().getProperty('NOTION_TOKEN');
  if (!token) throw new Error('Set NOTION_TOKEN in Script properties first.');
  DriveApp.getFolderById(NEWSLETTER_FOLDER_ID).getName();
  const count = getEditionPages_(token).size;
  Logger.log('Connections work. Found ' + count + ' existing Notion edition(s).');
}

function installNewsletterTrigger() {
  const current = ScriptApp.getProjectTriggers().filter(trigger => trigger.getHandlerFunction() === 'syncNewsletterDocs');
  if (current.length) return;
  ScriptApp.newTrigger('syncNewsletterDocs').timeBased().everyMinutes(15).create();
}
