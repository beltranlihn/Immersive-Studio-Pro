import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):res(r.result.result.value));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
await ev(`(function(){ const c=state.clips[0]; if(c&&!c.loop){ state.selId=c.id; state.selIds=[c.id]; toggleLoop(c); setLoopRange(c,0.4); c.dur=2; renderTimeline(); } return 1; })()`);
const r=await ev(`(function(){ const c=state.clips[0]; if(!c)return 'sin clip';
  const o=[]; for(let k=0;k<60;k++) o.push(srcT(c,k/30));
  return { loop:c.loop, loopLen:c.loopLen, inP:c.inP, dur:c.dur, srcT:o }; })()`);
if(typeof r==='string'){ console.log(r); process.exit(0); }
console.log('clip: bucle='+r.loop+' loopLen='+r.loopLen+' inP='+r.inP+' dur='+r.dur);
const s=r.srcT;
console.log('srcT de los fotogramas 20..40: '+[30,42].map(k=>k+': '+s[k]+' -> us '+Math.floor(s[k]*1e6)).join('   |   '));
let ig=0, dif=[];
for(let i=0;i+12<60;i++){ if(Math.floor(s[i]*1e6)===Math.floor(s[i+12]*1e6))ig++; else if(dif.length<8)dif.push(i+' -> us '+Math.floor(s[i]*1e6)+'  ('+s[i]+')   vs  '+(i+12)+' -> us '+Math.floor(s[i+12]*1e6)+'  ('+s[i+12]+')'); }
console.log('\nparejas k / k+12 con el MISMO instante de fuente: '+ig+' de 48');
if(dif.length) console.log('   no coinciden: \n     '+dif.join('\n     '));
ws.close();
