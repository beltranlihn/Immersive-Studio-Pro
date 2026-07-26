import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
if(!idx){console.log('sin editor');process.exit(1);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const errs=[]; await send('Runtime.enable',{});
ws.addEventListener('message',ev=>{const x=JSON.parse(ev.data); if(x.method==='Runtime.consoleAPICalled'&&x.params.type==='error')errs.push((x.params.args||[]).map(a=>a.value||a.description||'').join(' ').slice(0,160));});
await send("Page.reload",{ignoreCache:true}); await new Promise(r=>setTimeout(r,2200));
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,250)};return r.result.value};
for(let i=0;i<80;i++){ if(await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')===true)break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(900);

// bkToggle · sobre un clip visual
console.log('bkToggle  ', JSON.stringify(await evl(`(()=>{ const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind==='shape';});
  state.selIds=[c.id];state.selId=c.id;renderInspector();
  const b=document.getElementById('bkToggle'); if(!b)return {noEsta:true};
  const nativo=b.tagName==='INPUT', antes=!!c.props.blackKey;
  b.click(); const trasClic=!!selClip().props.blackKey;
  const umbralVisible=(()=>{const t=document.getElementById('bkThr');return !!(t&&t.closest('.prow').style.display!=='none');})();
  b.click(); const trasSegundo=!!selClip().props.blackKey;
  return {esInterruptor:!nativo&&b.classList.contains('iosw'), antes, trasClic, filaUmbralAparece:umbralVisible, trasSegundo, vuelveAlOrigen:trasSegundo===antes}; })()`)));

// txtStroke · sobre el clip de texto
console.log('txtStroke ', JSON.stringify(await evl(`(()=>{ const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind==='text';});
  if(!c)return {sinTexto:true}; state.selIds=[c.id];state.selId=c.id;renderInspector();
  const b=document.getElementById('txtStroke'); if(!b)return {noEsta:true};
  const m=mediaById(c.mediaId), antes=!!m.tstroke;
  b.click(); const trasClic=!!mediaById(c.mediaId).tstroke;
  b.click(); const trasSegundo=!!mediaById(c.mediaId).tstroke;
  return {esInterruptor:b.classList.contains('iosw'), antes, trasClic, trasSegundo, vuelveAlOrigen:trasSegundo===antes}; })()`)));

// motionPrev · en la sección Motion
console.log('motionPrev', JSON.stringify(await evl(`(()=>{ const b=document.getElementById('motionPrev'); if(!b)return {noEsta:true};
  const antes=state.motionPreview!==false;
  b.click(); const trasClic=state.motionPreview!==false;
  b.click(); const trasSegundo=state.motionPreview!==false;
  return {esInterruptor:b.classList.contains('iosw'), antes, trasClic, trasSegundo, vuelveAlOrigen:trasSegundo===antes}; })()`)));

// el rótulo de al lado también conmuta (lo hacía el <label> nativo)
console.log('rótulo    ', JSON.stringify(await evl(`(()=>{ const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind==='shape';});
  state.selIds=[c.id];state.selId=c.id;renderInspector();
  const env=document.querySelector('[data-iosw="bkToggle"]'); const txt=env&&env.firstElementChild;
  const antes=!!selClip().props.blackKey; if(txt)txt.click();
  const despues=!!selClip().props.blackKey; if(txt)txt.click();
  return {elTextoConmuta:antes!==despues}; })()`)));
await wait(500);
console.log('errores de consola:', errs.length?errs:'ninguno');
ws.close();
