'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=fs.existsSync(path.resolve(__dirname,'../dist/index.html'))?path.resolve(__dirname,'../dist'):path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.pdf':'application/pdf'};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).slice(1),file=path.resolve(root,name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
const mk=(id,players,n,date)=>({id,players,startedAt:date,endedAt:date,mode:'full',firstChooser:0,contracts:Array.from({length:n},(_,i)=>i===n-1?16:i+1),rounds:Array.from({length:n},(_,i)=>({contract:i===n-1?16:i+1,chooser:i%players.length,winner:i%players.length,results:players.map((_,j)=>({total:j===i%players.length?0:(j+1)*10,winner:j===i%players.length,infractions:0}))}))});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;
 const b=await chromium.launch({headless:true});let failed=[];
 try{
 const context=await b.newContext({locale:'it-IT',viewport:{width:393,height:852},isMobile:true,hasTouch:true,serviceWorkers:'block'});const page=await context.newPage();page.on('pageerror',e=>{failed.push(e.message);console.error('APP_ERROR',e.stack)});
 const local=[mk('a',['Stefano','Flavio'],5,'2026-10-01'),mk('b',['Flavio','Stefano'],16,'2026-10-02')];
 const remote=mk('c',['Stefano','Sinem','Andrea'],10,'2026-10-03');
 await page.addInitScript(records=>{localStorage.setItem('amerikano-cloud-in-locale','1');localStorage.setItem('amerikano-supabase-v1',JSON.stringify({url:location.origin,anonKey:'fixture-only-key'}));localStorage.setItem('amerikano-completed-games-v1',JSON.stringify(records));},local);
 let resolveCloud;const gate=new Promise(r=>resolveCloud=r);
 await page.route('**/rest/v1/rpc/**',async route=>{if(route.request().url().endsWith('/list_amerikano_completed_games')){await gate;await route.fulfill({contentType:'application/json',body:JSON.stringify([{code:'QA0001',completed_at:remote.endedAt,state:{...remote,createdAt:remote.startedAt}}])});}else await route.fulfill({contentType:'application/json',body:'[]'});});
 await page.goto(url);
 assert.equal(await page.locator('#home-new-game').locator('..').locator('#home-statistics').count(),0);
 assert.equal(await page.locator('[data-home-game]').count(),2,'la home include due partite precedenti');
 await page.locator('[data-home-game="0"]').click();assert.ok(await page.locator('#history-back').isVisible());
 await page.locator('.modal-x').click();assert.ok(await page.locator('#home-all-games').isVisible());
 await page.locator('#home-statistics').click();assert.equal(await page.locator('#stats-options').evaluate(el=>el.open),false,'sharing and filters start collapsed');assert.ok(await page.locator('[data-stat-tab="awards"]').isVisible(),'awards remain visible');fs.mkdirSync('qa-statistiche',{recursive:true});await page.screenshot({path:'qa-statistiche/apertura-statistiche.png',fullPage:true});await page.locator('[data-stat-tab="players"]').click();
 assert.equal(await page.locator('.player-card').count(),2);
 assert.equal(await page.locator('.player-stat-section').count(),8,'quattro gruppi per giocatore');
 assert.equal(await page.locator('.player-stat-section[open]').count(),0,'sezioni chiuse all avvio');
 await page.locator('.player-card').first().locator('.player-stat-section').first().locator('summary').click();
 assert.equal(await page.locator('.player-card').first().locator('.player-stat-section').first().evaluate(el=>el.open),true);
 assert.equal(await page.locator('.player-stats').first().evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2,'players use 2-column mobile tiles');assert.ok(await page.getByRole('status').filter({hasText:'Aggiorno'}).isVisible());
 resolveCloud();await page.waitForFunction(()=>document.querySelectorAll('.player-card').length===4);
 await page.locator('#stats-options summary').click();assert.equal(await page.locator('#stats-options').evaluate(el=>el.open),true,'accordion can expand');assert.ok(await page.locator('#stats-share').isVisible(),'sharing button visible after expanding');
 const group=JSON.stringify(['Flavio','Stefano']);await page.locator('#stats-group').selectOption(group);assert.equal(await page.locator('.player-card').count(),2);
 await page.locator('#stats-duration').selectOption('5');assert.match(await page.locator('.player-card-head').first().innerText(),/1 partita/);
 assert.equal(await page.locator('.stat-order').count(),0);
 await page.locator('#standings-help').click();assert.ok(await page.locator('.stat-order').isVisible());await page.locator('.modal-x').click();
 const keys=await page.locator('.player-card').first().locator('[data-player-stat]').evaluateAll(nodes=>nodes.map(n=>n.dataset.playerStat));
 for(const key of keys){const tile=page.locator('.player-card').first().locator(`[data-player-stat="${key}"]`);const group=tile.locator('xpath=ancestor::details[1]');if(await group.count()&&!(await group.evaluate(el=>el.open)))await group.locator('summary').click();await tile.click();assert.ok(await page.locator('.award-meaning').isVisible());assert.ok(await page.locator('.award-how').isVisible());await page.locator('.modal-x').click();assert.ok(await page.locator('[data-stat-pane="players"]').isVisible());}
 const breakdown=page.locator('[data-player-breakdown]').first();const deepGroup=breakdown.locator('xpath=ancestor::details[1]');if(!(await deepGroup.evaluate(el=>el.open)))await deepGroup.locator('summary').click();await breakdown.click();assert.ok(await page.getByRole('heading',{name:'Rendimento per contratto'}).isVisible());assert.equal(await page.locator('.position-table tbody tr').count(),16);await page.locator('.modal-x').click();
 await page.locator('[data-stat-tab="contracts"]').click();await page.locator('[data-contract-detail="1"]').click();assert.ok(await page.locator('.position-table').isVisible());await page.locator('.modal-x').click();assert.ok(await page.locator('[data-stat-pane="contracts"]').isVisible());await page.locator('[data-stat-tab="players"]').click();
 await page.locator('#stats-duration').selectOption('all');await page.locator('#stats-order').selectOption('strength');
 const strength=page.locator('[data-player-stat="strength"]').first();const strengthGroup=strength.locator('xpath=ancestor::details[1]');if(!(await strengthGroup.evaluate(el=>el.open)))await strengthGroup.locator('summary').click();assert.ok(await strength.isVisible());
 fs.mkdirSync('qa-statistiche',{recursive:true});await page.screenshot({path:'qa-statistiche/giocatori-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await context.setOffline(true);await page.locator('.modal-x').click();await page.locator('#home-statistics').click();await page.locator('[data-stat-tab="players"]').click();assert.equal(await page.locator('.player-card').count(),2);
 await context.close();
 const ownerContext=await b.newContext({locale:'it-IT',viewport:{width:393,height:852},isMobile:true,hasTouch:true,serviceWorkers:'block'});const ownerPage=await ownerContext.newPage();ownerPage.on('pageerror',e=>failed.push(e.message));
 await ownerPage.addInitScript(()=>{localStorage.setItem('amerikano-cloud-in-locale','1');localStorage.setItem('amerikano-supabase-v1',JSON.stringify({url:location.origin,anonKey:'fixture-only-key'}));localStorage.setItem('amerikano-share-v1',JSON.stringify({code:'ABCDEF',ownerToken:'fixture-owner-token'}));localStorage.setItem('amerikano-player-ABCDEF',JSON.stringify({code:'ABCDEF',playerIndex:0,playerToken:'fixture-player-token'}));});
 const ownerRoom={state:{players:['A','B','C'],rounds:[],contracts:[1,16],firstChooser:0,entryMode:'multi'},current_round:{contract:1,roundNo:1,starterIndex:0,cutJokers:0},claimed_indices:[0,1],entries:[]};let ownerSubmissions=0;
 await ownerPage.route('**/rest/v1/rpc/**',async route=>{const method=route.request().url().split('/').pop(),body=route.request().postDataJSON();if(method==='get_amerikano_room'){await route.fulfill({contentType:'application/json',body:JSON.stringify([ownerRoom])});return;}if(method==='submit_amerikano_score_as_owner'){ownerSubmissions++;assert.equal(body.p_player_index,2);assert.equal(body.p_points,32);assert.equal(body.p_infractions,1);ownerRoom.entries=[{playerIndex:2,points:32,infractions:1,discardTakes:0,winner:false}];await route.fulfill({contentType:'application/json',body:'true'});return;}if(method==='set_amerikano_round_cut_jokers'){assert.equal(body.p_round_no,1);ownerRoom.current_round.cutJokers=body.p_cut_jokers;await route.fulfill({contentType:'application/json',body:'true'});return;}await route.fulfill({contentType:'application/json',body:'[]'});});
 await ownerPage.goto(url+'?game=ABCDEF&join=1');await ownerPage.locator('[data-owner-points="2"]').waitFor();assert.ok(await ownerPage.locator('[data-owner-points="1"]').isDisabled());await ownerPage.locator('[data-owner-points="2"]').fill('32');await ownerPage.locator('[data-owner-counter="infractions"][data-owner-index="2"][data-delta="1"]').click();assert.equal(await ownerPage.evaluate(()=>document.activeElement.dataset.ownerPoints),'2');await ownerPage.locator('[data-owner-save-row="2"]').click();await ownerPage.waitForFunction(()=>document.querySelector('[data-owner-points="2"]').value==='32');assert.equal(ownerSubmissions,1);
 await ownerPage.locator('[data-override="1"]').click();assert.ok(await ownerPage.locator('[data-owner-points="1"]').isEnabled());await ownerPage.locator('[data-override="1"]').click();assert.ok(await ownerPage.locator('[data-owner-points="1"]').isDisabled());await ownerPage.locator('[data-shared-cut="1"]').click();await ownerPage.waitForFunction(()=>document.querySelector('#shared-cut-value').textContent==='1');await ownerPage.screenshot({path:'qa-statistiche/amministratore-mobile.png',fullPage:true});assert.ok(await ownerPage.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await ownerContext.close();
 // Real service-worker install and offline reload of the complete app shell.
 const offlineContext=await b.newContext({locale:'it-IT',viewport:{width:393,height:852}});const offlinePage=await offlineContext.newPage();await offlinePage.route('**/rest/v1/rpc/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));await offlinePage.goto(url);await offlinePage.evaluate(()=>navigator.serviceWorker.ready);await offlinePage.reload();await offlineContext.setOffline(true);await offlinePage.reload();assert.ok(await offlinePage.locator('#home-new-game').isVisible());await offlineContext.close();
 assert.deepEqual(failed,[]);console.log(`PASS: mobile, ${keys.length} popup, gruppi, durate, Elo, aggiornamento cloud e offline.`);
 }finally{await b.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
