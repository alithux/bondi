'use strict';
// Optional browser check: npm install --no-save playwright, then npx playwright install chromium webkit.
const assert=require('node:assert/strict');
const playwright=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd()]}));
const {spawn}=require('node:child_process');
const E=require('../../online-server/load-engine.js'),C=require('../../multiplayer-core.js');
const expected=require('./fixtures.json').map(f=>require('./runner.js').run(E,C,f));
async function main(){
 const disabled=spawn(process.execPath,[require.resolve('./server.js')],{env:{...process.env,BONDI_SCENARIOS:'0'},stdio:'ignore'});
 assert.equal(await new Promise(resolve=>disabled.on('exit',resolve)),1,'Runner must be opt-in');
 const server=spawn(process.execPath,[require.resolve('./server.js')],{env:{...process.env,BONDI_SCENARIOS:'1',BONDI_SCENARIO_PORT:'4178'}});
 try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Server exit '+code)));});
  for(const [name,viewport] of [['chromium',{width:1280,height:900}],[process.env.BONDI_MOBILE_BROWSER||'webkit',{width:390,height:844}]]){
   const browser=await playwright[name].launch({headless:true,...(name==='chromium'&&process.env.BONDI_CHROMIUM_PATH?{executablePath:process.env.BONDI_CHROMIUM_PATH}:{})});
   try{
    const page=await browser.newPage({viewport}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4178');
    await page.getByRole('button',{name:'Run all four'}).click();
    await page.waitForFunction(()=>document.getElementById('status').textContent==='4 / 4 scenarios passed');
    await page.locator('summary').first().click();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
    const results=await page.evaluate(async()=>{const fixtures=await(await fetch('/fixtures.json')).json();return fixtures.map(f=>BondiScenarios.run(BondiEngine,BondiMultiplayerCore,f));});
    assert.deepEqual(results,expected,'Browser and server-loader results must match exactly');
    await page.getByRole('button',{name:'Run all four'}).click();
    assert.equal(await page.locator('article').count(),4,'Reruns replace stale results');
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download report'}).click();
    const download=await downloadPromise;
    const fs=require('node:fs');assert.deepEqual(JSON.parse(fs.readFileSync(await download.path(),'utf8')),expected);
    await page.getByRole('button',{name:'Run selected'}).click();assert.equal(await page.locator('article').count(),1);
    assert.deepEqual(errors,[]);
    const forbidden=await page.request.get('http://127.0.0.1:4178/online-config.js');assert.equal(forbidden.status(),404);
    console.log('PASS '+name+' '+viewport.width+'×'+viewport.height+': engine parity, repeat runs, download, layout, route allowlist');
   }finally{await browser.close();}
  }
 }finally{server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
