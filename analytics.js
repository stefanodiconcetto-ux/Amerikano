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
  const count=g.players.length,allWinnersKnown=g.rounds.every(round=>winner(round)!==null),totals=Array(count).fill(0),complete=Array(count).fill(true),penaltyComplete=Array(count).fill(true),penalties=Array(count).fill(0),closures=Array(count).fill(0),positions=[],label=day(g);
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
    if(c&&voluntary&&score!==null&&win!==null)(round.chooser===i?c.chosen:c.notChosen).push({score,won:win===i});
   });
   positions.push(complete.every(Boolean)?rank(totals):null);
  }
  if(!complete.every(Boolean))continue;
  const final=rank(totals),leaders=final.filter(x=>x===1).length;
  g.players.forEach((name,i)=>{
   const p=get(name),pos=positions.map(x=>x?.[i]??null),win=final[i]===1;
   if(allWinnersKnown){const withClose=closures[i]>0?p.withClose:p.withoutClose;withClose.games++;if(win)withClose.wins++;}
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
    const o=p.opponents.get(other)||{name:other,games:0,ahead:0,behind:0,ties:0,items:[],contracts:{}};o.games++;
    if(totals[i]<totals[j])o.ahead++;else if(totals[i]>totals[j])o.behind++;else o.ties++;
    g.rounds.forEach(round=>{
     const c=num(round.contract),aScore=num(round.results?.[i]?.total),bScore=num(round.results?.[j]?.total);
     if(!Number.isInteger(c)||c<1||c>16||aScore===null||bScore===null)return;
     const row=o.contracts[c]||={hands:0,ourPoints:0,otherPoints:0,ourClosures:0,otherClosures:0,closeKnown:0};
     row.hands++;row.ourPoints+=aScore;row.otherPoints+=bScore;
     const closer=winner(round);if(closer!==null){row.closeKnown++;if(closer===i)row.ourClosures++;if(closer===j)row.otherClosures++;}
    });
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
  return {...p,contracts:c,cheapest:ordered[0]||null,costliest:ordered.at(-1)||null,chosen,notChosen,meanLost:mean(p.lostPoints),opponents:[...p.opponents.values()].sort((a,b)=>b.games-a.games),history:{first:period(ts.slice(0,middle)),second:period(ts.slice(middle)),known:ts.length},enough:p.games>=3&&p.points.length>=12};
 });
 return {games:games.length,players};
}

