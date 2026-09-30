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
