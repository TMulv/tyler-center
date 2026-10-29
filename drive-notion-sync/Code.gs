/**
 * One Google Doc becomes one Notion edition, published once a night.
 * Spark rewrites the Doc at 8am, 12pm, 4pm and 8pm. The 15-minute trigger
 * saves each pass in Script properties, then after 10pm New York time it
 * stacks the passes into one full edition, creates the Notion page in one
 * call, and saves a Google Doc copy in the Full Editions Drive folder.
 */
const NEWSLETTER_FOLDER_ID = '1mhNmOwgL3lBMlrWAdNZQNiHZ3uZ-Lk9o';
const NOTION_EDITIONS_DATA_SOURCE_ID = 'aab9f113-6439-4714-9185-0cc08f9d70df';
const NOTION_VERSION = '2026-03-11';
const NEWSLETTER_TIME_ZONE = 'America/New_York';
const PUBLISH_HOUR = 22;
const FULL_EDITIONS_FOLDER_NAME = 'Daily Newsletter - Full Editions';
const KEEP_DAYS = 7;
const CHUNK = 2000;
const SNAPSHOT_WINDOWS = [
  { hour: 8, key: 'morning', name: '8am edition' },
  { hour: 12, key: 'midday', name: '12pm edition' },
  { hour: 16, key: 'afternoon', name: '4pm edition' },
  { hour: 20, key: 'evening', name: '8pm edition' }
];

function syncNewsletterDocs() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('NOTION_TOKEN');
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
    const errors = [];
    let created = 0;
    for (const { file, title } of pending) {
      const date = editionDate_(title);
      try {
        if (date && props.getProperty('published:' + date)) continue;
        if (date && date > today) continue; // A future-dated Doc waits for its own day.
        if (date === today) {
          if (window) stashPass_(props, date, window, file, title);
          if (hour >= PUBLISH_HOUR) created += publishEdition_(token, props, existing, date, title);
          continue;
        }
        // A missed night publishes late from its saved passes.
        if (date && Object.keys(readStash_(props, date)).length) {
          created += publishEdition_(token, props, existing, date, title);
          continue;
        }
        // Historical Docs keep the old one-time import behavior.
        const key = title.toLocaleLowerCase();
        if (existing.get(key)) continue;
        existing.set(key, createEditionPage_(token, title, checkedDocText_(file.getId(), title)));
        created++;
        Logger.log('Published historical newsletter edition: ' + title);
      } catch (error) {
        errors.push(title + ': ' + error.message);
      }
    }
    pruneProperties_(props, now);
    if (errors.length) throw new Error(errors.join('\n'));
    Logger.log('Newsletter sync complete: ' + created + ' new edition(s).');
    return created;
  } finally {
    lock.releaseLock();
  }
}

function stashPass_(props, date, window, file, title) {
  const updated = file.getLastUpdated().getTime();
  const stash = readStash_(props, date);
  const current = stash[window.key];
  if (current && current.updated >= updated) return;
  const index = SNAPSHOT_WINDOWS.indexOf(window);
  const earlier = SNAPSHOT_WINDOWS.slice(0, index).reverse().find(item => stash[item.key]);
  const previous = earlier && stash[earlier.key];
  // Spark has not written this pass yet.
  if (!current && previous && previous.updated >= updated) return;
  const text = checkedDocText_(file.getId(), title);
  if (previous && text === previous.text) {
    writeStash_(props, date, earlier.key, { ...previous, updated });
    return;
  }
  writeStash_(props, date, window.key, { updated, title, text });
  Logger.log('Saved ' + window.name + ' for tonight: ' + title);
}

function fullEdition_(stash) {
  const parts = [];
  let previous = '';
  for (const window of SNAPSHOT_WINDOWS) {
    const pass = stash[window.key];
    if (!pass) continue;
    let text = pass.text.trim();
    // Spark normally replaces the Doc each pass. If it appended instead, keep only the new part.
    if (previous && text.startsWith(previous)) text = text.slice(previous.length).trim();
    previous = pass.text.trim();
    if (text) parts.push({ window, text });
  }
  return parts;
}

