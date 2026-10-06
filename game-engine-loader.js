window.BondiEngineReady=(async()=>{
  const b64=window.__bondiB64||""; delete window.__bondiB64;
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  let code;
  try {
    if (typeof DecompressionStream !== "undefined") {
      const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      code=await new Response(stream).text();
    }
  } catch(e) { code=null; }
  if (!code) {
    if (!window.pako) throw new Error("BONDI engine decompressor unavailable");
    code=new TextDecoder().decode(window.pako.ungzip(bytes));
  }
  (0,eval)(code);
  if(!window.BondiEngine) throw new Error("BONDI engine failed to load");
  return window.BondiEngine;
})().catch(err=>{
  const status=document.getElementById("status");
  if(status) status.textContent="BONDI failed to start. Please refresh once.";
  console.error(err);
  throw err;
});