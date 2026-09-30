const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
test('username channel remains available while setup is pending and explains privacy and commenting',()=>{
 const hosts=new Map(),listeners={};
 const ctx={ReaderAccount:require('../reader-account.js'),VerifiedAuthor:require('../owner-badges.js'),TYLER_READER_CONFIG:{enabled:false},activeChannel:'private',esc:String,setInterval(){},document:{addEventListener(name,fn){listeners[name]=fn;}},$:(key)=>{if(!hosts.has(key))hosts.set(key,{innerHTML:'',textContent:''});return hosts.get(key);}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../reader-ui.js'),'utf8'),ctx);
 assert.match(hosts.get('#readerNav').innerHTML,/data-channel="private"/);
 assert.match(hosts.get('#readerNav').innerHTML,/your-username/);
 ctx.ReaderUI.renderChannel();
 const html=hosts.get('#content').innerHTML;
 for(const text of ['Create your account','Save for later','Join the conversation','Comments are public','saved channel is private','still being connected'])assert.ok(html.includes(text),text);
 assert.equal(html.includes('data-reader-action="account"'),false,'Disabled accounts must not offer fake signup');
});