function publishEdition_(token, props, existing, date, title) {
  const parts = fullEdition_(readStash_(props, date));
  if (!parts.length) return 0;
  const markdown = parts.map(part => part.text).join('\n\n---\n\n');
  const key = title.toLocaleLowerCase();
  let created = 0;
  const page = existing.get(key);
  if (!page) {
    existing.set(key, createEditionPage_(token, title, markdown));
    created = 1;
    Logger.log('Published full edition: ' + title);
  } else {
    // A page started by the older four-pass script finishes in that format.
    const names = snapshotNames_(token, page);
    if (names.length) {
      for (const part of parts) {
        if (!names.includes(part.window.name)) appendSnapshot_(token, page, part.window.name, part.text);
      }
    }
  }
  if (!props.getProperty('fullDoc:' + date)) {
    props.setProperty('fullDoc:' + date, createFullEditionDoc_(props, title, markdown));
    Logger.log('Saved full edition Doc: ' + title);
  }
  props.setProperty('published:' + date, new Date().toISOString());
  deleteStash_(props, date);
  return created;
}

function stashKey_(date, slot) {
  return 'stash:' + date + ':' + slot;
}

function readStash_(props, date) {
  const all = props.getProperties();
  const stash = {};
  for (const window of SNAPSHOT_WINDOWS) {
    const key = stashKey_(date, window.key);
    if (!all[key]) continue;
    const info = JSON.parse(all[key]);
    let text = '';
    for (let i = 0; i < info.parts; i++) text += all[key + ':' + i] || '';
    if (text.length === info.length) stash[window.key] = { updated: info.updated, title: info.title, text };
  }
  return stash;
}

function writeStash_(props, date, slot, pass) {
  const key = stashKey_(date, slot);
  const values = {};
  const parts = Math.ceil(pass.text.length / CHUNK);
  for (let i = 0; i < parts; i++) values[key + ':' + i] = pass.text.slice(i * CHUNK, (i + 1) * CHUNK);
  values[key] = JSON.stringify({ updated: pass.updated, title: pass.title, parts, length: pass.text.length });
  props.setProperties(values);
}

function deleteStash_(props, date) {
  for (const key of Object.keys(props.getProperties())) {
    if (key.startsWith('stash:' + date + ':')) props.deleteProperty(key);
  }
}

