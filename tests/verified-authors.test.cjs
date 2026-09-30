const test=require('node:test');
const assert=require('node:assert/strict');
const author=require('../owner-badges.js');
test('verification never follows a typed display name or locally asserted source',()=>{
 assert.equal(author.commentBadge({username:'Tyler'}),'');
 assert.equal(author.commentBadge({username:'Tyler',is_owner:'true'}),'');
 assert.match(author.commentBadge({username:'owner',is_owner:true}),/Verified Tyler/);
 assert.equal(author.trustedPost({id:'local',channel:'articles',source:'notion',name:'Tyler'},[],[]),false);
 assert.equal(author.trustedPost({id:'digest',channel:'newsletters'},[{id:'digest',channel:'newsletters',source:'notion'}],[]),false);
 assert.equal(author.trustedPost({id:'post',channel:'articles'},[{id:'post',channel:'articles',source:'notion'}],[]),true);
 assert.equal(author.trustedPost({id:'app',channel:'websites'},[],[{id:'app'}]),true);
});
