// Against a local server only; all remote calls are intercepted with synthetic data.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const scenario of ['empty','active','completed','offline']){
   const context=await browser.newContext({locale:'it-IT',viewport:{width:390,height:844},serviceWorkers:'block'});
   const page=await context.newPage();let writes=0;
   await page.route('https://**/*',async route=>{
    const req=route.request(),method=new URL(req.url()).pathname.split('/').pop();
    if(method==='get_amerikano_game'){
     if(scenario==='offline')return route.fulfill({status:503,json:{message:'synthetic offline'}});
     return route.fulfill({json:[{updated_at:new Date().toISOString(),state:{entryMode:'multi',players:['Test A','Test B'],rounds:scenario==='completed'?Array.from({length:16},()=>({})):[],contracts:Array.from({length:16},(_,i)=>i+1)}}]});
    }
    if(!/^(list_|get_|amerikano_private_tests_ready)/.test(method))writes++;
    return route.fulfill({json:[]});
   });
   await page.addInitScript(({scenario})=>{
    localStorage.setItem('amerikano-cloud-in-locale','1');
    if(scenario!=='empty')localStorage.setItem('amerikano-owned-games-v1',JSON.stringify([{code:'ABCDEF',ownerToken:'SYNTHETIC-TEST-OWNER'}]));
   },{scenario});
   await page.goto('http://127.0.0.1:8090');
   const button=page.locator('#home-owned-games');
   const expected=scenario==='active'?'Le mie partite in corso (1)':scenario==='offline'?'Partite in corso: verifica incompleta':'Nessuna partita in corso';
   await page.waitForFunction(expected=>document.querySelector('#home-owned-games')?.textContent===expected,expected);
   await button.click();const modal=page.locator('#owned-games-list');
   if(scenario==='active')await modal.locator('[data-resume-game="ABCDEF"]').waitFor();
   else await page.waitForFunction(s=>{const text=document.querySelector('#owned-games-list')?.textContent||'';return s==='offline'?text.includes('Impossibile verificare'):text.includes('Nessuna partita');},scenario);
   if(scenario==='offline')assert(!/Nessuna partita/.test(await modal.innerText()));
   assert.equal(writes,0,'Display check must not write or delete cloud games');
   console.log('PASS browser:',scenario);await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
