'use strict';
const assert=require('node:assert/strict');
const E=require('../../online-server/load-engine.js');
const C=require('../../multiplayer-core.js');
const {run}=require('./runner.js');
const fixtures=require('./fixtures.json');
for(const f of fixtures){
 const before=JSON.stringify(f),result=run(E,C,f);
 assert.deepEqual(run(E,C,f),result,'Results must repeat exactly');
 assert.equal(JSON.stringify(f),before,'Fixture must remain unchanged');
 console.log('PASS '+f.name);
}
const broken=structuredClone(fixtures[0]);broken.hands[1][0]=broken.hands[0][0];
assert.throws(()=>run(E,C,broken),/Card conservation/,'Duplicate cards must fail');
const incorrect=structuredClone(fixtures[0]);incorrect.actions.at(-1).expect.currentPlayer=0;
assert.throws(()=>run(E,C,incorrect),/Unexpected next player/,'Incorrect rule expectation must fail');
console.log('PASS repeatability, duplicate detection and failure reporting');
// Verify the browser's source-part loading path matches the server loader exactly.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={console};sandbox.window=sandbox;
vm.createContext(sandbox);
for(const file of [...Array.from({length:10},(_,i)=>'source-part-'+String(i+1).padStart(2,'0')+'.js'),'game-engine.js','multiplayer-core.js','dev/scenarios/runner.js'])
 vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../..',file),'utf8'),sandbox,{filename:file});
for(const f of fixtures){
 const browser=sandbox.BondiScenarios.run(sandbox.BondiEngine,sandbox.BondiMultiplayerCore,f);
 assert.deepEqual(JSON.parse(JSON.stringify(browser)),run(E,C,f));
}
console.log('PASS browser source-loader and server engine trace parity');
