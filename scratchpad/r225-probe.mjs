import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  window.__errs = window.__errs || [];
  if(!window.__errHook){ window.__errHook=1; window.addEventListener('error',e=>window.__errs.push(String(e.message))); window.addEventListener('unhandledrejection',e=>window.__errs.push('rej:'+String(e.reason))); }
  try{ if(typeof closeLanding==='function')closeLanding(); }catch(_){}
  document.querySelectorAll('.lch, #tourOv, .tourcard').forEach(el=>el.remove());
  const out={};
  out.seqMode=state.seqMode; out.isFlat=isFlat();
  // dump toolbar proxy buttons
  out.proxyBtns=[...document.querySelectorAll('button')].filter(b=>/proxy|comp/i.test(b.textContent||'')||/proxy|comp/i.test(b.id||'')).map(b=>({id:b.id,cls:b.className,txt:(b.textContent||'').trim().slice(0,40),title:b.title}));
  // text clip
  try{
    createTextClip({text:'HOLA'});
    const c=selClip();
    out.textClip={id:c&&c.id};
    const fx=document.getElementById('fxRows');
    out.textFxRows=[...fx.querySelectorAll('.prow')].map(r=>({lab:(r.querySelector('.lab')||{}).textContent,ids:[...r.querySelectorAll('[id]')].map(e=>e.id+':'+e.tagName+(e.type?'['+e.type+']':'')),txt:(r.textContent||'').replace(/\\s+/g,' ').trim().slice(0,120)}));
    out.textSecs=['#secTf','#secFx','#secSource','#secPlayback','#secColor','#secMotion'].map(s=>{const e=document.querySelector(s);return s+'='+(e?getComputedStyle(e).display:'-')});
    out.sourceRows=[...document.querySelectorAll('#sourceRows .prow')].map(r=>({txt:(r.textContent||'').replace(/\\s+/g,' ').trim().slice(0,90),ids:[...r.querySelectorAll('[id]')].map(e=>e.id)}));
    out.playbackRows=[...document.querySelectorAll('#playbackRows .prow')].map(r=>({txt:(r.textContent||'').replace(/\\s+/g,' ').trim().slice(0,90),ids:[...r.querySelectorAll('[id]')].map(e=>e.id)}));
  }catch(e){ out.textErr=String(e); }
  // Motion / FX instructional paragraphs
  out.motionRowsText=[...document.querySelectorAll('#motionRows *')].filter(e=>e.children.length===0&&(e.textContent||'').trim().length>50).map(e=>({tag:e.tagName,cls:e.className,txt:e.textContent.trim().slice(0,140)}));
  return {out, errs:window.__errs};
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
