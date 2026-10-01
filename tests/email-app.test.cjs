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
test('time buttons show only additions while All shows the complete latest newsletter',()=>{
 const block=(type,text,url='')=>({type,runs:[{text,url}]});
 const morning=[block('paragraph','Opening summary'),block('heading_2','Today’s Numbers'),block('bulleted_list_item','10: First fact'),block('heading_2','Stories'),block('heading_3','First story'),block('paragraph','First report','https://example.com/first')];
 const afternoon=[block('paragraph','Rewritten summary'),block('heading_2','Today’s Numbers'),block('bulleted_list_item','10: First fact'),block('bulleted_list_item','20: New fact'),block('heading_2','Stories'),block('heading_3','First story'),block('paragraph','First report','https://example.com/first'),block('heading_3','Second story'),block('paragraph','Second report','https://example.com/second')];
 const evening=[...afternoon,block('heading_2','Quick hits'),block('bulleted_list_item','Late item')];
 const body=blocks=>blocks.map(b=>b.runs[0].text).join('\n\n');
 const links=[{title:'First report',url:'https://example.com/first'},{title:'Second report',url:'https://example.com/second'}];
 const record={id:'digest-one',body:body(evening),versions:{midday:{body:body(morning),blocks:morning,links},afternoon:{body:body(afternoon),blocks:afternoon,links},evening:{body:body(evening),blocks:evening,links},full:{body:body(evening),blocks:evening,links}}};
 assert.equal(editionView(record,'midday').body,body(morning));
 const update=editionView(record,'afternoon');
 assert.deepEqual(update.blocks.map(b=>b.runs[0].text),['Today’s Numbers','20: New fact','Stories','Second story','Second report']);
 assert.deepEqual(update.links.map(link=>link.title),['Second report']);
 assert.deepEqual(editionView(record,'evening').blocks.map(b=>b.runs[0].text),['Quick hits','Late item']);
 assert.equal(editionView({...record,versions:{...record.versions,evening:record.versions.afternoon}},'evening').empty,true);
 assert.equal(editionView(record,'full').body,body(evening));
 assert.equal(editionView(record,'morning').body,body(evening));
 assert.equal(editionView({id:'legacy',body:'Archive'},'full').body,'Archive');
});
