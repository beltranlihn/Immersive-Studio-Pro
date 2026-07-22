import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  const out={};
  // [M1] instant folder + inline rename
  const nf0=state.folders.length; newFolderIn(null);
  out.M1_folderCreated = state.folders.length===nf0+1;
  // the inline edit fires on setTimeout(0); check the folder exists and selFolder set
  out.M1_selFolderSet = state.selFolder===state.folders[state.folders.length-1];

  // [M3] proxy/original label — inject a fake video media
  const vid={id:uid(),kind:'video',name:'ClipX',w:1920,h:1080,dur:4,fps:30,color:'#88aacc',proxyReady:false,missing:false,folder:null};
  const vid2={id:uid(),kind:'video',name:'ClipY',w:1920,h:1080,dur:4,fps:30,color:'#cc88aa',proxyReady:true,missing:false,folder:null};
  state.media.push(vid,vid2); state.mediaView='list'; renderMedia();
  const it1=document.querySelector('#mediaList .mitem[data-id="'+vid.id+'"] .mprx');
  const it2=document.querySelector('#mediaList .mitem[data-id="'+vid2.id+'"] .mprx');
  out.M3_originalLabel = it1?it1.textContent.trim():null;
  out.M3_proxyLabel = it2?it2.textContent.trim():null;

  // [M2] click-outside deselect
  state.selMediaId=vid.id; state.selMediaIds=[vid.id]; paintMediaSel();
  const ml=document.querySelector('#mediaList');
  ml.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));
  out.M2_deselectedOnEmptyClick = selectedMediaIds().length===0;

  // [M4] missing media red + offline clip
  const miss={id:uid(),kind:'video',name:'Gone',w:100,h:100,dur:3,fps:30,color:'#777',missing:true,_loading:false,folder:null};
  state.media.push(miss); renderMedia();
  const missEl=document.querySelector('#mediaList .mitem[data-id="'+miss.id+'"]');
  out.M4_missingRed = missEl? /E06A6A|224, ?106, ?106/i.test(missEl.style.boxShadow||getComputedStyle(missEl).boxShadow):null;
  // a clip whose media is missing → .offline
  const vl=state.lanes.findIndex(l=>l.kind==='video');
  addClip(miss, vl<0?null:vl, 0.5);
  renderTimeline();
  const offClip=[...document.querySelectorAll('#tracks .clip')].some(cd=>cd.classList.contains('offline'));
  out.M4_offlineClip = offClip;

  // [M6] Ctrl+R with a media selected → renames media (inline edit starts on its name)
  state.selMediaId=vid.id; state.selMediaIds=[vid.id]; paintMediaSel();
  let renamedTarget='none'; const _rmi=renameMediaInline; renameMediaInline=(m)=>{ renamedTarget=m&&m.id===vid.id?'media':'other'; };
  try{ renameSelection(); }catch(e){ renamedTarget='throw:'+e.message; }
  renameMediaInline=_rmi;
  out.M6_ctrlR_targetsMedia = renamedTarget;

  return JSON.stringify(out,null,1);
})()`;
console.log(await evalInApp(expr, { timeout: 20000 }));
