const {test} = require('node:test');
const assert = require('node:assert/strict');
const {count, markRead} = require('../unread.js');
const articles = [{id:'a', title:'First article', note:'Worth a look'}, {id:'b', title:'Second article'}];
test('first visit badges populated channels, not empty ones',()=>{
  assert.equal(count(articles, {}, 'articles'),2);
  assert.equal(count([], {}, 'photography'),0);
});
test('reading a channel survives reload without marking another channel read',()=>{
  const state=JSON.parse(JSON.stringify(markRead(articles, {}, 'articles')));
  assert.equal(count(articles,state,'articles'),0);
  assert.equal(count([{id:'site',title:'A site'}],state,'websites'),1);
});
test('new and edited items become unread; unchanged items and reordered fields do not',()=>{
  const state=markRead(articles, {}, 'articles');
  assert.equal(count([...articles,{id:'c',title:'New'}],state,'articles'),1);
  assert.equal(count([{...articles[0],note:'Updated note'},articles[1]],state,'articles'),1);
  assert.equal(count([{title:'First article',note:'Worth a look',id:'a'},articles[1]],state,'articles'),0);
  assert.equal(count([articles[1]],state,'articles'),0);
});
test('malformed storage is treated as unread and can be repaired',()=>{
  for(const state of [null, false, 'bad', [], {articles:null}]) {
    assert.equal(count(articles,state,'articles'),2);
    assert.equal(count(articles,markRead(articles,state,'articles'),'articles'),0);
  }
});
test('record IDs cannot collide with inherited object properties',()=>{
  const records=[{id:'__proto__',title:'A'},{id:'constructor',title:'B'}];
  const state=JSON.parse(JSON.stringify(markRead(records,{},'articles')));
  assert.equal(count(records,{},'articles'),2);
  assert.equal(count(records,state,'articles'),0);
});
