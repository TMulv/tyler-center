const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');

function harness({ files, existing = [], bodies = {} }) {
  const pages = existing.map(name => ({ properties: { Name: { title: [{ plain_text: name }] } } }));
  const created = [];
  const requests = [];
  const context = {
    Set, JSON, Date, Error, Logger: { log() {} },
    MimeType: { GOOGLE_DOCS: 'application/vnd.google-apps.document' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test-token' }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    DriveApp: { getFolderById: () => ({
      getFilesByType: () => {
        let index = 0;
        return { hasNext: () => index < files.length, next: () => files[index++] };
      }
    }) },
    DocumentApp: { openById: id => ({ getBody: () => ({ getText: () => bodies[id] }) }) },
    UrlFetchApp: { fetch: (url, options) => {
      const body = JSON.parse(options.payload);
      requests.push({ url, body });
      let result;
      if (url.endsWith('/query')) result = { results: pages, has_more: false };
      else {
        created.push(body);
        pages.push({ properties: { Name: { title: [{ plain_text: body.properties.Name.title[0].text.content }] } } });
        result = { id: 'new-page' };
      }
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(result) };
    } }
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  return { context, created, requests };
}

function doc(id, name, created) {
  return { getId: () => id, getName: () => name, getDateCreated: () => new Date(created) };
}

test('backfills only the missing edition with its headings and public links', () => {
  const title = 'The AI Capex Debt Cliff — Tuesday, September 29, 2026';
  const body = 'Intro to today’s edition.\n\n## Front Page\n\n### Story\n\n[Read the source](https://example.com/story) with context and notes for readers.';
  const { context, created } = harness({
    existing: ['Already Published — Wednesday, September 30, 2026'],
    files: [
      doc('new', title + '.md', '2026-09-29'),
      doc('old', 'Already Published — Wednesday, September 30, 2026.md', '2026-09-30')
    ],
    bodies: { new: body }
  });
  assert.equal(context.syncNewsletterDocs(), 1);
  assert.equal(created.length, 1);
  assert.equal(created[0].properties.Name.title[0].text.content, title);
  assert.equal(created[0].markdown, body);
  assert.equal(context.syncNewsletterDocs(), 0);
  assert.equal(created.length, 1);
});

test('refuses a Doc containing private inbox links', () => {
  const { context, created } = harness({
    files: [doc('bad', 'Private links.md', '2026-09-29')],
    bodies: { bad: 'Private link https://mail.google.com/mail/u/0/#inbox/abc plus enough text to pass the length check and make this a realistic newsletter.' }
  });
  assert.throws(() => context.syncNewsletterDocs(), /private inbox or Notion link/);
  assert.equal(created.length, 0);
});