const metricNames={
 lost:'Costo mani perse',risk:'Contratti sicuri/rischiosi',choice:'Scelta efficace',
 comeback:'Rimonta e tenuta',decisive:'Mano decisiva',closure:'Dipendenza dalle chiusure',
 penalties:'Impatto penalità',opponents:'Avversari e contratti',trend:'Andamento nel tempo',profile:'Profilo di gioco'
};
function detail(report,name,key){
 const p=report.players.find(x=>x.name===name);if(!p)return null;
 let title=metricNames[key]||'',value='—',how='',lines=[];
 const c=key.startsWith('contract:')?p.contracts[Number(key.split(':')[1])-1]:null;
 if(c){
  title='Contratto '+c.number;value=c.hands+' mani';
  how='Chiusura diversa da apertura. Dati mancanti esclusi, non trasformati in zero.';
  lines=['Chiusure: '+c.closures+'/'+c.closuresKnown,'Aperture mancate: '+c.notOpened+'/'+c.openingKnown,
   'Punti medi: '+fmt(c.average)+' su '+c.points.length+' mani; deviazione '+fmt(c.volatility),
   'Media senza chiudere: '+fmt(mean(c.lostPoints))+' su '+c.lostPoints.length+' mani',
   'Scelta volontaria: '+c.chosen.length+' mani; chiuse '+c.chosen.filter(x=>x.won).length,
   'Non scelta in mani volontarie: '+c.notChosen.length+' mani; chiuse '+c.notChosen.filter(x=>x.won).length,...c.entries.slice(0,50)];
 }else if(key==='lost'){
  value=fmt(p.meanLost)+' punti';how='Media dei punteggi registrati quando è noto che un altro giocatore ha chiuso.';
  lines=[p.lostPoints.length+' mani note',...p.contracts.filter(c=>c.lostPoints.length).map(c=>'C'+c.number+': '+fmt(mean(c.lostPoints))+' su '+c.lostPoints.length)];
 }else if(key==='risk'){
  value=p.cheapest?'C'+p.cheapest.number+' / C'+p.costliest.number:'—';how='Media e deviazione dei punti per contratto. Confronto solo con almeno 3 punteggi noti per contratto; non misura la probabilità di vincere.';
  lines=p.contracts.filter(c=>c.hands).map(c=>'C'+c.number+': media '+fmt(c.average)+', deviazione '+fmt(c.volatility)+' ('+c.points.length+'/'+c.hands+' punteggi, '+c.closures+'/'+c.closuresKnown+' chiusure)');
 }else if(key==='choice'){
  value=(p.chosen.length||p.notChosen.length)?p.chosen.length+' / '+p.notChosen.length+' mani':'—';how='Solo round marcati esplicitamente come scelta volontaria e con scelta e punteggi registrati.';
  lines=['Scelte: '+p.chosen.filter(x=>x.won).length+'/'+p.chosen.length+' chiuse, '+fmt(mean(p.chosen.map(x=>x.score)))+' punti medi','Non scelte: '+p.notChosen.filter(x=>x.won).length+'/'+p.notChosen.length+' chiuse, '+fmt(mean(p.notChosen.map(x=>x.score)))+' punti medi'];
 }else if(key==='comeback'){
  value=p.comebacks+' / '+p.leadHeld;how='Rimonta: non primo dopo la prima mano e primo al termine; tenuta: primo dopo ogni mano; pari punti condividono la prima posizione.';
  lines=['Rimonte '+p.comebacks,'Testa sempre mantenuta '+p.leadHeld,'Partite ricostruibili '+p.timeline.length+'/'+p.games];
 }else if(key==='decisive'){
  value=p.decisive?'Mano '+p.decisive.round+' · '+p.decisive.diff+' punti':'—';how='Massima variazione assoluta del distacco fra primo e secondo finali univoci. Non dimostra che una sola mano abbia causato la vittoria.';
  lines=p.decisive?[p.decisive.label,'Contratto '+p.decisive.contract,'Variazione '+p.decisive.diff,'Distacco finale '+p.decisive.gap]:['Nessuna partita con due posizioni finali univoche'];
 }else if(key==='closure'){
  value=p.withClose.wins+'/'+p.withClose.games+' vs '+p.withoutClose.wins+'/'+p.withoutClose.games;how='Primi posti con almeno una chiusura e senza chiusure, sulle sole partite con punteggi completi. Correlazione, non causalità.';
  lines=['Con chiusure: '+pct(p.withClose.wins,p.withClose.games),'Senza chiusure: '+pct(p.withoutClose.wins,p.withoutClose.games),'Mani chiuse '+p.closed+'/'+p.closeKnown];
 }else if(key==='penalties'){
  value=p.penaltyScenarios.filter(x=>x.actual!==x.without).length+' cambi';how='Si sottraggono 50 punti per penalità a tutti. Solo partite con punteggi e penalità noti per ogni partecipante: scenario aritmetico, non risultato reale.';
  lines=['Copertura '+p.penaltyScenarios.length+'/'+p.games+' partite; '+p.penaltyUnknown+' mani senza dato',...p.penaltyScenarios.map(x=>x.label+': '+x.actual+'° → '+x.without+'° con '+x.penalties+' penalità')];
 }else if(key==='opponents'){
  value=p.opponents.length+' avversari';how='Solo partite realmente disputate insieme e con punteggi noti; durata e contratti sono quelli del filtro corrente.';
  lines=p.opponents.flatMap(o=>[o.name+': '+o.games+' partite; avanti '+o.ahead+', dietro '+o.behind+', pari '+o.ties,...Object.entries(o.contracts).sort((a,b)=>Number(a[0])-Number(b[0])).map(([n,c])=>'C'+n+': '+c.hands+' mani insieme · punti medi '+fmt(c.ourPoints/c.hands)+' vs '+fmt(c.otherPoints/c.hands)+' · chiusure '+c.ourClosures+' vs '+c.otherClosures+' su '+c.closeKnown+' con vincitore noto'),...o.items.slice(0,8)]);
 }else if(key==='trend'){
  value=p.history.known+' partite';how='Due metà cronologiche delle partite con timestamp valido. Campioni piccoli non provano trend.';
  lines=[['Prima metà',p.history.first],['Seconda metà',p.history.second]].map(([name,x])=>name+': '+x.games+' partite; '+fmt(x.avgPoints)+' punti/mano, '+x.closures+'/'+x.hands+' chiusure, '+x.notOpened+'/'+x.openingKnown+' aperture mancate note');
 }else if(key==='profile'){
  value=p.enough?'Dati sufficienti':'Pochi dati';how='Descrizione senza giudizi personali: almeno 3 partite e 12 mani per un profilo.';
  lines=p.enough?[p.games+' partite, '+p.hands+' mani','Chiusure '+p.closed+'/'+p.closeKnown,'Punti lasciati '+fmt(p.meanLost),'Aperture mancate '+p.notOpened+'/'+p.openingKnown,'Penalità '+p.penalties+' su '+p.penaltyKnown+' mani']:['Disponibili '+p.games+' partite, '+p.hands+' mani; minimo 3 e 12'];
 }else return null;
 return {title,value,how,lines};
}
function render(report,escape){
 const esc=typeof escape==='function'?escape:v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 if(!report.players.length)return '<p class="subtle">Nessuna partita conclusa nel filtro corrente.</p>';
 const button=(name,key,title,sub)=>'<button type="button" data-analytics-name="'+esc(name)+'" data-analytics-key="'+esc(key)+'"><strong>'+esc(title)+'</strong><span>'+esc(detail(report,name,key)?.value||'—')+'</span><small>'+esc(sub)+'</small></button>';
 return '<div class="advanced-analytics"><p class="subtle">Dati di '+report.games+' partite concluse nel filtro corrente. “—” significa dato insufficiente. Ogni valore apre calcolo e campione.</p>'+
 report.players.map((p,i)=>'<details class="advanced-player" '+(!i?'open':'')+'><summary>'+esc(p.name)+' · '+p.games+' partite · '+p.hands+' mani</summary><div class="advanced-grid">'+
 Object.entries(metricNames).map(([key,title])=>button(p.name,key,title,'Dettagli e dati osservati')).join('')+
 '</div><details class="advanced-contracts"><summary>Contratti · '+p.contracts.filter(c=>c.hands).length+' osservati</summary><div class="advanced-grid">'+
 p.contracts.filter(c=>c.hands).map(c=>button(p.name,'contract:'+c.number,'Contratto '+c.number,c.closures+'/'+c.closuresKnown+' chiusure · '+c.openingKnown+' aperture rilevate')).join('')+
 '</div></details></details>').join('')+'</div>';
}

root.AmerikanoAnalytics=Object.freeze({analyze,fmt,pct,detail,render,metricNames});
})(window);