function pruneProperties_(props, now) {
  const cutoff = Utilities.formatDate(new Date(now.getTime() - KEEP_DAYS * 86400000), NEWSLETTER_TIME_ZONE, 'yyyy-MM-dd');
  for (const key of Object.keys(props.getProperties())) {
    const match = /^(?:stash|fullDoc|published):(\d{4}-\d{2}-\d{2})/.exec(key);
    if (match && match[1] < cutoff) props.deleteProperty(key);
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
  const markdown = exportDocText_(fileId).replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
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

function createEditionPage_(token, title, markdown) {
  const parent = { type: 'data_source_id', data_source_id: NOTION_EDITIONS_DATA_SOURCE_ID };
  const properties = { Name: { title: [{ text: { content: title } }] } };
  try {
    return notionRequest_('post', '/pages', token, { parent, properties, markdown }).id;
  } catch (error) {
    // Notion rejected the Markdown itself (nothing was created), so send plain blocks instead.
    if (!/HTTP 400/.test(error.message)) throw error;
    Logger.log('Markdown import refused, sending blocks instead: ' + error.message);
    const blocks = markdownBlocks_(markdown);
    const page = notionRequest_('post', '/pages', token, { parent, properties, children: blocks.slice(0, 100) }).id;
    for (let offset = 100; offset < blocks.length; offset += 100) {
      notionRequest_('patch', '/blocks/' + page + '/children', token, { children: blocks.slice(offset, offset + 100) });
    }
    return page;
  }
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

function markdownBlocks_(markdown) {
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
  return children;
}

function snapshotBlock_(name, markdown) {
  return { object: 'block', type: 'toggle', toggle: { rich_text: richText_(name), children: markdownBlocks_(markdown) } };
}

function appendSnapshot_(token, page, name, markdown) {
  const snapshot = snapshotBlock_(name, markdown);
  const overflow = snapshot.toggle.children.splice(100);
  const result = notionRequest_('patch', '/blocks/' + page + '/children', token, { children: [snapshot] });
  if (overflow.length) appendSnapshotOverflow_(token, result.results[0].id, overflow);
  Logger.log('Finished ' + name + ' on an older four-pass page.');
}

function appendSnapshotOverflow_(token, toggleId, children) {
  if (!toggleId) throw new Error('Notion did not return a snapshot block ID.');
  for (let offset = 0; offset < children.length; offset += 100) {
    notionRequest_('patch', '/blocks/' + toggleId + '/children', token,
      { children: children.slice(offset, offset + 100) });
  }
}

function escapeHtml_(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function plainHtml_(text) {
  return escapeHtml_(text.replace(/\\([\\`*_{}\[\]()#+\-.!$>~|])/g, '$1'));
}

function inlineHtml_(text) {
  const token = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|(?<!\w)_([^_]+)_(?!\w)/g;
  let out = '', offset = 0, match;
  while ((match = token.exec(text))) {
    out += plainHtml_(text.slice(offset, match.index));
    if (match[1]) out += '<a href="' + escapeHtml_(match[2]) + '">' + inlineHtml_(match[1]) + '</a>';
    else if (match[3]) out += '<b>' + plainHtml_(match[3]) + '</b>';
    else out += '<i>' + plainHtml_(match[4] || match[5]) + '</i>';
    offset = token.lastIndex;
  }
  return out + plainHtml_(text.slice(offset));
}

function editionHtml_(title, markdown) {
  const html = [];
  let list = '';
  const close = () => { if (list) html.push('</' + list + '>'); list = ''; };
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const item = /^[-*]\s+(.+)$/.exec(line) || /^\d+[.)]\s+(.+)$/.exec(line);
    const quote = /^>\s*(.+)$/.exec(line);
    if (item) {
      const tag = /^\d/.test(line) ? 'ol' : 'ul';
      if (list !== tag) { close(); html.push('<' + tag + '>'); list = tag; }
      html.push('<li>' + inlineHtml_(item[1]) + '</li>');
      continue;
    }
    close();
    if (!line) continue;
    if (/^---+$/.test(line)) html.push('<hr>');
    else if (heading) html.push('<h' + heading[1].length + '>' + inlineHtml_(heading[2]) + '</h' + heading[1].length + '>');
    else if (quote) html.push('<blockquote>' + inlineHtml_(quote[1]) + '</blockquote>');
    else html.push('<p>' + inlineHtml_(line) + '</p>');
  }
  close();
  return '<html><head><meta charset="utf-8"><title>' + escapeHtml_(title) + '</title></head><body>' + html.join('\n') + '</body></html>';
}

function driveRequest_(method, url, contentType, payload) {
  const options = { method, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
  if (payload !== undefined) {
    options.contentType = contentType;
    options.payload = payload;
  }
  const response = UrlFetchApp.fetch(url, options);
  const status = response.getResponseCode();
  if (status === 404 && method === 'get') return null;
  if (status < 200 || status >= 300) throw new Error('Google Drive request failed (HTTP ' + status + ').');
  return JSON.parse(response.getContentText());
}

function fullEditionsFolder_(props) {
  const saved = props.getProperty('FULL_EDITIONS_FOLDER_ID');
  if (saved) {
    const folder = driveRequest_('get', 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(saved) + '?fields=id,trashed');
    if (folder && !folder.trashed) return saved;
  }
  const folder = driveRequest_('post', 'https://www.googleapis.com/drive/v3/files?fields=id', 'application/json',
    JSON.stringify({ name: FULL_EDITIONS_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }));
  props.setProperty('FULL_EDITIONS_FOLDER_ID', folder.id);
  return folder.id;
}

function createFullEditionDoc_(props, title, markdown) {
  const boundary = 'full-edition-' + new Date().getTime();
  const metadata = { name: title, mimeType: 'application/vnd.google-apps.document', parents: [fullEditionsFolder_(props)] };
  const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
    '\r\n--' + boundary + '\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n' + editionHtml_(title, markdown) +
    '\r\n--' + boundary + '--';
  return driveRequest_('post', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    'multipart/related; boundary=' + boundary, body).id;
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
    .map(blockName_)
    .filter(name => SNAPSHOT_WINDOWS.some(item => item.name === name));
}

function blockName_(block) {
  return ((block.toggle || {}).rich_text || [])
    .map(part => part.plain_text || (part.text || {}).content || '').join('');
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
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('NOTION_TOKEN');
  if (!token) throw new Error('Set NOTION_TOKEN in Script properties first.');
  DriveApp.getFolderById(NEWSLETTER_FOLDER_ID).getName();
  const count = getEditionPages_(token).size;
  const folder = fullEditionsFolder_(props);
  Logger.log('Connections work. Found ' + count + ' existing Notion edition(s). Full editions folder: https://drive.google.com/drive/folders/' + folder);
}

function installNewsletterTrigger() {
  const current = ScriptApp.getProjectTriggers().filter(trigger => trigger.getHandlerFunction() === 'syncNewsletterDocs');
  if (current.length) return;
  ScriptApp.newTrigger('syncNewsletterDocs').timeBased().everyMinutes(15).create();
}
