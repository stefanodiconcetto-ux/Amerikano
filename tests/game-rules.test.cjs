const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync(__dirname+'/../app.js','utf8');
function extract(name){
 const key='function '+name+'(',at=app.indexOf(key);
 assert.ok(at>=0,'Missing '+name);
 const start=app.slice(at-6,at)==='async '?at-6:at;
 const rest=app.slice(start),end=rest.search(/\n(?:async )?function [A-Za-z_$]/);
 return end<0?rest:rest.slice(0,end);
}
function context(){
 const ctx={
  state:{players:['Anna','Bruno','Carla'],rounds:[{contract:1}],contracts:Array.from({length:16},(_,i)=>i+1),firstChooser:0},
  contracts:Array.from({length:16},(_,i)=>[i+1,'Mano '+(i+1),'Descrizione']),
  collabSession:{code:'ABC',playerToken:'PLAYER',playerIndex:0},
  shareAccess:{code:'ABC',ownerToken:'OWNER'},sharedCode:'ABC',
  collabRoom:{current_round:{contract:16}},
  collabDraft:{points:'17',infractions:0,discardTakes:0,winner:false,didNotOpen:false},
  t:s=>s,lt:it=>it,esc:s=>String(s),toast:()=>{},
  refreshSharedGame:async()=>{},document:{querySelector:()=>({value:'17'})},
  totalRounds:()=>16,activeContracts:()=>Array.from({length:16},(_,i)=>i+1),
  fixedContractSequence:()=>false,chooserIndex:()=>1,cutterIndex:()=>2,
  ShareService:{chooseContract:async()=>true,submitScore:async()=>true},
 };
 vm.createContext(ctx);
 for(const name of ['noOpenForContract','canChooseSharedContract','collabContractView','chooseSharedContract','saveRound','submitSharedScore'])vm.runInContext(extract(name),ctx);
 return ctx;
}
test('Bitiş: perdente automaticamente non aperto, vincitore no',()=>{
 const c=context();
 assert.equal(c.noOpenForContract(16,false,false),true);
 assert.equal(c.noOpenForContract(16,false,undefined),true);
 assert.equal(c.noOpenForContract(16,true,true),false);
 assert.equal(c.noOpenForContract(16,null,undefined),undefined);
 assert.equal(c.noOpenForContract(2,true,undefined),undefined);
 assert.equal(c.noOpenForContract(2,false,undefined),undefined);
 assert.equal(c.noOpenForContract(2,false,true),true);
 assert.equal(c.noOpenForContract(2,false,false),false);
});
test('Mani mancanti visibili fuori turno, disabilitate per gli altri',()=>{
 const c=context(),html=c.collabContractView();
 assert.match(html,/Da giocare/);assert.match(html,/Giocata/);
 assert.match(html,/data-collab-contract="2" disabled/);
 assert.match(html,/data-collab-contract="16" disabled/);
 assert.equal(c.canChooseSharedContract(),false);
 c.collabSession.playerIndex=1;
 assert.equal(c.canChooseSharedContract(),true);
 assert.doesNotMatch(c.collabContractView(),/data-collab-contract="2" disabled/);
});
test('Anche il proprietario deve essere il giocatore di turno e usare il token di gioco',async()=>{
 const c=context();let calls=0;
 c.ShareService.chooseContract=async()=>{calls++;return true;};
 c.ShareService.chooseContractAsOwner=()=>{throw Error('Owner bypass forbidden');};
 await c.chooseSharedContract(2);assert.equal(calls,0);
 c.collabSession.playerIndex=1;await c.chooseSharedContract(2);assert.equal(calls,1);
});
test('Salvataggio locale della mano 16 normalizza i flag e lascia i punti invariati',()=>{
 const c=context();
 c.state.rounds=[];c.draft={contract:16,winner:0,scores:{1:'20',2:'30'},infractions:{},discardTakes:{},didNotOpen:{}};
 c.persist=()=>{};c.resetDraft=()=>{};c.render=()=>{};c.alignGameTop=()=>{};c.evFreeChoice=()=>false;
 c.saveRound();
 assert.deepEqual(c.state.rounds[0].results.map(r=>r.didNotOpen),[false,true,true]);
 assert.deepEqual(c.state.rounds[0].results.map(r=>r.total),[0,20,30]);
});
test('Invio condiviso Bitiş porta al cloud il flag automatico',async()=>{
 const c=context();let passed=null;
 c.ShareService.submitScore=async(...args)=>{passed=args;return true;};
 await c.submitSharedScore();assert.equal(passed[5],true);
 c.collabRoom.current_round.contract=2;c.collabDraft.didNotOpen=false;
 await c.submitSharedScore();assert.equal(passed[5],false);
});
test('Statistiche: Bitiş storico inferito, aperture sconosciute delle altre mani non alterate',()=>{
 const src=fs.readFileSync(__dirname+'/../analytics.js','utf8'),ctx={window:{}};
 vm.runInNewContext(src,ctx);const a=ctx.window.AmerikanoAnalytics;
 const games=[{id:'g',players:['Anna','Bruno'],startedAt:'2026-11-15T11:00:00Z',rounds:[
  {contract:2,winner:0,results:[{total:0},{total:10}]},
  {contract:16,winner:1,results:[{total:25,didNotOpen:false},{total:0,didNotOpen:true}]}
 ]}];
 const people=a.analyze(games).players,anna=people.find(p=>p.name==='Anna'),bruno=people.find(p=>p.name==='Bruno');
 assert.equal(anna.openingKnown,1);assert.equal(anna.notOpened,1);
 assert.equal(bruno.openingKnown,1);assert.equal(bruno.notOpened,0);
});

test('PWA: asset aggiornati e cache offline della nuova versione',()=>{
 const html=fs.readFileSync(__dirname+'/../index.html','utf8');
 const sw=fs.readFileSync(__dirname+'/../sw.js','utf8');
 for(const file of ['styles.css','analytics.js','app.js'])assert.ok(html.includes('./'+file+'?v=20261116-mani-bitish-v1'),file);
 assert.match(sw,/offline-network-first-v7/);
});
test('Bitiş sul pannello amministratore: un punto senza selezionare vincitore marca non aperto',async()=>{
 const c=context(),args=[];
 c.ownerCanEdit=()=>true;
 c.ownerBoardDrafts={1:{points:'1',infractions:0,discardTakes:0,winner:false,didNotOpen:false}};
 c.ownerBoardRound='ABC:16';
 c.collabRoom.current_round.roundNo=16;
 c.ShareService.submitScoreAsOwner=async(...p)=>{args.push(p);return true;};
 vm.runInContext(extract('saveOwnerBoardRow'),c);
 assert.equal(await c.saveOwnerBoardRow(1),true);
 assert.equal(args[0][2],1);
 assert.equal(args[0][6],true);
});
