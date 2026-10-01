const test = require('node:test');
const assert = require('node:assert/strict');
const {validate,merge} = require('../feeds.js');
const post = {id:'rss-abc',channel:'writing',title:'Post',publishedAt:'2026-09-28T12:00:00Z',url:'https://bettingantelope.substack.com/p/post'};
test('shared posts override browser copies and retire the sample writing post',()=>{
  assert.deepEqual(merge([{id:'why-site'}, {...post,title:'Stale'},{id:'local'}],[post]),[{id:'local'},post]);
});
test('reject malformed feeds and duplicate IDs before changing the current snapshot',()=>{
  for (const entries of [[post,post],[{...post,channel:'articles'}],[{...post,publishedAt:'bad'}],[{...post,title:null}]]) {
    assert.throws(()=>validate({version:1,entries},'writing'));
  }
});
test('source is fixed and unsafe links and extra fields are discarded',()=>{
  const [entry] = validate({version:1,entries:[{...post,source:'local',image:'evil',url:'javascript:alert(1)',links:[{url:'data:text/html,hi'},{url:'https://example.com',title:'Source'}]}]},'writing');
  assert.equal(entry.source,'rss');assert.equal(entry.url,'');assert.equal(entry.image,undefined);
  assert.equal(entry.links.length,1);
});
test('digest rendering preserves inline links and headings while escaping source HTML',()=>{
  const {renderBody}=require('../feeds.js');
  const [entry]=validate({version:1,entries:[{...post,id:'digest-a',channel:'newsletters',blocks:[
    {type:'heading_2',runs:[{text:'Tech & ideas'}]},
    {type:'paragraph',runs:[{text:'<script>bad</script>',bold:true,url:'https://example.com/story'},{text:' inbox',url:'https://mail.google.com/private'}]}
  ]}]},'newsletters');
  const html=renderBody(entry);
  assert.match(html,/<h3>Tech &amp; ideas<\/h3>/);
  assert.match(html,/href="https:\/\/example.com\/story" target="_blank" rel="noopener noreferrer"/);
  assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|mail\.google/);
});
test('newsletter snapshots survive validation with safe links and one stable edition ID',()=>{
  const view={body:'A growing edition',blocks:[{type:'paragraph',runs:[{text:'Read',url:'https://example.com/story'}]}],
    links:[{url:'https://example.com/story',title:'Source'},{url:'https://mail.google.com/private',title:'Private'}]};
  const [entry]=validate({version:1,entries:[{id:'digest-one',channel:'newsletters',title:'Today',publishedAt:'2026-10-01T12:00:00Z',
    versions:{morning:view,full:view,unexpected:{body:'ignored'}}}]},'newsletters');
  assert.equal(entry.id,'digest-one');
  assert.equal(entry.versions.morning.blocks[0].runs[0].url,'https://example.com/story');
  assert.equal(entry.versions.full.links.length,1);
  assert.equal(entry.versions.unexpected,undefined);
  assert.doesNotMatch(JSON.stringify(entry),/mail\.google/);
});
test('verified story links and bare URLs are clickable without turning markup into HTML',()=>{
  const {linkedText}=require('../feeds.js');
  const html=linkedText('A story + more. https://example.com/read. <b>text</b>',[{text:'A story + more',url:'https://example.com/story'}]);
  assert.equal((html.match(/<a /g)||[]).length,2);
  assert.match(html,/href="https:\/\/example.com\/read"/);
  assert.match(html,/&lt;b&gt;text/);
});
test('preview images accept known source artwork and reject unrelated or unsafe sources',()=>{
  const {previewImage}=require('../feeds.js');
  for(const url of ['https://is1-ssl.mzstatic.com/image/app.jpg','https://substackcdn.com/image/cover.jpg']) {
    assert.equal(previewImage(url),url);
    assert.equal(validate({version:1,entries:[{...post,image:url}]},'writing')[0].image,url);
  }
  for(const url of ['javascript:alert(1)','http://is1-ssl.mzstatic.com/a.jpg','https://is1-ssl.mzstatic.com.evil.example/a.jpg','https://127.0.0.1/a.jpg']) assert.equal(previewImage(url),'');
});

