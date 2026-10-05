window.BondiEngineReady=(async()=>{
  const b64=window.__bondiB64||""; delete window.__bondiB64;
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const code=await new Response(stream).text();
  (0,eval)(code);
  if(!window.BondiEngine) throw new Error("BONDI engine failed to load");
  return window.BondiEngine;
})();