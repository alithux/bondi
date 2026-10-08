'use strict';
/* Use the exact plain-source BONDI engine GitHub Pages uses. This prevents
   the online server and browser game from silently drifting to different rules. */
const fs=require('node:fs');
const path=require('node:path');
const prefix='window.__bondiSource=(window.__bondiSource||"")+';
let source='';
for(let i=1;i<=10;i++){
  const name=`source-part-${String(i).padStart(2,'0')}.js`;
  const content=fs.readFileSync(path.resolve(__dirname,'..',name),'utf8').trim();
  if(!content.startsWith(prefix)||!content.endsWith(';'))throw Error(`Invalid BONDI source chunk: ${name}`);
  source+=JSON.parse(content.slice(prefix.length,-1));
}
const output={exports:{}};
const sandboxRoot={};
// Source is checked-in, trusted application code, never remotely supplied text.
new Function('module','exports','globalThis',source)(output,output.exports,sandboxRoot);
if(typeof output.exports?.createGame!=='function'||typeof output.exports?.chooseAICard!=='function')
  throw Error('BONDI engine failed to initialize.');
module.exports=output.exports;