test('Read Later only exposes approved metadata and replaces sample articles',()=>{
  const record={id:'readlater-abc',channel:'articles',title:'Saved story',url:'https://example.com/story',publishedAt:'2026-09-01T12:00:00Z',readingStatus:'Read',note:'PRIVATE',body:'PRIVATE',description:'PRIVATE',blocks:[{runs:[{text:'PRIVATE'}]}],links:[{url:'https://private.example'}]};
  const [entry]=validate({version:1,entries:[record]},'articles');
  assert.equal(entry.readingStatus,'Read');
  assert.equal(entry.source,'notion');
  assert.doesNotMatch(JSON.stringify(entry),/PRIVATE|private.example/);
  assert.deepEqual(merge([{id:'great-work',channel:'articles'},{id:'other',channel:'photography'}],[entry]),[{id:'other',channel:'photography'},entry]);
  assert.throws(()=>validate({version:1,entries:[{...record,readingStatus:'unknown'}]},'articles'));
});

test('Notion built projects are validated without importing files or private fields',()=>{
  const row={id:'domain-abc',channel:'websites',title:'Example.com',url:'https://example.com/',description:'A website',projectStatus:'Practice',publishedAt:'2026-09-30T12:00:00Z',files:'PRIVATE',body:'PRIVATE'};
  const [entry]=validate({version:1,entries:[row]},'websites');
  assert.equal(entry.category,'Website · Practice');assert.equal(entry.source,'notion');
  assert.doesNotMatch(JSON.stringify(entry),/PRIVATE/);
  for(const patch of [{projectStatus:'Sold'},{url:'https://app.notion.com/private'}]) assert.throws(()=>validate({version:1,entries:[{...row,...patch}]},'websites'));
});
test('canonical projects retain TomoTomo, reflect deletions and do not duplicate a source',()=>{
  const {projects}=require('../feeds.js');
  const app={id:'tomotomo',url:'https://apps.apple.com/app/tomotomo'};
  const site={id:'domain-abc',channel:'websites',url:'https://example.com/'};
  assert.deepEqual(projects([app],[site]),[app,site]);
  assert.deepEqual(projects([app],[]),[app]);
  assert.deepEqual(projects([site],[site]),[site]);
});


test('watch metadata includes safe YouTube previews, excludes private content, and removes stale local items',()=>{
 const row={id:'watchlater-a',channel:'watch',title:'A saved video',url:'https://youtu.be/RlSwsE22nX0',mediaType:'YouTube',readingStatus:'Want to see',publishedAt:'2026-09-30T16:52:36Z',note:'SECRET',body:'SECRET',files:['SECRET']};
 const [entry]=validate({version:1,entries:[row]},'watch');
 assert.equal(entry.image,'https://i.ytimg.com/vi/RlSwsE22nX0/hqdefault.jpg');
 assert.doesNotMatch(JSON.stringify(entry),/SECRET/);
 assert.deepEqual(merge([{id:'viral-video',channel:'watch'}],[entry]),[entry]);
 assert.deepEqual(merge([{id:'watchlater-old',channel:'watch'}],[]),[]);
 for(const url of ['https://example.com/watch?v=RlSwsE22nX0','https://youtube.com.evil.example/watch?v=RlSwsE22nX0','https://youtu.be/invalid'])assert.equal(validate({version:1,entries:[{...row,url}]},'watch')[0].image,undefined);
 const [movie]=validate({version:1,entries:[{...row,url:'',mediaType:'Movies'}]},'watch');
 assert.equal(movie.url,'');assert.equal(movie.kind,'Movies');
 assert.throws(()=>validate({version:1,entries:[{...row,mediaType:'Invalid'}]},'watch'));
});


test('project calendar dates remain exact and empty dates do not become import dates',()=>{
 const record={id:'domain-date',channel:'websites',title:'Example.com',url:'https://example.com/',projectStatus:'Live',publishedAt:'2025-05-09'};
 assert.equal(validate({version:1,entries:[record]},'websites')[0].publishedAt,'2025-05-09');
 assert.equal(validate({version:1,entries:[{...record,publishedAt:null}]},'websites')[0].publishedAt,null);
 assert.throws(()=>validate({version:1,entries:[{...record,publishedAt:'invalid'}]},'websites'));
 assert.throws(()=>validate({version:1,entries:[{...post,publishedAt:null}]},'writing'));
});
