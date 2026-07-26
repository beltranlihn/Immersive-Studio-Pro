import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<220;i++){const l=await targets(9223).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(300);}
if(!idx){console.log('el .exe no expuso la ventana');process.exit(1);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const errs=[]; await send('Runtime.enable',{});
ws.addEventListener('message',ev=>{const x=JSON.parse(ev.data);
  if(x.method==='Runtime.consoleAPICalled'&&x.params.type==='error')errs.push((x.params.args||[]).map(a=>a.value||a.description||'').join(' ').slice(0,180));
  if(x.method==='Runtime.exceptionThrown')errs.push('excepción: '+((x.params.exceptionDetails.exception&&x.params.exceptionDetails.exception.description)||'').slice(0,180));});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,250)};return r.result.value};
for(let i=0;i<90;i++){ if(await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')===true)break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(900);
console.log(JSON.stringify(await evl(`(()=>{ const R={};
  R['R166 · interruptores .iosw'] = typeof ioswBind==='function' && typeof ioswHtml==='function';
  R['R166 · demo sin texto en audio'] = (()=>{ const ai=state.lanes.findIndex(l=>l.kind==='audio');
    return !state.clips.some(c=>{const m=mediaById(c.mediaId); return c.lane===ai && m && m.kind==='text';}); })();
  R['R166b · diálogo con sala actual'] = /partirDe/.test(''+roomSetupDialog);
  R['R167 · Spout In'] = !!(window.dsp&&window.dsp.spout&&window.dsp.spout.inList) ? (window.dsp.spout.inList()||[]).length+' emisores' : 'sin api';
  R['R168 · Canvas en 2D'] = (()=>{ state.seqMode='flat'; try{updModeUI();}catch(e){}
    const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); const t=(b&&b.textContent||'').trim();
    const h=document.querySelector('#dispSeg button[data-d="hfade"]'); const th=(h&&h.textContent||'').trim();
    state.seqMode='dome'; try{updModeUI();}catch(e){} return t+' / '+th; })();
  R['R169 · esfera equirect'] = typeof drawEquirectSphere==='function' && typeof pareceEquirect==='function';
  R['R169 · signo de la v'] = /0\.5 \+ lat/.test(FSEQ) ? 'corregido' : 'SIGUE MAL';
  R['render'] = (()=>{try{render();return !(gl&&gl.isContextLost&&gl.isContextLost())}catch(e){return 'ROTO: '+e.message}})();
  return R; })()`),null,2));
await wait(600);
console.log('errores de consola en el .exe:', errs.length?errs:'ninguno');
ws.close();
