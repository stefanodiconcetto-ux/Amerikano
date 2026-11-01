/* Advanced statistics: deterministic, read-only analysis of completed games. */
(function(root){
'use strict';
const num=x=>x===null||x===undefined||x===''||!Number.isFinite(Number(x))?null:Number(x);
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const fmt=v=>v===null||v===undefined||!Number.isFinite(v)?'—':String(Math.round(v*10)/10).replace('.',',');
const pct=(n,d)=>d?Math.round(100*n/d)+'%':'—';
const rank=values=>values.map(v=>1+values.filter(x=>x<v).length);
function winner(round){
 if(Number.isInteger(round?.winner)&&round.winner>=0&&round.winner<(round.results||[]).length)return round.winner;
 const flags=(round?.results||[]).map((x,i)=>x?.winner===true?i:-1).filter(i=>i>=0);
 return flags.length===1?flags[0]:null;
}
const contract=n=>({number:n,hands:0,points:[],closures:0,closuresKnown:0,notOpened:0,openingKnown:0,lostPoints:[],chosen:[],notChosen:[],entries:[]});
const person=name=>({name,games:0,hands:0,points:[],closed:0,closeKnown:0,lostPoints:[],openingKnown:0,notOpened:0,penalties:0,penaltyKnown:0,penaltyUnknown:0,contracts:Array.from({length:16},(_,i)=>contract(i+1)),events:[],comebacks:0,leadHeld:0,decisive:null,withClose:{games:0,wins:0},withoutClose:{games:0,wins:0},penaltyScenarios:[],opponents:new Map(),timeline:[]});
const day=g=>String(g.startedAt||g.endedAt||g.id||'Partita');
const date=g=>Date.parse(g.endedAt||g.startedAt||'');
function analyze(source){
 const games=(Array.isArray(source)?source:[]).filter(g=>g&&!g.testGame&&Array.isArray(g.players)&&g.players.length>1&&Array.isArray(g.rounds)&&g.rounds.length).slice().sort((a,b)=>(date(a)||0)-(date(b)||0));
 const map=new Map(),get=name=>{if(!map.has(name))map.set(name,person(name));return map.get(name);};
 for(const g of games){
  const count=g.players.length,totals=Array(count).fill(0),complete=Array(count).fill(true),penaltyComplete=Array(count).fill(true),penalties=Array(count).fill(0),closures=Array(count).fill(0),positions=[],label=day(g);
  g.players.forEach(name=>get(name).games++);
  for(let ri=0;ri<g.rounds.length;ri++){
   const round=g.rounds[ri],win=winner(round),cn=num(round.contract),contractIndex=Number.isInteger(cn)&&cn>=1&&cn<=16?cn-1:-1;
   const voluntary=round.voluntaryChoice===true&&Number.isInteger(round.chooser)&&round.chooser>=0&&round.chooser<count;
   g.players.forEach((name,i)=>{
    const p=get(name),r=round.results?.[i]||{},score=num(r.total),inf=num(r.infractions),c=contractIndex>=0?p.contracts[contractIndex]:null;
    p.hands++;
    if(score===null)complete[i]=false;else{totals[i]+=score;p.points.push(score);}
    if(win!==null){p.closeKnown++;if(c)c.closuresKnown++;if(win===i){p.closed++;closures[i]++;if(c)c.closures++;}else if(score!==null){p.lostPoints.push(score);if(c)c.lostPoints.push(score);}}
    if(c){c.hands++;if(score!==null)c.points.push(score);c.entries.push(label+' · mano '+(ri+1)+' · '+(score===null?'punteggio sconosciuto':score+' punti')+(win===null?' · chiusura sconosciuta':win===i?' · chiusa':' · non chiusa'));}
    if(typeof r.didNotOpen==='boolean'){p.openingKnown++;if(r.didNotOpen)p.notOpened++;if(c){c.openingKnown++;if(r.didNotOpen)c.notOpened++;}}
    if(inf===null){penaltyComplete[i]=false;p.penaltyUnknown++;}else{p.penaltyKnown++;p.penalties+=inf;penalties[i]+=inf;}
    if(c&&voluntary&&score!==null)(round.chooser===i?c.chosen:c.notChosen).push({score,won:win===i});
   });
   positions.push(complete.every(Boolean)?rank(totals):null);
  }
  if(!complete.every(Boolean))continue;
  const final=rank(totals),leaders=final.filter(x=>x===1).length;
  g.players.forEach((name,i)=>{
   const p=get(name),pos=positions.map(x=>x?.[i]??null),win=final[i]===1;
   const withClose=closures[i]>0?p.withClose:p.withoutClose;withClose.games++;if(win)withClose.wins++;
   if(pos.every(x=>x!==null)){
    if(pos[0]>1&&pos[pos.length-1]===1)p.comebacks++;
    if(pos.every(x=>x===1))p.leadHeld++;
   }
   p.timeline.push({when:date(g),label,rounds:g.rounds.length,points:totals[i],closed:closures[i],win,position:final[i],openingKnown:g.rounds.filter(r=>typeof r.results?.[i]?.didNotOpen==='boolean').length,notOpened:g.rounds.filter(r=>r.results?.[i]?.didNotOpen===true).length});
   if(penaltyComplete.every(Boolean)){
    const scenario=rank(totals.map((v,j)=>v-50*penalties[j]));
    p.penaltyScenarios.push({label,actual:final[i],without:scenario[i],penalties:penalties[i]});
   }
   g.players.forEach((other,j)=>{
    if(i===j)return;
    const o=p.opponents.get(other)||{name:other,games:0,ahead:0,behind:0,ties:0,items:[]};o.games++;
    if(totals[i]<totals[j])o.ahead++;else if(totals[i]>totals[j])o.behind++;else o.ties++;
    o.items.push(label+': '+totals[i]+' – '+totals[j]+' punti · '+g.rounds.length+' mani');
    p.opponents.set(other,o);
   });
  });
  if(leaders===1){
   const order=totals.map((value,i)=>({value,i})).sort((a,b)=>a.value-b.value);
   if(order.length>=2&&order.filter(x=>x.value===order[1].value).length===1){
    const first=order[0].i,second=order[1].i;
    let best=null;
    g.rounds.forEach((round,i)=>{
     const diff=num(round.results?.[second]?.total)-num(round.results?.[first]?.total);
     if(best===null||Math.abs(diff)>Math.abs(best.diff))best={label,round:i+1,diff,contract:num(round.contract),gap:order[1].value-order[0].value};
    });
    const p=get(g.players[first]);if(best&&(p.decisive===null||Math.abs(best.diff)>Math.abs(p.decisive.diff)))p.decisive=best;
   }
  }
 }
 const players=[...map.values()].map(p=>{
  const c=p.contracts.map(x=>({...x,average:mean(x.points),volatility:x.points.length?Math.sqrt(mean(x.points.map(v=>(v-mean(x.points))**2))):null}));
  const enough=c.filter(x=>x.points.length>=3),ordered=enough.slice().sort((a,b)=>a.average-b.average);
  const chosen=c.flatMap(x=>x.chosen),notChosen=c.flatMap(x=>x.notChosen);
  const ts=p.timeline.filter(x=>Number.isFinite(x.when)),middle=Math.floor(ts.length/2);
  const period=xs=>({games:xs.length,avgPoints:mean(xs.map(x=>x.points/x.rounds)),closures:xs.reduce((n,x)=>n+x.closed,0),hands:xs.reduce((n,x)=>n+x.rounds,0),openingKnown:xs.reduce((n,x)=>n+x.openingKnown,0),notOpened:xs.reduce((n,x)=>n+x.notOpened,0)});
  return {...p,contracts:c,cheapest:ordered[0]||null,costliest:ordered.at(-1)||null,chosen,notChosen,meanLost:mean(p.lostPoints),opponents:[...p.opponents.values()].sort((a,b)=>b.games-a.games),history:{first:period(ts.slice(0,middle)),second:period(ts.slice(middle)),known:ts.length},enough:p.games>=3&&p.hands>=12};
 });
 return {games:games.length,players};
}
root.AmerikanoAnalytics=Object.freeze({analyze,fmt,pct});
})(window);
