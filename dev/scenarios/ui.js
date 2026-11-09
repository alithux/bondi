'use strict';
(async()=>{
 const $=id=>document.getElementById(id);
 const text=(tag,value,parent)=>{const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;};
 let fixtures,reports=[];
 function display(){
  $('results').replaceChildren();
  for(const report of reports){
   const article=document.createElement('article');$('results').append(article);
   text('h2',(report.passed?'PASS · ':'FAIL · ')+report.name,article).className=report.passed?'pass':'fail';
   if(!report.passed){text('pre',report.error,article);continue;}
   for(const step of report.trace){
    const detail=document.createElement('details');article.append(detail);
    text('summary',step.action,detail);
    text('p',step.nextPlayerMeaning+': Player '+step.nextPlayer+' · Aiy: '+(step.aiy.join(' ')||'empty'),detail);
    text('p',`Held ${step.held} + Aiy ${step.aiy.length} + cleared ${step.cleared} = ${step.total} unique cards`,detail).className='counts';
    const players=document.createElement('div');players.className='players';detail.append(players);
    for(const p of step.players){const box=document.createElement('div');box.className='player';players.append(box);text('strong',p.name+' · '+p.status,box);text('span','Aiybai ('+p.aiybai.length+'): '+(p.aiybai.join(' ')||'empty'),box);}
    if(step.pendingRequest)text('p','Pending request: Player '+(step.pendingRequest.fromSeat+1)+' → Player '+(step.pendingRequest.toSeat+1),detail);
    text('pre',step.log.join('\n'),detail);
   }
  }
 }
 function execute(selected){
  reports=selected.map(f=>{try{return BondiScenarios.run(BondiEngine,BondiMultiplayerCore,f);}catch(e){return {id:f.id,name:f.name,passed:false,error:e.message};}});
  display();$('status').textContent=reports.filter(r=>r.passed).length+' / '+reports.length+' scenarios passed';$('download').disabled=false;
 }
 try{
  await BondiEngineReady;
  const response=await fetch('/fixtures.json');if(!response.ok)throw Error('Cannot load fixtures');fixtures=await response.json();
  fixtures.forEach(f=>{const option=document.createElement('option');option.value=f.id;option.textContent=f.name;$('scenario').append(option);});
  $('run').disabled=false;$('all').disabled=false;$('status').textContent='Ready · 4 fixed scenarios';
  $('run').onclick=()=>execute(fixtures.filter(f=>f.id===$('scenario').value));
  $('all').onclick=()=>execute(fixtures);
  $('download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(reports,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='bondi-scenario-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 }catch(e){$('status').textContent='Could not initialize: '+e.message;}
})();
