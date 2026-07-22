import { evalInApp } from './cdp.mjs';

const DIR = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Alma Digital Studio\\\\Projects\\\\Immersive Studio Pro\\\\scratchpad';
const P1 = DIR + '\\\\ptest.mp4';
const P2 = DIR + '\\\\ptest2.mp4';
const BAD = DIR + '\\\\ptest2.dsp-proxy-deadbee.mp4';

const expr = `(async()=>{
  const out=[]; const ok=(n,c,d)=>out.push((c?'ok   ':'FAIL ')+n+(d?'  → '+d:''));
  // ---- C) rename bridge ----
  out.push('DSP.rename presente: '+(typeof DSP.rename));
  // ---- A) atomic generation produces a VALID proxy, no .part left ----
  const m={id:uid(),kind:'video',name:'ptest.mp4',path:${JSON.stringify(P1)},srcUrl:DSP.toFileURL(${JSON.stringify(P1)}),fps:30,dur:6,w:1920,h:1080,proxyReady:false,proxyPct:0,_proxyForce:false};
  const finalPath=proxyLocalPath(m);
  try{ await DSP.deleteFile(finalPath); }catch(_){}
  try{ await makeProxy(m); }catch(e){ out.push('makeProxy THREW: '+e.message); }
  ok('A: proxyReady tras generar', !!m.proxyReady, 'w='+m.pw+' path='+(m.proxyPath||'').slice(-40));
  ok('A: usa proxy reducido (≤960)', m.pw>0 && m.pw<=960, m.pw+'px');
  const partLeft=await DSP.exists(finalPath+'.part');
  ok('A: NO queda .part', partLeft===false, 'exists='+partLeft);
  const finalExists=await DSP.exists(m.proxyPath||finalPath);
  ok('A: el proxy final existe en disco', finalExists===true, m.proxyPath);
  // ---- B) self-heal: a corrupt sibling proxy is deleted, bind fails cleanly ----
  const m2={id:uid(),kind:'video',name:'ptest2.mp4',path:${JSON.stringify(P2)},srcUrl:DSP.toFileURL(${JSON.stringify(P2)}),fps:30,dur:6,w:1920,h:1080,proxyReady:false,proxyPct:0};
  const badBefore=await DSP.exists(${JSON.stringify(BAD)});
  const bound=await attachExistingProxy(m2,true);
  const badAfter=await DSP.exists(${JSON.stringify(BAD)});
  ok('B: no vincula un proxy corrupto', bound===false && !m2.proxyReady, 'bound='+bound);
  ok('B: borra el proxy corrupto (self-heal)', badBefore===true && badAfter===false, 'antes='+badBefore+' despues='+badAfter);
  return out.join('\\n');
})()`;

try { console.log(await evalInApp(expr, { timeout: 120000 })); }
catch (e) { console.error('ERROR:', e.message); process.exit(1); }
