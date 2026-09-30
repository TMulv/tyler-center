const test=require('node:test');
const assert=require('node:assert/strict');
const {rectangle,selectedWithin,mount}=require('../desktop-selection.js');
function fixture(){
 const listeners={},winListeners={};
 function element(name,rect={left:0,top:0,right:0,bottom:0,width:0,height:0}){
  const classes=new Set();return {name,rect,style:{},attrs:{},hidden:false,
   classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k),toggle(k,on){on?classes.add(k):classes.delete(k);}},
   setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},append(child){children.push(child);},
   addEventListener(k,fn){(listeners[name+':'+k]||=[]).push(fn);},
   setPointerCapture(id){this.capture=id;},hasPointerCapture(id){return this.capture===id;},releasePointerCapture(){this.capture=null;},
   matches(){return name==='body';},closest(){return name.startsWith('icon')?this:null;},contains(target){return this===target;},getBoundingClientRect(){return rect;}};
 }
 const children=[],body=element('body'),windowElement=element('app-window');
 const icons=[element('icon0',{left:800,top:100,right:860,bottom:170,width:60,height:70}),element('icon1',{left:800,top:200,right:860,bottom:270,width:60,height:70})];
 let narrow=false,covered=false;
 const doc={body,querySelectorAll:()=>icons,createElement:()=>element('new'),addEventListener(k,fn){(listeners[k]||=[]).push(fn);},elementFromPoint(x,y){return covered?windowElement:icons.find(i=>x>=i.rect.left&&x<i.rect.right&&y>=i.rect.top&&y<i.rect.bottom)||body;}};
 const win={innerWidth:1000,innerHeight:800,matchMedia:()=>({matches:narrow}),addEventListener(k,fn){winListeners[k]=fn;}};
 mount(doc,win);
 function dispatch(type,data={}){const event={target:body,button:0,pointerId:1,pointerType:'mouse',clientX:750,clientY:80,detail:1,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...data};for(const fn of listeners[type]||[]){fn(event);if(event.stopped)break;}return event;}
 return{body,icons,windowElement,children,dispatch,winListeners,narrow(){narrow=true;},cover(){covered=true;},selection:()=>icons.map(i=>i.classList.contains('desktop-selected'))};
}
test('reverse drag, partial overlap and additive selection work with actual rectangles',()=>{
 const box=rectangle({x:100,y:100},{x:0,y:0});
 assert.deepEqual(box,{left:0,top:0,right:100,bottom:100});
 const icons=[{id:1,rect:{left:90,top:90,right:120,bottom:120,width:30,height:30}},{id:2,rect:{left:100,top:0,right:120,bottom:20,width:20,height:20}}];
 assert.deepEqual([...selectedWithin(box,icons,[3])],[3,1]);
});
test('desktop drag selects icons, ends cleanly, and suppresses accidental activation',()=>{
 const f=fixture();f.dispatch('pointerdown',{clientX:900,clientY:300});
 f.dispatch('pointermove',{clientX:790,clientY:90});assert.deepEqual(f.selection(),[true,true]);
 assert.equal(f.children[0].hidden,false);
 f.dispatch('pointerup',{clientX:790,clientY:90});assert.equal(f.children[0].hidden,true);assert.equal(f.body.capture,null);
 assert.equal(f.dispatch('click',{target:f.icons[0]}).stopped,true);
 f.dispatch('keydown',{key:'Escape'});assert.deepEqual(f.selection(),[false,false]);
});
test('window interactions, touch and covered icons are not selected',()=>{
 const f=fixture();assert.equal(f.dispatch('pointerdown',{target:f.windowElement}).prevented,undefined);
 assert.equal(f.dispatch('pointerdown',{pointerType:'touch'}).prevented,undefined);
 f.cover();f.dispatch('pointerdown');f.dispatch('pointermove',{clientX:900,clientY:300});assert.deepEqual(f.selection(),[false,false]);
 f.dispatch('pointercancel');f.narrow();assert.equal(f.dispatch('pointerdown').prevented,undefined);
});
test('shift adds to selection, cancellation restores it, empty click clears it',()=>{
 const f=fixture();f.dispatch('click',{target:f.icons[0],detail:0});
 f.dispatch('pointerdown',{clientY:190,shiftKey:true});f.dispatch('pointerup',{clientX:900,clientY:280});assert.deepEqual(f.selection(),[true,true]);
 f.dispatch('pointerdown');f.dispatch('pointermove',{clientX:770,clientY:95});assert.deepEqual(f.selection(),[false,false]);
 f.dispatch('pointercancel');assert.deepEqual(f.selection(),[true,true]);assert.equal(f.children[0].hidden,true);
 f.dispatch('pointerdown');f.dispatch('pointerup');assert.deepEqual(f.selection(),[false,false]);
});
