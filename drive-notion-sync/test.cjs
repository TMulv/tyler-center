const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');
function doc(id, name, created) {
  let modified = created;
  return { getId: () => id, getName: () => name, getDateCreated: () => new Date(created),
    getLastUpdated: () => new Date(modified), setModified: value => { modified = value; } };
}
function harness({ files, existing = [], bodies = {}, refuseMarkdown = false, props = {} }) {
  let now = '2026-10-01T11:45:00Z';
  const pages = existing.map((page, index) => ({
    id: 'existing-' + index,
    properties: { Name: { title: [{ plain_text: page.name || page }] } },
    children: page.children || []
  }));
  const store = { NOTION_TOKEN: 'test-token', ...props };
  const requests = [], exports = [], docs = [], folders = [];
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
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => Object.hasOwn(store, key) ? store[key] : null,
      getProperties: () => ({ ...store }),
      setProperty: (key, value) => { store[key] = String(value); },
      setProperties: values => { for (const key of Object.keys(values)) store[key] = String(values[key]); },
      deleteProperty: key => { delete store[key]; }
    }) },
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
      const reply = (result, status = 200) => ({ getResponseCode: () => status, getContentText: () => JSON.stringify(result) });
      if (url.includes('googleapis.com')) assert.equal(options.headers.Authorization, 'Bearer google-test-token');
      if (url.includes('www.googleapis.com/drive/v3/files/') && url.includes('/export')) {
        const id = decodeURIComponent(url.split('/files/')[1].split('/')[0]);
        exports.push(id);
        return { getResponseCode: () => 200, getContentText: () => bodies[id] };
      }
      if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files')) {
        assert.match(options.contentType, /^multipart\/related; boundary=/);
        const metadata = JSON.parse(options.payload.split('\r\n\r\n')[1].split('\r\n--')[0]);
        docs.push({ metadata, html: options.payload.split('text/html; charset=UTF-8\r\n\r\n')[1] });
        return reply({ id: 'doc-' + docs.length });
      }
      if (url.startsWith('https://www.googleapis.com/drive/v3/files?')) {
        folders.push(JSON.parse(options.payload));
        return reply({ id: 'folder-' + folders.length });
      }
      if (url.startsWith('https://www.googleapis.com/drive/v3/files/')) {
        const id = decodeURIComponent(url.split('/files/')[1].split('?')[0]);
        return id.startsWith('folder-') ? reply({ id, trashed: false }) : reply({}, 404);
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
        const children = body.children.map((block, index) => ({ ...block, id: 'block-' + requests.length + '-' + index,
          last_edited_time: now }));
        (page ? page.children : toggle.toggle.children).push(...children);
        result = { results: children };
      } else if (url.endsWith('/pages')) {
        if (body.markdown && refuseMarkdown) return reply({ code: 'validation_error' }, 400);
        result = { id: 'page-' + (pages.length + 1) };
        pages.push({ id: result.id,
          properties: { Name: { title: [{ plain_text: body.properties.Name.title[0].text.content }] } },
          children: (body.children || []).map((block, index) => ({ ...block, id: 'block-' + result.id + '-' + index,
            last_edited_time: now })), markdown: body.markdown });
      } else throw new Error('Unexpected request: ' + url);
      return reply(result);
    } }
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  return { context, pages, requests, exports, docs, folders, store, setNow: value => { now = value; } };
}
const stashKeys = store => Object.keys(store).filter(key => key.startsWith('stash:'));

