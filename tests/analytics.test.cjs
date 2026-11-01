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
