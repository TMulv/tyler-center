(function(root) {
  const E=root.SpiderEngine, suits=['♠','♥','♣','♦'], suitNames=['spades','hearts','clubs','diamonds'];
  let state=null, history=[], selected=null, host=null, message='Build eight runs from King to Ace. Click a card, then a column.', hintTarget=null, pendingNew=false;
  const rank=n=>({1:'A',11:'J',12:'Q',13:'K'}[n]||n);
  const name=card=>`${rank(card.rank)} of ${suitNames[card.suit]}`;
  function save() {try {localStorage.setItem('tyler-spider-v1',JSON.stringify({state,history:history.slice(-40)}));} catch {message='Game works for this visit. This browser could not save it.';}}
  function load() {
    if(state) return;
    try {const saved=JSON.parse(localStorage.getItem('tyler-spider-v1'));if(E.valid(saved?.state)){state=saved.state;history=Array.isArray(saved.history)?saved.history.filter(E.valid).slice(-40):[];message='Your game is back where you left it.';}}
    catch { /* Start a fresh game if storage is missing or damaged. */ }
    if(!state) state=E.create(1);
  }
  function commit(next) {
    if(!next) return false;
    history.push(state);history=history.slice(-40);state=next;selected=null;hintTarget=null;
    message=E.won(state)?'You won. All eight runs are complete.':`${state.completed.length} of 8 runs complete. ${state.moves} moves.`;
    save();render();return true;
  }
  function choose(from,index) {
    if(!E.movable(state.columns[from],index)){message='Only a descending run of the same suit can move together.';render();return;}
    selected={from,index};hintTarget=null;message=`Selected ${name(state.columns[from][index])}. Choose a column.`;render();
  }
  function place(to,index=null) {
    if(selected && selected.from!==to) {
      if(commit(E.move(state,selected.from,selected.index,to))) return;
      message='Place the run on a card one rank higher, or in an empty column.';render();return;
    }
    if(index!==null) {
      if(selected?.from===to && selected.index===index){selected=null;message='Selection cleared.';render();}
      else choose(to,index);
    } else {message='Select a face-up card first.';render();}
  }
  function render() {
    if(!host?.isConnected) return;
    const focused=host.contains(document.activeElement)?document.activeElement:null;
    const focusSelector=focused?.dataset.spiderAction?`[data-spider-action="${focused.dataset.spiderAction}"]`:focused?.dataset.card!==undefined?`[data-col="${focused.dataset.col}"][data-card="${focused.dataset.card}"]`:focused?.dataset.emptyCol!==undefined?`[data-empty-col="${focused.dataset.emptyCol}"]`:focused?.id==='spiderMode'?'#spiderMode':null;
    const board=state.columns.map((column,col)=>{
      let top=0;
      const cards=column.map((card,index)=>{
        const y=top;top+=card.up?29:13;
        const isSelected=selected?.from===col&&index>=selected.index;
        if(!card.up) return `<span class="playing-card card-back" style="top:${y}px" aria-label="Face-down card"></span>`;
        return `<button class="playing-card ${card.suit%2?'red-suit':''} ${isSelected?'card-selected':''}" style="top:${y}px" data-card="${index}" data-col="${col}" draggable="${E.movable(column,index)}" aria-label="${name(card)}, column ${col+1}" aria-pressed="${isSelected}"><span class="card-corner">${rank(card.rank)} ${suits[card.suit]}</span><span class="card-suit" aria-hidden="true">${suits[card.suit]}</span></button>`;
      }).join('');
      return `<div class="spider-column ${hintTarget===col?'hint-target':''}" data-drop-col="${col}" style="min-height:${Math.max(126,top+95)}px"><button class="column-target" data-empty-col="${col}" aria-label="${column.length?'Place selected cards in':'Empty'} column ${col+1}"><span>${col+1}</span></button>${cards}</div>`;
    }).join('');
    host.innerHTML=`<section class="spider-game" aria-label="Spider Solitaire"><div class="spider-heading"><div><div class="eyebrow">A LITTLE BREAK</div><h1>Spider Solitaire</h1></div><span class="spider-score">${state.completed.length}/8 runs · ${state.moves} moves</span></div><div class="spider-toolbar"><label>Suits <select id="spiderMode" aria-label="Number of suits"><option value="1" ${state.mode===1?'selected':''}>1 suit · Easy</option><option value="2" ${state.mode===2?'selected':''}>2 suits · Medium</option><option value="4" ${state.mode===4?'selected':''}>4 suits · Hard</option></select></label><button data-spider-action="new">New game</button><button data-spider-action="undo" ${history.length?'':'disabled'}>Undo</button><button data-spider-action="hint" ${E.won(state)?'disabled':''}>Hint</button><button class="stock-button" data-spider-action="deal" ${state.stock.length?'':'disabled'}>Deal 10 <span>(${state.stock.length/10} left)</span></button></div>${pendingNew?'<div class="new-game-prompt">Start over? Your current game will be replaced. <button data-spider-action="confirm-new">Start new game</button><button data-spider-action="cancel-new">Keep playing</button></div>':''}<div class="spider-status" role="status" aria-live="polite">${message}</div>${E.won(state)?'<div class="spider-win">Eight runs. Nicely done. ✳</div>':''}<div class="spider-board-scroll"><div class="spider-board">${board}</div></div><div class="spider-foundations" aria-label="Completed runs">${Array.from({length:8},(_,i)=>`<span class="${state.completed[i]?'complete':''}" aria-label="${state.completed[i]?'Completed run':'Empty run slot'} ${i+1}">${state.completed[i]?suits[state.completed[i][0].suit]:'K—A'}</span>`).join('')}</div><details class="spider-help"><summary>How to play</summary><p>Move cards in descending order: 9 onto 10, 8 onto 9. Any suit can go onto the next rank. Move several cards together only when they descend in the same suit. Any movable card or run can fill an empty column.</p><p>A complete same-suit King-to-Ace run clears automatically. Clear all eight to win. Fill every empty column before dealing ten more cards. Click or tap a card, then its destination; dragging works too. Use Tab and Enter to play with the keyboard. Undo reverses moves and deals. Your game saves on this device.</p></details></section>`;
    if(focusSelector){const next=host.querySelector(focusSelector);if(next&&!next.disabled)next.focus({preventScroll:true});}
  }
  let nextMode=1;
  function onClick(event) {
    const action=event.target.closest('[data-spider-action]')?.dataset.spiderAction;
    if(action) {
      if(action==='new'){nextMode=Number(host.querySelector('#spiderMode').value);pendingNew=true;}
      if(action==='cancel-new')pendingNew=false;
      if(action==='confirm-new'){state=E.create(nextMode);history=[];selected=null;hintTarget=null;pendingNew=false;message='Fresh deck. Build eight runs from King to Ace.';save();}
      if(action==='undo'&&history.length){state=history.pop();selected=null;hintTarget=null;message='Undid the last move.';save();}
      if(action==='deal'){if(commit(E.deal(state)))return;message=state.stock.length?'Fill all ten columns before dealing.':'No stock cards left.';}
      if(action==='hint'){const move=E.hint(state);if(move){selected={from:move.from,index:move.index};hintTarget=move.to;message=`Try ${name(state.columns[move.from][move.index])} from column ${move.from+1} to column ${move.to+1}.`;}else message=state.stock.length?'No useful move found. Try dealing a new row.':'No useful move found. Try Undo or start a new game.';}
      render();return;
    }
    const card=event.target.closest('[data-card]');
    if(card){place(Number(card.dataset.col),Number(card.dataset.card));return;}
    const column=event.target.closest('[data-empty-col]');if(column)place(Number(column.dataset.emptyCol));
  }
  function mount(target) {
    load();host=target;render();
    host.onclick=onClick;
    host.onchange=event=>{if(event.target.id==='spiderMode'){nextMode=Number(event.target.value);pendingNew=true;render();}};
    host.ondragstart=event=>{const card=event.target.closest('[data-card]');if(!card||!E.movable(state.columns[Number(card.dataset.col)],Number(card.dataset.card))){event.preventDefault();return;} selected={from:Number(card.dataset.col),index:Number(card.dataset.card)};event.dataTransfer.setData('text/plain','tyler-spider');event.dataTransfer.effectAllowed='move';};
    host.ondragover=event=>{if(selected&&event.target.closest('[data-drop-col]'))event.preventDefault();};
    host.ondrop=event=>{const column=event.target.closest('[data-drop-col]');if(column&&selected){event.preventDefault();place(Number(column.dataset.dropCol));}};
    host.ondragend=()=>{selected=null;render();};
  }
  function unmount(){if(host){host.onclick=host.onchange=host.ondragstart=host.ondragover=host.ondrop=host.ondragend=null;}host=null;}
  root.SpiderGame={mount,unmount};
})(globalThis);