test('saves each pass during the day and publishes one full edition after 10pm', () => {
  const title = 'A Daily Digest — Thursday, October 1, 2026';
  const bodies = { today: '# Thursday, October 1, 2026 - Morning Edition\n\nMorning introduction with enough text to count as a complete newsletter.\n\n## Front Page\n- [**75,000 years**](https://example.com/a): an old spear wound.' };
  const file = doc('today', title + '.md', '2026-10-01T11:30:00Z');
  const h = harness({ files: [file], bodies });
  assert.equal(h.context.syncNewsletterDocs(), 0); // 7:45 ET
  assert.equal(h.exports.length, 0);
  h.setNow('2026-10-01T12:08:00Z'); // 8:08 ET
  h.context.syncNewsletterDocs();
  h.context.syncNewsletterDocs();
  assert.equal(h.exports.length, 1, 'an unchanged Doc is not exported twice');
  // Spark rewrites the Doc for each pass.
  bodies.today = '# Thursday, October 1, 2026 - Midday Edition\n\nNoon update with more useful detail for readers and a new story.\n\n## Afternoon Reads\nMore articles arrived around lunch.';
  file.setModified('2026-10-01T16:04:00Z');
  h.setNow('2026-10-01T16:10:00Z'); // 12:10 ET
  h.context.syncNewsletterDocs();
  h.setNow('2026-10-01T20:09:00Z'); // 4:09 ET, Spark has not written the 4pm pass yet
  h.context.syncNewsletterDocs();
  assert.equal(h.exports.length, 2, 'the 4pm slot waits for a new pass');
  file.setModified('2026-10-01T20:12:00Z'); // touched, but the same text
  h.setNow('2026-10-01T20:24:00Z');
  h.context.syncNewsletterDocs();
  h.context.syncNewsletterDocs();
  assert.equal(h.exports.length, 3, 'an unchanged rewrite is checked once');
  bodies.today = '# Thursday, October 1, 2026 - Evening Edition\n\nFinal links and context for the night, with enough words to pass validation.';
  file.setModified('2026-10-02T00:03:00Z');
  h.setNow('2026-10-02T00:10:00Z'); // 8:10 ET
  h.context.syncNewsletterDocs();
  h.setNow('2026-10-02T01:55:00Z'); // 9:55 ET
  h.context.syncNewsletterDocs();
  assert.equal(h.pages.length, 0, 'nothing reaches Notion before 10pm');
  assert.equal(h.docs.length, 0);
  assert.deepEqual(stashKeys(h.store).filter(key => !/:\d+$/.test(key)).sort(),
    ['stash:2026-10-01:evening', 'stash:2026-10-01:midday', 'stash:2026-10-01:morning']);

  h.setNow('2026-10-02T02:06:00Z'); // 10:06 ET
  assert.equal(h.context.syncNewsletterDocs(), 1);
  assert.equal(h.pages.length, 1);
  const { markdown, children } = h.pages[0];
  assert.equal(children.length, 0, 'the edition is one page, not toggles');
  const order = ['Morning Edition', 'Midday Edition', 'Evening Edition'].map(text => markdown.indexOf(text));
  assert.ok(order.every((at, index) => at >= 0 && (!index || at > order[index - 1])), markdown);
  assert.equal(markdown.split('\n---\n').length, 3);
  assert.equal(h.docs.length, 1);
  assert.equal(h.docs[0].metadata.name, title);
  assert.deepEqual(h.docs[0].metadata.parents, ['folder-1']);
  assert.equal(h.folders[0].name, 'Daily Newsletter - Full Editions');
  assert.match(h.docs[0].html, /<a href="https:\/\/example.com\/a"><b>75,000 years<\/b><\/a>/);
  assert.match(h.docs[0].html, /<h1>Thursday, October 1, 2026 - Evening Edition<\/h1>/);
  assert.equal(stashKeys(h.store).length, 0);

  const work = () => [h.exports.length, h.docs.length, h.requests.filter(r => !r.url.endsWith('/query')).length];
  const before = work();
  h.setNow('2026-10-02T02:21:00Z');
  h.context.syncNewsletterDocs();
  h.setNow('2026-10-02T13:00:00Z'); // the next morning
  h.context.syncNewsletterDocs();
  assert.deepEqual(work(), before, 'later runs only list Notion editions');
});

test('keeps only the new part when Spark appends to the Doc', () => {
  const title = 'Appended — Thursday, October 1, 2026';
  const morning = '# Morning Edition\n\nMorning introduction with enough text to count as a complete newsletter today, plus a second sentence.';
  const bodies = { doc: morning };
  const file = doc('doc', title, '2026-10-01T11:30:00Z');
  const h = harness({ files: [file], bodies });
  h.setNow('2026-10-01T12:08:00Z');
  h.context.syncNewsletterDocs();
  bodies.doc = morning + '\n\n# Midday Edition\n\nNoon additions with plenty of new reporting.';
  file.setModified('2026-10-01T16:02:00Z');
  h.setNow('2026-10-02T02:06:00Z'); // 10:06 ET captures the latest text as the 8pm pass
  h.context.syncNewsletterDocs();
  assert.equal(h.pages[0].markdown.match(/Morning introduction/g).length, 1);
  assert.match(h.pages[0].markdown, /Midday Edition/);
});

test('finishes a page the older four-pass script started', () => {
  const title = 'Started early — Thursday, October 1, 2026';
  const toggle = { id: 'old-toggle', type: 'toggle', toggle: { rich_text: [{ plain_text: '8am edition' }], children: [] } };
  const bodies = { doc: '# Midday Edition\n\nNoon update with more useful detail for readers, long enough to publish as a real pass.' };
  const file = doc('doc', title, '2026-10-01T11:30:00Z');
  file.setModified('2026-10-01T16:02:00Z');
  const h = harness({ files: [file], bodies, existing: [{ name: title, children: [toggle] }] });
  h.setNow('2026-10-01T16:10:00Z');
  h.context.syncNewsletterDocs();
  assert.equal(h.pages[0].children.length, 1, 'no new toggles during the day');
  h.setNow('2026-10-02T02:06:00Z');
  assert.equal(h.context.syncNewsletterDocs(), 0);
  assert.equal(h.pages.length, 1);
  assert.deepEqual(h.pages[0].children.map(block => block.toggle.rich_text[0].plain_text || block.toggle.rich_text[0].text.content),
    ['8am edition', '12pm edition']);
  assert.equal(h.docs.length, 1);
});

