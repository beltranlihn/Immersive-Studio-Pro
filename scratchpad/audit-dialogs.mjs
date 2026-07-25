import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  const out={};
  const measure=(fn,name)=>{ try{ ['splashOv','landingOv','loadingOv'].forEach(i=>{const e=document.getElementById(i);if(e)e.remove();});
    document.querySelectorAll('.overlay').forEach(o=>o.remove());
    fn(()=>{}); // open the dialog (callback no-op)
    const ov=[...document.querySelectorAll('.overlay')].pop(); const card=ov&&ov.firstElementChild;
    const r=card&&card.getBoundingClientRect(); out[name]=r?{w:Math.round(r.width),h:Math.round(r.height)}:null;
    if(ov)ov.remove();
  }catch(e){ out[name]='ERR '+e.message; } };
  measure(cb=>domeSetupDialog(cb),'dome');
  measure(cb=>flatResDialog(cb),'flat2d');
  measure(cb=>roomSetupDialog(cb),'room360');
  return JSON.stringify(out,null,1);
})()`;
console.log(await evalInApp(expr,{timeout:15000}));
