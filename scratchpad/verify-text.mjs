import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  createTextClip({text:'HELLO'}); const c=state.clips[state.clips.length-1]; state.selId=c.id; state.selIds=[c.id]; renderInspector();
  const ctrls={ font:!!document.getElementById('txtFont'), weight:!!document.getElementById('txtWeight'), italic:!!document.getElementById('txtItalic'), alignBtns:document.querySelectorAll('#txtAlign button').length, size:!!document.getElementById('txtSize'), lineH:!!document.getElementById('txtLineH'), color:!!document.getElementById('txtColor'), outline:!!document.getElementById('txtStroke'), loadFont:!!document.getElementById('txtLoadFont') };
  const mm=mediaById(c.mediaId);
  // change font, weight, line height via the UI
  const fsel=document.getElementById('txtFont'); fsel.value='Georgia'; fsel.onchange();
  const wsel=document.getElementById('txtWeight'); wsel.value='400'; wsel.onchange();
  // alignment: left, then right — the rendered pixels differ
  document.querySelector('#txtAlign button[data-a=left]').click();
  const mediaBox=mm.w+'x'+mm.h;
  // italic toggle
  document.getElementById('txtItalic').click();
  let err=null; try{ renderTextMedia(mm); }catch(e){err=e.message;}
  return JSON.stringify({ controls:ctrls, applied:{ font:mm.tfont, weight:mm.tweight, align:mm.talign, italic:!!mm.titalic, rendered:mm.w>0, renderErr:err }, fontListLen:(function(){const s=document.getElementById('txtFont');return s?s.options.length:0;})() }, null, 1);
})()`;
console.log(await evalInApp(expr, { timeout: 15000 }));
