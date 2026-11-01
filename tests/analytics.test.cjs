const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../analytics.js','utf8');
function api(){const context={window:{}};vm.runInNewContext(src,context);return context.window.AmerikanoAnalytics;}
const round=(contract,winner,values,extra={})=>({contract,winner,results:values.map(x=>typeof x==='number'?{total:x,infractions:0}:x),...extra});
const game=(rounds,extra={})=>({id:'synthetic',players:['A','B'],rounds,startedAt:'2026-10-31T12:00:00Z',...extra});
test('Only completed non-test games are passed; result reads but never mutates its inputs',()=>{
 const a=api(),g=game([round(1,0,[0,50])]),before=JSON.stringify(g);
 const data=a.analyze([g,{...g,testGame:true},{...g,rounds:[]}]);
 assert.equal(data.games,1);assert.equal(data.players.length,2);assert.equal(JSON.stringify(g),before);
 assert.ok(!a.analyze([]).players.length);
});
test('Lost hand cost is not the number of hands not won; it requires a recorded winner and score',()=>{
 const a=api(),g=game([round(1,0,[0,50]),round(2,null,[25,30]),round(3,1,[20,0])]);
 const d=a.analyze([g]);assert.equal(d.players.find(p=>p.name==='B').meanLost,50);
 assert.equal(d.players.find(p=>p.name==='A').meanLost,20);
 assert.match(a.detail(d,'B','lost').lines[0],/1 mani note/);
});
test('Opening unknown is not false or zero, and only observed flags are counted',()=>{
 const a=api(),g=game([round(1,0,[{total:0,didNotOpen:false},{total:30,didNotOpen:true}]),
 round(2,1,[{total:12},{total:0}])]);
 const p=a.analyze([g]).players.find(x=>x.name==='B');assert.equal(p.openingKnown,1);assert.equal(p.notOpened,1);assert.equal(p.contracts[1].openingKnown,0);
});
test('Voluntary choices are calculated only from explicitly marked hands',()=>{
 const a=api(),g=game([round(1,0,[0,10],{chooser:0,voluntaryChoice:true}),
 round(2,0,[0,20],{chooser:0}),round(3,1,[35,0],{chooser:1,voluntaryChoice:true}),
 round(4,1,[25,0],{chooser:1,voluntaryChoice:false})]);
 const d=a.analyze([g]),p=d.players.find(x=>x.name==='A');
 assert.equal(p.chosen.length,1);assert.equal(p.notChosen.length,1);
 assert.match(a.detail(d,'A','choice').how,/esplicitamente/);
});
test('Penalties count only with complete explicit infractions for all participants',()=>{
 const a=api(),g=game([round(1,0,[{total:0,infractions:0},{total:50,infractions:1}])]);
 const d=a.analyze([g]);const p=d.players.find(x=>x.name==='B');assert.equal(p.penaltyScenarios.length,1);
 assert.equal(p.penaltyScenarios[0].without,1);
 const unknown=game([round(1,0,[{total:0},{total:50,infractions:1}])]);
 assert.equal(a.analyze([unknown]).players[1].penaltyScenarios.length,0);
});
test('Tie ranks are shared and are not declared unique first and second',()=>{
 const a=api(),g=game([round(1,0,[10,10])]),d=a.analyze([g]);
 assert.equal(d.players[0].timeline[0].position,1);
 assert.equal(d.players[1].timeline[0].position,1);
 assert.equal(d.players[0].decisive,null);
});
test('Incomplete scores do not produce misleading standings or penalty scenarios',()=>{
 const a=api(),g=game([round(1,0,[{total:0,infractions:0},{infractions:0}])]);
 const d=a.analyze([g]);assert.equal(d.players[0].timeline.length,0);assert.equal(d.players[0].penaltyScenarios.length,0);
 assert.equal(d.players[1].contracts[0].points.length,0);
});
test('Contract risk requires at least three observed points per contract',()=>{
 const a=api(),g=game([round(1,0,[0,30]),round(2,1,[60,0]),round(1,0,[0,20]),round(1,1,[40,0])]);
 const d=a.analyze([g]),p=d.players.find(x=>x.name==='A');assert.equal(p.cheapest.number,1);assert.equal(p.costliest.number,1);
 assert.equal(p.contracts[0].points.length,3);assert.equal(p.contracts[1].points.length,1);
});
test('Major game analyses distinguish comeback, long-term lead and decisive hand',()=>{
 const a=api(),g=game([round(1,1,[20,0]),round(2,0,[0,80])]),d=a.analyze([g]);
 const p=d.players.find(x=>x.name==='A');assert.equal(p.comebacks,1);assert.equal(p.leadHeld,0);
 assert.equal(p.decisive.round,2);assert.equal(p.decisive.diff,80);
});
test('Opponents use only games with complete scores and never fabricate encounters',()=>{
 const a=api(),g=game([round(1,0,[0,50])]),d=a.analyze([g]);
 assert.equal(d.players[0].opponents[0].games,1);
 assert.equal(d.players[0].opponents[0].ahead,1);
 assert.equal(d.players[0].opponents.length,1);
});
test('Profile discloses insufficient sample and trends show dated sample',()=>{
 const a=api(),d=a.analyze([game([round(1,0,[0,10])])]);
 assert.equal(d.players[0].enough,false);
 assert.match(a.detail(d,'A','profile').value,/Pochi dati/);
 assert.equal(d.players[0].history.known,1);
});
test('Every of ten metrics and every played contract has a clickable detail and escapes user names',()=>{
 const a=api(),g=game([round(16,0,[0,10])],{players:['<img src=x onerror=alert(1)>','B']});
 const d=a.analyze([g]),html=a.render(d),name=g.players[0];
 assert.equal(Object.keys(a.metricNames).length,10);
 for(const key of Object.keys(a.metricNames)){assert.ok(html.includes('data-analytics-key="'+key+'"'));assert.ok(a.detail(d,name,key));}
 assert.ok(html.includes('data-analytics-key="contract:16"'));assert.ok(a.detail(d,name,'contract:16'));
 assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));
 assert.match(html,/data-analytics-name="&lt;img/);
});

