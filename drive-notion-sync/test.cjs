const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');
function doc(id, name, created) {
  return { getId: () => id, getName: () => name, getDateCreated: () => new Date(created) };
}
function harness({ files, existing = [], bodies = {} }) {
  let now = '2026-10-01T13:45:00Z';
  const pages = existing.map((name, index) => ({
    id: 'existing-' + index,
    properties: { Name: { title: [{ plain_text: name }] } },
    children: []
  }));
  const requests = [];
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
  }
  const context = {
    Set, Map, JSON, Date: Clock, Error, Number, String, encodeURIComponent,
    Logger: { log() {} },
    Utilities: { formatDate: (value, zone, pattern) => {
      assert.equal(zone, 'America/New_York');
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: 'numeric', hourCycle: 'h23'
      }).formatToParts(value).map(part => [part.type, part.value]));
      return pattern === 'H' ? String(Number(parts.hour)) : [parts.year, parts.month, parts.day].join('-');
    } },
    MimeType: { GOOGLE_DOCS: 'application/vnd.google-apps.document' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test-token' }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    DriveApp: { getFolderById: () => ({
      getName: () => 'Editions Queue',
      getFilesByType: () => {
        let index = 0;
        return { hasNext: () => index < files.length, next: () => files[index++] };
      }
    }) },
    ScriptApp: { getOAuthToken: () => 'google-test-token' },
    UrlFetchApp: { fetch: (url, options) => {
      if (url.includes('www.googleapis.com/drive/v3/files/')) {
        const id = decodeURIComponent(url.split('/files/')[1].split('/')[0]);
        assert.equal(options.headers.Authorization, 'Bearer google-test-token');
        return { getResponseCode: () => 200, getContentText: () => bodies[id] };
      }
      const body = options.payload ? JSON.parse(options.payload) : null;
      requests.push({ url, body, method: options.method });
      let result;
      if (url.endsWith('/query')) result = { results: pages, has_more: false };
      else if (/\/blocks\/[^/]+\/children\?/.test(url)) {
        const id = url.split('/blocks/')[1].split('/')[0];
        const page = pages.find(page => page.id === id);
        const toggle = pages.flatMap(page => page.children).find(block => block.id === id);
        result = { results: (page ? page.children : toggle.toggle.children), has_more: false };
      } else if (options.method === 'patch') {
        const id = url.split('/blocks/')[1].split('/')[0];
        const page = pages.find(page => page.id === id);
        const toggle = pages.flatMap(page => page.children).find(block => block.id === id);
        const children = body.children.map(block => ({ ...block, id: 'block-' + (requests.length + pages.length) + '-' + Math.random() }));
        (page ? page.children : toggle.toggle.children).push(...children);
        result = { results: children };
      } else if (url.endsWith('/pages')) {
        result = { id: 'page-' + (pages.length + 1) };
        pages.push({ id: result.id,
          properties: { Name: { title: [{ plain_text: body.properties.Name.title[0].text.content }] } },
          children: (body.children || []).map((block, index) => ({ ...block, id: 'block-' + result.id + '-' + index })), markdown: body.markdown });
      } else throw new Error('Unexpected request: ' + url);
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(result) };
    } }
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  return { context, pages, requests, setNow: value => { now = value; } };
}

test('captures four cumulative passes in one Notion page, once per window', () => {
  const title = 'A Daily Digest — Thursday, October 1, 2026';
  const bodies = { today: 'Morning introduction with enough text to count as a complete newsletter.\n\n## Front Page\n[Read the source](https://example.com/a)' };
  const h = harness({ files: [doc('today', title + '.md', '2026-10-01')], bodies });
  assert.equal(h.context.syncNewsletterDocs(), 0); // 9:45 ET
  assert.equal(h.pages.length, 0);
  h.setNow('2026-10-01T14:08:00Z'); // 10:08 ET
  assert.equal(h.context.syncNewsletterDocs(), 1);
  assert.equal(h.pages.length, 1);
  assert.equal(h.pages[0].children[0].toggle.rich_text[0].text.content, 'Morning edition');
  assert.equal(h.pages[0].children[0].toggle.children[1].type, 'heading_2');
  assert.equal(h.pages[0].children[0].toggle.children[2].paragraph.rich_text[0].text.link.url, 'https://example.com/a');
  assert.equal(h.context.syncNewsletterDocs(), 0);
  assert.equal(h.pages[0].children.length, 1);
  bodies.today += '\n\nNoon update with more useful detail for readers.';
  h.setNow('2026-10-01T16:10:00Z');
  h.context.syncNewsletterDocs();
  bodies.today += '\n\n## Afternoon\nMore articles arrived after lunch.';
  h.setNow('2026-10-01T20:09:00Z');
  h.context.syncNewsletterDocs();
  bodies.today += '\n\n## Evening\nFinal links and context.';
  h.setNow('2026-10-02T00:06:00Z');
  h.context.syncNewsletterDocs();
  assert.deepEqual(h.pages[0].children.map(block => block.toggle.rich_text[0].text.content),
    ['Morning edition', 'Midday pass', 'Afternoon edition', 'Evening edition']);
  assert.equal(h.pages[0].children[0].toggle.children.some(block => JSON.stringify(block).includes('Evening')), false);
  assert.equal(h.pages[0].children[3].toggle.children.some(block => JSON.stringify(block).includes('Evening')), true);
  assert.equal(h.pages.length, 1);
  assert.equal(h.context.syncNewsletterDocs(), 0);
  assert.equal(h.pages[0].children.length, 4);
});

test('backfills historical docs once and never adds snapshots to legacy pages', () => {
  const title = 'The AI Capex Debt Cliff — Tuesday, September 29, 2026';
  const body = 'Intro to the old edition with enough text to pass validation.\n\n## Front Page\n[Read the source](https://example.com/story) with context and notes for readers.';
  const h = harness({ files: [doc('old', title + '.md', '2026-09-29')], bodies: { old: body } });
  assert.equal(h.context.syncNewsletterDocs(), 1);
  assert.equal(h.pages[0].markdown, body);
  assert.equal(h.context.syncNewsletterDocs(), 0);
  assert.equal(h.pages.length, 1);
});

test('refuses private inbox links before publishing', () => {
  const h = harness({
    files: [doc('bad', 'Private links — Thursday, October 1, 2026.md', '2026-10-01')],
    bodies: { bad: 'Private link https://mail.google.com/mail/u/0/#inbox/abc plus enough text to pass the length check and make this a realistic newsletter.' }
  });
  h.setNow('2026-10-01T14:10:00Z');
  assert.throws(() => h.context.syncNewsletterDocs(), /private inbox or Notion link/);
  assert.equal(h.pages.length, 0);
});

test('long cumulative editions append all blocks in Notion-sized batches', () => {
  const title = 'Many stories — Thursday, October 1, 2026';
  const bodies = { long: Array.from({ length: 225 }, (_, index) => `Story ${index + 1}: enough text for the complete issue.`).join('\n') };
  const h = harness({ files: [doc('long', title, '2026-10-01')], bodies });
  h.setNow('2026-10-01T14:10:00Z');
  h.context.syncNewsletterDocs();
  assert.equal(h.pages[0].children[0].toggle.children.length, 225);
  assert.equal(h.requests.filter(request => request.method === 'patch').length, 2);
});
