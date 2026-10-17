'use strict';
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bondi-load-regression-'));
try {
 const output=path.join(dir,'results.json');
 const result=spawnSync(process.execPath,['load-test/run.js','--quick','--budget-ms=0','--output='+output],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:30000});
 assert.ifError(result.error);
 assert.equal(result.status,1,result.stdout+'\n'+result.stderr);
 assert.match(result.stderr,/unfinished matches/);
 const data=JSON.parse(fs.readFileSync(output,'utf8')).scenarios[0];
 assert.equal(data.roomsStarted,2);
 assert.equal(data.matchesCompleted,0);
 assert.equal(data.matchesUnfinished,2);
 assert.equal(data.errorCount,0);
 console.log('PASS unfinished games fail and retain JSON diagnostics');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
