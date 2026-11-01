const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8');
const code=source.slice(source.indexOf('async function readOwnedOngoingGames()'),source.indexOf('async function inProgressGamesModal()'));
async function check(owned,read,expected){const button={isConnected:true};const ctx={loadOwnedGames:()=>owned,ShareService:{read},document:{querySelector:()=>button},lt:it=>it};vm.runInNewContext(code,ctx);await ctx.refreshOwnedGamesLabel();assert.equal(button.textContent,expected);}
(async()=>{
 await check([],()=>{throw Error('must not read')},'Nessuna partita in corso');
 const owned=[{code:'OPEN'},{code:'DONE'},{code:'MISSING'}];
 await check(owned,async code=>code==='MISSING'?null:{state:{rounds:Array(code==='DONE'?16:2),contracts:Array(16)}},'Le mie partite in corso (1)');
 await check([{code:'DONE'}],async()=>({state:{rounds:Array(16),contracts:Array(16)}}),'Nessuna partita in corso');
 await check([{code:'ERROR'}],async()=>{throw Error('offline')},'Partite in corso: verifica incompleta');
 console.log('PASS: empty, active, completed, missing and offline ongoing-game states');
})().catch(e=>{console.error(e);process.exitCode=1;});
