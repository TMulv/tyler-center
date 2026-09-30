const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../spider-engine.js');
const card=(rank,suit=0,up=true,id=`${rank}-${suit}`)=>({rank,suit,up,id});
const empty=()=>({mode:4,columns:Array.from({length:10},()=>[]),stock:[],completed:[],moves:0});
for(const mode of [1,2,4]) test(`${mode}-suit opening deals exactly 104 unique cards and reveals ten`,()=>{
 const state=E.create(mode,()=>.42);
 assert.equal(E.valid(state),true);
 assert.deepEqual(state.columns.map(c=>c.length),[6,6,6,6,5,5,5,5,5,5]);
 assert.equal(state.stock.length,50);
 assert.equal(state.columns.flat().filter(c=>c.up).length,10);
 const counts=Array(mode).fill(0);[...state.columns.flat(),...state.stock].forEach(c=>counts[c.suit]++);
 assert.deepEqual(counts,Array(mode).fill(104/mode));
});
test('moves only descending same-suit runs; destinations can have a different suit',()=>{
 const state=empty();state.columns[0]=[card(10,0),card(9,0),card(8,0)];state.columns[1]=[card(11,1)];
 assert.equal(E.canMove(state,0,0,1),true);
 const moved=E.move(state,0,0,1);
 assert.equal(moved.columns[1].length,4);assert.equal(moved.moves,1);assert.equal(state.columns[0].length,3);
 state.columns[0][1].suit=2;
 assert.equal(E.canMove(state,0,0,1),false);
 assert.equal(E.canMove(state,0,2,2),true);
 assert.equal(E.canMove(state,0,1,0),false);
 assert.equal(E.canMove(state,0,-1,2),false);
 state.columns[0][2].up=false;assert.equal(E.canMove(state,0,2,2),false);
});
test('reveals an uncovered card and refuses invalid ranks without mutating',()=>{
 const state=empty();state.columns[0]=[card(4,1,false),card(8)];state.columns[1]=[card(9)];state.columns[2]=[card(3)];
 assert.equal(E.move(state,0,1,2),null);
 const next=E.move(state,0,1,1);assert.equal(next.columns[0][0].up,true);assert.equal(state.columns[0][0].up,false);
});
test('stock deals one card to every column and cannot deal across an empty column',()=>{
 const state=E.create(1);const next=E.deal(state);
 assert.equal(next.stock.length,40);assert.equal(next.columns.flat().length,64);assert.equal(next.moves,1);assert.equal(E.valid(next),true);
 assert.equal(state.stock.length,50);
 state.columns[3]=[];assert.equal(E.deal(state),null);
 const noStock=E.create();noStock.stock=[];assert.equal(E.deal(noStock),null);
});
test('a same-suit King-to-Ace run clears and reveals the card beneath',()=>{
 const state=empty();state.columns[0]=[card(5,1,false),...Array.from({length:12},(_,i)=>card(13-i))];state.columns[1]=[card(1)];
 const next=E.move(state,1,0,0);
 assert.equal(next.completed.length,1);assert.equal(next.completed[0].length,13);assert.equal(next.columns[0][0].up,true);assert.equal(next.columns[0].length,1);
});
test('mixed-suit King-to-Ace does not clear, and the eighth completed run wins',()=>{
 const state=empty();state.columns[0]=Array.from({length:12},(_,i)=>card(13-i,i===4?1:0));state.columns[1]=[card(1)];
 assert.equal(E.move(state,1,0,0).completed.length,0);
 state.columns[0][4].suit=0;state.completed=Array.from({length:7},()=>Array.from({length:13},(_,i)=>card(13-i)));
 assert.equal(E.won(E.move(state,1,0,0)),true);
});
test('hint gives a legal move, and long play preserves all cards',()=>{
 let state=E.create(2,()=>.37);
 for(let i=0;i<60;i++){
  const hint=E.hint(state);
  if(hint){assert.equal(E.canMove(state,hint.from,hint.index,hint.to),true);state=E.move(state,hint.from,hint.index,hint.to);}
  else {const next=E.deal(state);if(!next)break;state=next;}
  assert.equal(E.valid(state),true);
 }
});
test('damaged saved games are rejected',()=>{
 assert.equal(E.valid(null),false);
 const state=E.create();state.columns[0][0].rank=99;assert.equal(E.valid(state),false);
});