test('A recorded voluntary choice with unknown winner is not counted as a loss',()=>{
 const a=api(),g=game([round(1,null,[10,12],{chooser:0,voluntaryChoice:true})]);
 const p=a.analyze([g]).players.find(x=>x.name==='A');
 assert.equal(p.chosen.length,0);
 assert.equal(a.detail(a.analyze([g]),'A','choice').value,'—');
});
test('A game with missing winning-round history does not count as a game without closures',()=>{
 const a=api(),g=game([round(1,null,[20,30]),round(2,0,[0,12])]);
 const p=a.analyze([g]).players.find(x=>x.name==='B');
 assert.equal(p.withClose.games,0);
 assert.equal(p.withoutClose.games,0);
 assert.equal(p.closeKnown,1);
});

test('Opponent contract comparison uses only identical rounds actually played together',()=>{
 const a=api(),first=game([round(1,0,[0,50]),round(2,1,[25,0]),round(1,0,[0,60])]),other=game([round(1,0,[0,30])],{players:['A','C']});
 const d=a.analyze([first,other]),p=d.players.find(x=>x.name==='A'),b=p.opponents.find(x=>x.name==='B'),c=p.opponents.find(x=>x.name==='C');
 assert.equal(b.contracts['1'].hands,2);assert.equal(b.contracts['1'].ourPoints,0);
 assert.equal(b.contracts['1'].otherPoints,110);assert.equal(b.contracts['2'].hands,1);
 assert.equal(c.contracts['1'].hands,1);
 assert.match(a.detail(d,'A','opponents').lines.join(' '),/C1: 2 mani insieme/);
});

test('Profile sample requires twelve observed scores, not just twelve historical rounds',()=>{
 const a=api(),games=Array.from({length:3},(_,i)=>game(Array.from({length:4},()=>round(1,0,[{infractions:0},{total:5,infractions:0}])),{id:'g-'+i,startedAt:'2026-10-'+(20+i)+'T12:00:00Z'}));
 const p=a.analyze(games).players.find(x=>x.name==='A');
 assert.equal(p.games,3);assert.equal(p.hands,12);assert.equal(p.points.length,0);assert.equal(p.enough,false);
});


