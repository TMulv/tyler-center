const test=require('node:test');
const assert=require('node:assert/strict');
const {editions,editionView}=require('../email-app.js');
const filters=require('../channel-filters.js');
const state=require('../unread.js');
test('Email contains only published Notion newsletter editions, without changing feed order',()=>{
 const old={id:'digest-old',channel:'newsletters',source:'notion',publishedAt:'2026-09-29T12:00:00Z'};
 const newest={id:'digest-new',channel:'newsletters',source:'notion',publishedAt:'2026-09-30T12:00:00Z'};
 const all=[old,{id:'local',channel:'newsletters'},newest,{id:'rss',channel:'writing',source:'rss'}, {id:'article',channel:'articles',source:'notion'}];
 assert.deepEqual(editions(all),[newest,old]);
 assert.equal(all[0],old);
 assert.equal(all.length,5);
});
test('Email preserves prior newsletter read markers and reads only the opened edition',()=>{
 const rows=editions([{id:'a',channel:'newsletters',source:'notion',publishedAt:'2026-09-29',body:'First'}, {id:'b',channel:'newsletters',source:'notion',publishedAt:'2026-09-30',body:'Second'}]);
 let seen=state.markSeen([rows[1]],{},'newsletters');
 assert.equal(state.count(rows,seen,'newsletters'),1);
 seen=state.markSeen([rows[0]],seen,'newsletters');
 assert.equal(state.count(rows,seen,'newsletters'),0);
 assert.equal(state.count([{...rows[0],body:'Updated'}],seen,'newsletters'),1);
});
test('inbox source and search filters match linked publishers and keep newest-first order',()=>{
 const rows=editions([{id:'a',channel:'newsletters',source:'notion',publishedAt:'2026-09-29',title:'AI yesterday',links:[{url:'https://www.wired.com/a'}]}, {id:'b',channel:'newsletters',source:'notion',publishedAt:'2026-09-30',title:'AI today',links:[{url:'https://wired.com/b'}]}]);
 assert.deepEqual(filters.apply(rows,'newsletters',{source:'wired.com',query:'AI'}).map(r=>r.id),['b','a']);
});
test('snapshot switcher reads a selected pass and Full follows the latest cumulative pass',()=>{
 const record={id:'digest-one',body:'Current',versions:{morning:{body:'Morning'},afternoon:{body:'Afternoon'},full:{body:'Afternoon'}}};
 assert.equal(editionView(record,'morning').body,'Morning');
 assert.equal(editionView(record,'full').body,'Afternoon');
 assert.equal(editionView(record,'evening').body,'Afternoon');
 assert.equal(editionView({id:'legacy',body:'Archive'},'full').body,'Archive');
});
