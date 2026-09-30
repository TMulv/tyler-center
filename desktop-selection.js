(function(root) {
  'use strict';
  function rectangle(start,end) {
    return {left:Math.min(start.x,end.x),top:Math.min(start.y,end.y),right:Math.max(start.x,end.x),bottom:Math.max(start.y,end.y)};
  }
  function intersects(a,b) {
    return b.width>0 && b.height>0 && a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top;
  }
  function selectedWithin(box,icons,baseline=[]) {
    return new Set([...baseline,...icons.filter(icon=>intersects(box,icon.rect)).map(icon=>icon.id)]);
  }
  function mount(doc,win) {
    const icons=[...doc.querySelectorAll('.desktop-icons .desktop-icon')];
    const marquee=doc.createElement('div');marquee.className='desktop-selection-box';marquee.hidden=true;marquee.setAttribute('aria-hidden','true');doc.body.append(marquee);
    const status=doc.createElement('div');status.className='desktop-selection-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');doc.body.append(status);
    let selected=new Set(),drag=null,suppressClickUntil=0;
    const background=target=>target?.matches?.('html,body,.desktop-grain,.desktop-icons');
    function select(next,announce=false) {
      selected=next;
      icons.forEach((icon,id)=>{
        icon.classList.toggle('desktop-selected',selected.has(id));
        if(selected.has(id))icon.setAttribute('aria-description','Selected on desktop');else icon.removeAttribute('aria-description');
      });
      if(announce)status.textContent=selected.size?`${selected.size} desktop ${selected.size===1?'icon':'icons'} selected.`:'Desktop selection cleared.';
    }
    function move(event) {
      if(!drag||event.pointerId!==drag.id)return;
      const end={x:Math.max(0,Math.min(win.innerWidth,event.clientX)),y:Math.max(0,Math.min(win.innerHeight,event.clientY))};
      if(!drag.moved && Math.hypot(end.x-drag.start.x,end.y-drag.start.y)<4)return;
      drag.moved=true;const box=rectangle(drag.start,end);
      marquee.hidden=false;
      Object.assign(marquee.style,{left:box.left+'px',top:box.top+'px',width:(box.right-box.left)+'px',height:(box.bottom-box.top)+'px'});
      const visible=icons.map((icon,id)=>({id,rect:icon.getBoundingClientRect()})).filter(item=>{
        if(!intersects(box,item.rect))return false;
        const x=(Math.max(box.left,item.rect.left)+Math.min(box.right,item.rect.right))/2;
        const y=(Math.max(box.top,item.rect.top)+Math.min(box.bottom,item.rect.bottom))/2;
        return icons[item.id].contains(doc.elementFromPoint(x,y));
      });
      select(selectedWithin(box,visible,drag.additive?drag.before:[]));
      event.preventDefault();
    }
    function finish(cancel=false) {
      if(!drag)return;
      const previous=drag;drag=null;
      if(cancel)select(previous.before,true);else select(selected,true);
      if(previous.moved)suppressClickUntil=Date.now()+250;
      marquee.hidden=true;doc.body.classList.remove('desktop-selecting');
      if(doc.body.hasPointerCapture(previous.id))doc.body.releasePointerCapture(previous.id);
    }
    doc.addEventListener('pointerdown',event=>{
      if(event.button!==0 || event.isPrimary===false || event.pointerType==='touch' || !background(event.target) || win.matchMedia('(max-width:760px)').matches)return;
      const before=new Set(selected),additive=event.shiftKey||event.metaKey||event.ctrlKey;
      drag={id:event.pointerId,start:{x:event.clientX,y:event.clientY},before,additive,moved:false};
      if(!additive)select(new Set());
      event.preventDefault();doc.body.classList.add('desktop-selecting');doc.body.setPointerCapture(event.pointerId);
    });
    doc.addEventListener('pointermove',move);
    doc.addEventListener('pointerup',event=>{if(drag&&event.pointerId===drag.id){move(event);finish();}});
    doc.addEventListener('pointercancel',event=>{if(drag&&event.pointerId===drag.id)finish(true);});
    doc.body.addEventListener('lostpointercapture',()=>finish(true));
    win.addEventListener('blur',()=>finish(true));win.addEventListener('resize',()=>finish(true));
    doc.addEventListener('keydown',event=>{
      if(event.key==='Escape'){finish(true);select(new Set(),selected.size>0);}
    });
    doc.addEventListener('click',event=>{
      const icon=event.target.closest?.('.desktop-icons .desktop-icon');
      if(event.detail>0 && Date.now()<suppressClickUntil && (icon||background(event.target))){event.preventDefault();event.stopImmediatePropagation();suppressClickUntil=0;return;}
      if(!icon)return;
      const id=icons.indexOf(icon);
      if(event.shiftKey||event.metaKey||event.ctrlKey){
        const next=new Set(selected);if(next.has(id))next.delete(id);else next.add(id);
        select(next,true);event.preventDefault();event.stopImmediatePropagation();
      }else select(new Set([id]));
    },true);
  }
  const api={rectangle,intersects,selectedWithin,mount};
  if(typeof module!=='undefined')module.exports=api;else{root.DesktopSelection=api;mount(document,window);}
})(globalThis);
