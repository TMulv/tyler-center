/**
 * Google Apps Script: finished Google Docs in the Editions Queue -> Notion Editions.
 * Run installNewsletterTrigger() once after setting NOTION_TOKEN in Script properties.
 */
const NEWSLETTER_FOLDER_ID = '1mhNmOwgL3lBMlrWAdNZQNiHZ3uZ-Lk9o';
const NOTION_EDITIONS_DATA_SOURCE_ID = 'aab9f113-6439-4714-9185-0cc08f9d70df';
const NOTION_VERSION = '2026-03-11';

function syncNewsletterDocs() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const token = PropertiesService.getScriptProperties().getProperty('NOTION_TOKEN');
    if (!token) throw new Error('Set NOTION_TOKEN in Script properties before running the sync.');
    const existing = getEditionTitles_(token);
    const files = DriveApp.getFolderById(NEWSLETTER_FOLDER_ID).getFilesByType(MimeType.GOOGLE_DOCS);
    const pending = [];
    while (files.hasNext()) {
      const file = files.next();
      const title = file.getName().replace(/\.md$/i, '').trim();
      if (title && !existing.has(title.toLocaleLowerCase())) pending.push({ file, title });
    }
    pending.sort((a, b) => a.file.getDateCreated() - b.file.getDateCreated());
    let created = 0;
    for (const { file, title } of pending) {
      const markdown = DocumentApp.openById(file.getId()).getBody().getText()
        .replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
      if (markdown.length < 100) throw new Error('Newsletter Doc is empty or too short: ' + title);
      if (/https?:\/\/(?:mail\.google\.com|gmail\.com|outlook\.com|outlook\.office\.com|notion\.so|notion\.com)\b/i.test(markdown)) {
        throw new Error('Newsletter Doc has a private inbox or Notion link: ' + title);
      }
      notionRequest_('post', '/pages', token, {
        parent: { type: 'data_source_id', data_source_id: NOTION_EDITIONS_DATA_SOURCE_ID },
        properties: { Name: { title: [{ text: { content: title } }] } },
        markdown
      });
      existing.add(title.toLocaleLowerCase());
      created++;
      Logger.log('Published newsletter edition: ' + title);
    }
    Logger.log('Newsletter sync complete: ' + created + ' new edition(s).');
    return created;
  } finally {
    lock.releaseLock();
  }
}

function getEditionTitles_(token) {
  const titles = new Set();
  let cursor;
  do {
    const body = cursor ? { page_size: 100, start_cursor: cursor } : { page_size: 100 };
    const result = notionRequest_('post', '/data_sources/' + NOTION_EDITIONS_DATA_SOURCE_ID + '/query', token, body);
    for (const page of result.results || []) {
      const title = ((page.properties || {}).Name || {}).title || [];
      const name = title.map(part => part.plain_text || (part.text || {}).content || '').join('').trim();
      if (name) titles.add(name.toLocaleLowerCase());
    }
    cursor = result.has_more ? result.next_cursor : null;
    if (result.has_more && !cursor) throw new Error('Notion returned an incomplete Editions listing.');
  } while (cursor);
  return titles;
}

function notionRequest_(method, path, token, body) {
  const response = UrlFetchApp.fetch('https://api.notion.com/v1' + path, {
    method,
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, 'Notion-Version': NOTION_VERSION },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
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
  const count = getEditionTitles_(token).size;
  Logger.log('Connections work. Found ' + count + ' existing Notion edition(s).');
}

function installNewsletterTrigger() {
  const current = ScriptApp.getProjectTriggers().filter(trigger => trigger.getHandlerFunction() === 'syncNewsletterDocs');
  if (current.length) return;
  ScriptApp.newTrigger('syncNewsletterDocs').timeBased().everyMinutes(15).create();
}
