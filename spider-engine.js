(function(root) {
  const copy = state => JSON.parse(JSON.stringify(state));
  function create(mode=1, random=Math.random) {
    if (![1,2,4].includes(mode)) throw new Error('Choose 1, 2, or 4 suits.');
    const deck=[];
    for(let pack=0;pack<8;pack++) for(let rank=1;rank<=13;rank++) deck.push({id:`${pack}-${rank}`,rank,suit:pack%mode,up:false});
    for(let i=deck.length-1;i>0;i--) {const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
    const columns=Array.from({length:10},(_,i)=>deck.splice(0,i<4?6:5));
    columns.forEach(column=>{column.at(-1).up=true;});
    return {mode,columns,stock:deck,completed:[],moves:0};
  }
  function movable(column,index) {
    if (!column || !Number.isInteger(index) || index<0 || index>=column.length) return false;
    return column.slice(index).every((card,i,run)=>card.up && (!i || (run[i-1].rank===card.rank+1 && run[i-1].suit===card.suit)));
  }
  function canMove(state,from,index,to) {
    if (!Number.isInteger(from)||!Number.isInteger(to)||from===to||!state.columns[to]||!movable(state.columns[from],index)) return false;
    const target=state.columns[to].at(-1);
    return !target || (target.up && target.rank===state.columns[from][index].rank+1);
  }
  function settle(state) {
    for(const column of state.columns) {
      if(column.length) column.at(-1).up=true;
      while(column.length>=13) {
        const run=column.slice(-13);
        if(!run.every((card,i)=>card.up && card.suit===run[0].suit && card.rank===13-i)) break;
        state.completed.push(column.splice(-13));
        if(column.length) column.at(-1).up=true;
      }
    }
    return state;
  }
  function move(state,from,index,to) {
    if(!canMove(state,from,index,to)) return null;
    const next=copy(state);
    next.columns[to].push(...next.columns[from].splice(index));
    next.moves++;
    return settle(next);
  }
  function deal(state) {
    if(state.stock.length<10 || state.columns.some(column=>!column.length)) return null;
    const next=copy(state);
    next.columns.forEach(column=>{const card=next.stock.pop();card.up=true;column.push(card);});
    next.moves++;
    return settle(next);
  }
  function hint(state) {
    const moves=[];
    state.columns.forEach((column,from)=>column.forEach((card,index)=>{
      if(!movable(column,index)) return;
      state.columns.forEach((target,to)=>{
        if(!canMove(state,from,index,to) || (!target.length && index===0)) return;
        const score=(index>0&&!column[index-1].up?10:0)+(target.at(-1)?.suit===card.suit?5:0)+(column.length-index);
        moves.push({from,index,to,score});
      });
    }));
    return moves.sort((a,b)=>b.score-a.score)[0] || null;
  }
  function valid(state) {
    if(!state || ![1,2,4].includes(state.mode) || !Number.isInteger(state.moves) || state.moves<0 || !Array.isArray(state.columns) || state.columns.length!==10 || !state.columns.every(Array.isArray) || !Array.isArray(state.stock) || !Array.isArray(state.completed) || state.completed.length>8 || !state.completed.every(run=>Array.isArray(run)&&run.length===13)) return false;
    const cards=[...state.columns.flat(),...state.stock,...state.completed.flat()];
    return cards.length===104 && new Set(cards.map(c=>c?.id)).size===104 && cards.every(c=>c&&typeof c.id==='string'&&Number.isInteger(c.rank)&&c.rank>=1&&c.rank<=13&&Number.isInteger(c.suit)&&c.suit>=0&&c.suit<state.mode&&typeof c.up==='boolean');
  }
  const api={create,movable,canMove,move,deal,hint,valid,won:state=>state.completed.length===8};
  if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.SpiderEngine=api;
})(globalThis);