test('publishes a missed night the next day from the saved passes', () => {
  const title = 'Missed — Thursday, October 1, 2026';
  const bodies = { doc: '# Morning Edition\n\nMorning introduction with enough text to count as a complete newsletter, plus another line.' };
  const h = harness({ files: [doc('doc', title, '2026-10-01T11:30:00Z')], bodies });
  h.setNow('2026-10-01T12:08:00Z');
  h.context.syncNewsletterDocs();
  h.setNow('2026-10-02T13:08:00Z');
  assert.equal(h.context.syncNewsletterDocs(), 1);
  assert.match(h.pages[0].markdown, /Morning introduction/);
});

test('backfills historical docs once', () => {
  const title = 'The AI Capex Debt Cliff — Tuesday, September 29, 2026';
  const body = 'Intro to the old edition with enough text to pass validation.\n\n## Front Page\n[Read the source](https://example.com/story) with context and notes for readers.';
  const h = harness({ files: [doc('old', title + '.md', '2026-09-29')], bodies: { old: body } });
  assert.equal(h.context.syncNewsletterDocs(), 1);
  assert.equal(h.pages[0].markdown, body);
  assert.equal(h.context.syncNewsletterDocs(), 0);
  assert.equal(h.pages.length, 1);
  assert.equal(h.docs.length, 0);
});

test('refuses private inbox links before saving anything', () => {
  const h = harness({
    files: [doc('bad', 'Private links — Thursday, October 1, 2026.md', '2026-10-01')],
    bodies: { bad: 'Private link https://mail.google.com/mail/u/0/#inbox/abc plus enough text to pass the length check and make this a realistic newsletter.' }
  });
  h.setNow('2026-10-01T14:10:00Z');
  assert.throws(() => h.context.syncNewsletterDocs(), /private inbox or Notion link/);
  assert.equal(stashKeys(h.store).length, 0);
  h.setNow('2026-10-02T02:06:00Z');
  assert.throws(() => h.context.syncNewsletterDocs(), /private inbox or Notion link/);
  assert.equal(h.pages.length, 0);
});

test('long editions fall back to Notion-sized block batches if Markdown is refused', () => {
  const title = 'Many stories — Thursday, October 1, 2026';
  const bodies = { long: Array.from({ length: 225 }, (_, index) => `Story ${index + 1}: enough text for the complete issue.`).join('\n') };
  const h = harness({ files: [doc('long', title, '2026-10-01')], bodies, refuseMarkdown: true });
  h.setNow('2026-10-02T02:06:00Z');
  h.context.syncNewsletterDocs();
  assert.equal(h.pages.length, 1);
  assert.equal(h.pages[0].children.length, 225);
  assert.equal(h.requests.filter(request => request.method === 'patch').length, 2);
});

test('long passes survive the Script properties size limit', () => {
  const title = 'Big day — Thursday, October 1, 2026';
  const text = '# Morning Edition\n\n' + 'Ünïcode story with a [link](https://example.com/x) and plenty of words. '.repeat(400);
  const h = harness({ files: [doc('big', title, '2026-10-01T11:30:00Z')], bodies: { big: text } });
  h.setNow('2026-10-01T12:08:00Z');
  h.context.syncNewsletterDocs();
  assert.ok(Object.values(h.store).every(value => Buffer.byteLength(value) < 9000));
  h.setNow('2026-10-02T02:06:00Z');
  h.context.syncNewsletterDocs();
  assert.equal(h.pages[0].markdown, text.trim());
});

test('old saved passes and markers are pruned after a week', () => {
  const h = harness({ files: [], props: { 'stash:2026-09-01:morning': '{}', 'published:2026-09-02': 'x',
    'fullDoc:2026-09-30': 'doc', FULL_EDITIONS_FOLDER_ID: 'folder-9' } });
  h.setNow('2026-10-01T14:10:00Z');
  h.context.syncNewsletterDocs();
  assert.deepEqual(Object.keys(h.store).sort(), ['FULL_EDITIONS_FOLDER_ID', 'NOTION_TOKEN', 'fullDoc:2026-09-30']);
});

test('the Drive copy converts Markdown to safe HTML', () => {
  const h = harness({ files: [] });
  const html = h.context.editionHtml_('A <title>', '# Head\n\n- [**$1.5 trillion**](https://x.com/a?b=1&c=2): AI \\$100 a watt\n- second\n\n1. first\n\n> quoted <b>\n\n---\n\nPlain *italic* and snake_case_name.');
  assert.match(html, /<title>A &lt;title&gt;<\/title>/);
  assert.match(html, /<ul>\n<li><a href="https:\/\/x.com\/a\?b=1&amp;c=2"><b>\$1.5 trillion<\/b><\/a>: AI \$100 a watt<\/li>\n<li>second<\/li>\n<\/ul>/);
  assert.match(html, /<ol>\n<li>first<\/li>\n<\/ol>/);
  assert.match(html, /<blockquote>quoted &lt;b&gt;<\/blockquote>/);
  assert.match(html, /<hr>/);
  assert.match(html, /<p>Plain <i>italic<\/i> and snake_case_name.<\/p>/);
});
