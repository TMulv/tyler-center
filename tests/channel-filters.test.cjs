const test=require('node:test');
const assert=require('node:assert/strict');
const {apply,options}=require('../channel-filters.js');
const app={id:'app',title:'TomoTomo',url:'https://apps.apple.com/us/app/tomotomo/id6778601579',category:'App · iPhone & iPad',created:'2026-09-30'};
const site={id:'site',title:'My website',category:'Personal website',created:'2025-01-01'};
test('project filters distinguish apps and websites without mutating the channel',()=>{
  const records=[app,site];
  assert.deepEqual(apply(records,'websites',{type:'Apps'}),[app]);
  assert.deepEqual(apply(records,'websites',{type:'Websites'}),[site]);
  assert.deepEqual(apply(records,'websites',{type:'Apps',year:'2025'}),[]);
  assert.deepEqual(apply(records,'websites',{}),records);
  assert.equal(records.length,2);
});
test('search and year combine, handle missing dates, and preserve chronological input order',()=>{
  const records=[{id:'a',title:'NFL Week 1',publishedAt:'2019-09-01T14:00:00Z'}, {id:'b',title:'NFL Week 2',publishedAt:'2026-09-10T14:00:00Z'}, {id:'c',title:'NFL notes'}];
  assert.deepEqual(apply(records,'writing',{year:'2019',query:' nfl '}),[records[0]]);
  assert.deepEqual(apply(records,'writing',{query:'nothing'}),[]);
  assert.deepEqual(options(records,'writing').years,['2026','2019']);
});
test('article type options come from real content',()=>{
  const records=[{kind:'Essay'},{kind:'Article'}];
  assert.deepEqual(options(records,'articles').types,['Article','Essay']);
  assert.deepEqual(apply(records,'articles',{type:'Essay'}),[records[0]]);
});

test('Tyler reading status combines with year and search independently of visitor unread state',()=>{
  const records=[{title:'Saved story',readingStatus:'Read',publishedAt:'2026-01-01'},{title:'Next story',readingStatus:'To Read',publishedAt:'2026-01-02'},{title:'Unmarked',readingStatus:'Not marked',publishedAt:'2025-01-01'}];
  assert.deepEqual(apply(records,'articles',{status:'Read',year:'2026',query:'story'}),[records[0]]);
  assert.deepEqual(apply(records,'articles',{status:'Not marked'}),[records[2]]);
  assert.deepEqual(apply(records,'articles',{}),records);
});


test('watch filters include requested formats and combine type, status and search',()=>{
 const rows=[{title:'Interview',mediaType:'YouTube',readingStatus:'Want to see'},{title:'Interview podcast',mediaType:'Podcasts',readingStatus:'Finished'},{title:'Film',mediaType:'Movies',readingStatus:'Finished'}];
 for(const type of ['YouTube','Online','Movies','Podcasts','TV Shows','Documentaries','Books'])assert.ok(options(rows,'watch').types.includes(type));
 assert.deepEqual(apply(rows,'watch',{type:'Podcasts',status:'Finished',query:'interview'}),[rows[1]]);
 assert.deepEqual(apply(rows,'watch',{type:'Online'}),[]);
 assert.deepEqual(apply(rows,'watch',{}),rows);
});
