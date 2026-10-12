'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const js=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
const session=new Map([['bondi:online:session:wss://bondi-online.onrender.com/ws',JSON.stringify({code:'ABC234',token:'c'.repeat(64),clientId:'original-id'})]]);
const store={getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,String(v)),removeItem:k=>session.delete(k)};
class ClassList{
 constructor(){this.values=new Set(['hidden']);}
 contains(s){return this.values.has(s);}
 toggle(s,on){if(on===undefined)on=!this.values.has(s);on?this.values.add(s):this.values.delete(s);}
}
class El{
 constructor(){this.value='';this.textContent='';this.innerHTML='';this.classList=new ClassList();this.events={};this.scrollLeft=0;this.disabled=false;}
 addEventListener(type,fn){this.events[type]=fn;}
 setAttribute(){}
 querySelectorAll(){return [];}
}
const els=new Map(),$=k=>{if(!els.has(k)){const el=new El();if(k==='transportMode')el.value='online';els.set(k,el);}return els.get(k);};
let lastClient=null;
class FakeOnlineClient{
 constructor(options){this.options=options;this.session=JSON.parse(store.getItem('bondi:online:session:'+options.serverUrl));this.resumeCount=0;lastClient=this;}
 resumeRoom(){this.resumeCount++;}
 leave(){}
}
const win={BONDI_ONLINE_SERVER_URL:'https://bondi-online.onrender.com',location:{origin:'https://alithux.github.io',pathname:'/bondi/',search:'',protocol:'https:'},addEventListener(){}};
const ctx={window:win,document:{getElementById:$,title:'BONDI'},
 localStorage:{getItem:()=>null,setItem(){},removeItem(){}},sessionStorage:store,
 navigator:{},Date,console,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,
 BondiMultiplayerCore:{},BondiMultiplayer:{normalizeCode:s=>s,MultiplayerClient:class{}},
 BondiOnline:{serverWebSocketURL:()=> 'wss://bondi-online.onrender.com/ws',OnlineMultiplayerClient:FakeOnlineClient},
 BondiEngineReady:{then:fn=>fn()},BondiEngine:{}};
vm.runInNewContext(js,ctx,{filename:'stage-5-11-index.js'});
assert(lastClient,'refresh initializes online client');
assert.equal(lastClient.resumeCount,1,'page refresh automatically tries to resume original seat');
assert.equal(lastClient.session.clientId,'original-id');
assert.equal($('multiSetup').classList.contains('hidden'),false,'recovery is visible in multiplayer setup');
assert.match($('multiError').textContent,/restoring/i,'player receives an honest recovery status');
assert.match(html,/replaced:'This seat was restored in another tab/);
console.log('PASS Stage 5.11 page refresh auto-resumes previous authenticated multiplayer seat');
