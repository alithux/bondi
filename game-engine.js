(function(root){
  'use strict';
  try {
    const source=root.__bondiSource||'';
    delete root.__bondiSource;
    if(!source) throw new Error('BONDI engine source is missing');
    (0,eval)(source);
    if(!root.BondiEngine) throw new Error('BONDI engine failed to initialize');
    root.BondiEngineReady=Promise.resolve(root.BondiEngine);
  } catch (err) {
    root.BondiEngineReady=Promise.reject(err);
    const status=typeof document!=='undefined'&&document.getElementById('status');
    if(status) status.textContent='BONDI failed to start. Please refresh once.';
    console.error(err);
  }
})(typeof window!=="undefined"?window:globalThis);
