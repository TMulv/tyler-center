const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
function context(){
 const ctx=vm.createContext({URL,URLSearchParams,esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),safeUrl:v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}},domainOf:v=>new URL(v).hostname,safeImage:()=>'',ChannelFeeds:{previewImage:()=>''}});
 vm.runInContext(fs.readFileSync(path.join(root,'link-previews.js'),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(path.join(root,'preview-cards.js'),'utf8'),ctx);
 vm.runInContext('PUBLIC_PREVIEWS='+JSON.stringify(JSON.parse(fs.readFileSync(path.join(root,'data/previews.json'),'utf8')).previews),ctx);
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 vm.runInContext(app.slice(app.indexOf('function linkPreview('),app.indexOf('function renderChannelFilters(')),ctx);
 return ctx;
}
test('every published project and the app have a visual, title, description and external-link cue',()=>{
 const ctx=context();
 const entries=JSON.parse(fs.readFileSync(path.join(root,'data/websites.json'),'utf8')).entries;
 entries.push({channel:'websites',title:'TomoTomo',url:'https://apps.apple.com/us/app/tomotomo/id6778601579',description:'Read and listen.'});
 for(const entry of entries){
  ctx.entry=entry;const html=vm.runInContext('linkPreview(entry)',ctx);
  assert.match(html,/source-preview-image|project-page-preview|project-brand-preview/,entry.title);
  assert.ok(html.includes(ctx.esc(entry.title)),entry.title);
  assert.ok(html.includes(ctx.esc(entry.description)),entry.title);
  assert.match(html,/Open original/);
 }
});
test('only reviewed sites get a sandboxed miniature; blocked and arbitrary sites do not',()=>{
 const ctx=context();
 for(const url of ['https://gatorademovie.com/','https://tyler.center/']) {
  ctx.entry={url,title:'Project'};
  const html=vm.runInContext('projectPreviewVisual(entry,{},"")',ctx);
  assert.match(html,/sandbox=/);assert.match(html,/inert/);assert.match(html,/loading="lazy"/);
  assert.doesNotMatch(html,/allow-same-origin|allow-forms|allow-top-navigation/);
 }
 for(const url of ['https://butter.living/','https://unreviewed.example/','https://tyler.center.attacker.example/']) {
  ctx.entry={url,title:'<script>bad</script>'};
  const html=vm.runInContext('projectPreviewVisual(entry,{},"")',ctx);
  assert.doesNotMatch(html,/<iframe|<script>/);
  assert.match(html,/project-brand-preview/);
 }
});
test('self-preview exits before database, feed polling, or accounts load',async()=>{
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');let navigated='',styled='';
 const ctx=vm.createContext({window:{self:{},top:{}},URLSearchParams,location:{search:'?project-preview=1'},document:{documentElement:{classList:{add:v=>styled=v}}},navigate:v=>navigated=v});
 vm.runInContext(app.slice(app.indexOf('async function initialize()'),app.indexOf('async function refreshFeeds()')),ctx);
 await vm.runInContext('initialize()',ctx);
 assert.equal(navigated,'home');assert.equal(styled,'project-preview-mode');
});

test('preview mode never initializes reader accounts or comments',()=>{
 for(const file of ['reader-ui.js','reader-comments.js']){
  vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),{document:{documentElement:{classList:{contains:()=>true}}}});
 }
});