test('Readable overview shows four answers first and six optional curiosities per player',()=>{
 const a=api(),g=game([round(1,0,[0,50]),round(2,1,[25,0])]);
 const report=a.analyze([g]),html=a.render(report);
 assert.match(html,/Le tue partite, spiegate semplice/);
 assert.match(html,/In breve/);
 assert.match(html,/Altre curiosità/);
 assert.equal((html.match(/class="advanced-insight"/g)||[]).length,8);
 assert.equal((html.match(/class="advanced-insight advanced-insight-small"/g)||[]).length,16); // six curiosities and two observed contracts per player
 for(const name of ['lost','closure','risk','comeback','choice','decisive','penalties','opponents','trend','profile']){
  assert.equal((html.match(new RegExp('data-analytics-key="'+name+'"','g'))||[]).length,2,name);
 }
 assert.match(html,/<details class="advanced-more-section">/);
 assert.match(html,/Tocca un risultato per capire da quali mani arriva/);
});
test('Short explanations include observed sample and never show unknown as zero',()=>{
 const a=api(),r=a.analyze([game([round(1,null,[25,35])])]),html=a.render(r);
 assert.match(html,/Dati insufficienti/);
 assert.ok(!html.includes('class="advanced-value">0 su 0'));
 assert.match(html,/1 partita conclusa/);
 assert.match(html,/1 mano/);
 assert.ok(!html.includes('1 partite concluse'));
 assert.ok(!html.includes('1 mani'));
 const d=a.detail(r,'A','closure');
 assert.equal(d.value,'Dati insufficienti');
});
test('Do not label a single contract the safest without at least two comparable contracts',()=>{
 const a=api(),r=a.analyze([game([round(1,0,[0,50]),round(1,0,[0,60]),round(1,1,[40,0])])]);
 const html=a.render(r);assert.match(html,/Con quali contratti fai meno punti/);
 assert.match(html,/Dati insufficienti/);
 assert.equal(a.detail(r,'A','risk').value,'Dati insufficienti');
 const r2=a.analyze([game([round(1,0,[0,40]),round(2,1,[40,0]),round(1,0,[0,40]),round(2,0,[0,50]),round(1,1,[50,0]),round(2,0,[0,30])])]);
 assert.match(a.render(r2),/Contratto 2/);
 assert.equal(a.detail(r2,'A','risk').value,'Contratto 2');
});
test('Overview only opens the selected player and keeps others collapsed on re-render',()=>{
 const a=api(),r=a.analyze([game([round(1,0,[0,20])])]);
 const html=a.render(r,v=>String(v),'B');
 assert.match(html,/<details class="advanced-player" data-advanced-player="B" open>/);
 assert.ok(!html.includes('data-advanced-player="A" open'));
 assert.equal((html.match(/class="advanced-player"/g)||[]).length,2);
});
test('User-provided player names and controls are HTML escaped, including quotes and angle brackets',()=>{
 const a=api(),name='" onmouseover="alert(1)"><img src=x>',r=a.analyze([game([round(16,0,[0,50])],{players:[name,'B']})]);
 const html=a.render(r);
 assert.ok(!html.includes('<img src=x>'));
 assert.ok(!html.includes('data-analytics-name="'+name+'"'));
 assert.match(html,/&quot; onmouseover=&quot;/);
 assert.match(html,/data-analytics-key="contract:16"/);
 assert.match(html,/Bitiş/);
});
test('Technical calculations are preserved for all ten metrics and all used contracts',()=>{
 const a=api(),r=a.analyze([game([round(1,0,[0,30]),round(16,1,[30,0])])]);
 for(const key of Object.keys(a.metricNames))assert.ok(a.detail(r,'A',key),key);
 assert.ok(a.detail(r,'A','contract:1'));
 assert.ok(a.detail(r,'A','contract:16'));
 const html=a.render(r);
 assert.match(html,/Guarda i contratti/);
 assert.equal((html.match(/data-analytics-key="contract:/g)||[]).length,4);
});
