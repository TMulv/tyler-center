const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('sold domain links only to its transfer proof', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const ctx = vm.createContext({
    URL,
    esc: value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
    safeUrl: value => { try { return new URL(value).href; } catch { return ''; } },
    safeImage: () => '',
    domainOf: value => new URL(value).hostname,
    isAppStoreProject: () => false,
  });
  vm.runInContext(app.slice(app.indexOf('const STARTER_PROJECTS ='), app.indexOf('const STARTER_ENTRIES =')), ctx);
  vm.runInContext(app.slice(app.indexOf('function projectCard('), app.indexOf('function render()')), ctx);
  const project = vm.runInContext("STARTER_PROJECTS.find(project => project.title === 'Kanye2024.com')", ctx);
  const html = ctx.projectCard(project);
  assert.match(html, /<span class="sold-stamp">SOLD<\/span>/);
  assert.match(html, /first domain purchase and sale i made/);
  assert.match(html, /href="assets\/kanye2024-transfer-confirmation.png"/);
  assert.doesNotMatch(html, /href="https:\/\/kanye2024.com/);
  assert.doesNotMatch(html, /sale price|sold for|\$[0-9]/i);
  assert.ok(fs.existsSync(path.join(root, 'assets/kanye2024-transfer-confirmation.png')));
});
