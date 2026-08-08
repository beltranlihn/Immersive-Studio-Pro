/* [R331] Export: el empaquetado NV12, el timecode horneado y los fundidos de la mezcla — del inventario.
     1 · `oW=W>>2` redondeaba HACIA ABAJO. Con un ancho que no fuera multiplo de 4 -y los muros de una sala se
         miden en pixeles a mano, asi que es de lo mas normal- cada fila del empaquetado perdia sus ultimas 1-3
         columnas Y quedaba mas corta que la fila NV12 que espera el codificador: la imagen salia SESGADA en
         diagonal, no solo recortada. Se mide con un borde vertical: si las filas se desplazan, el borde se
         mueve de fila en fila. 1b es el control: con ancho alineado no se copia nada (camino de siempre).
     2 · Al cambiar de tamano se borraban FBO y textura, pero si el FBO nuevo no llegaba a completarse se
         devolvia null DEJANDO `_nv12` con los recursos ya borrados: la siguiente llamada con el tamano anterior
         entraba por el atajo y devolvia un FBO destruido (fotogramas negros, sin un solo error visible).
     3 · El timecode horneado contaba desde el principio del EXPORT, no desde el origen de la secuencia: con
         marcas de entrada y salida puestas empezaba en 00:00:00 aunque el tramo arrancara en el minuto tres.
     4 · Con los dos fundidos largos sobre un clip corto, los eventos de ganancia del export quedaban
         DESORDENADOS y la entrada se cortaba de golpe (chasquido). La previsualizacion ya lo clampaba: el
         export era el gemelo olvidado.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r331-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,80)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

/* Textura de prueba: mitad izquierda negra, mitad derecha blanca. El patron varia SOLO por columnas, asi que
   el volteo vertical del desempaquetado no lo altera y cualquier desplazamiento de filas se ve de inmediato. */
const TEX=`
  const hazTex=(W,H)=>{ const px=new Uint8Array(W*H*4);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const o=(y*W+x)*4, v=(x>=(W>>1))?255:0; px[o]=v;px[o+1]=v;px[o+2]=v;px[o+3]=255; }
    const tx=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tx);
    const fy=gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,px);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,fy);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    return tx; };
  /* primera columna clara de cada fila del plano Y (las H primeras filas del bufer) */
  const bordes=(buf,W,H)=>{ const out=[]; for(let y=0;y<H;y++){ let b=-1; for(let x=0;x<W;x++) if(buf[y*W+x]>128){ b=x; break; } out.push(b); } return out; };`;

console.log('');
console.log('R331 - NV12, timecode horneado y fundidos de la mezcla');
console.log('');

console.log('1) ancho NO multiplo de 4: las filas no se desplazan');
const r1 = await ev(`(()=>{ try{ ${TEX}
  const W=1918,H=8;
  const buf=nv12Read(hazTex(W,H),W,H,false,null);
  if(!buf) return JSON.stringify({err:'nv12Read devolvio null'});
  const N=nv12Prep(W,H);
  const bs=bordes(buf,W,H);
  const iguales=bs.every(b=>b>=0&&Math.abs(b-bs[0])<=1);
  return JSON.stringify({empaquetadoRedondeaArriba:(N.oW*4)>=W, compacta:!!N.relleno,
    bufer:buf.length, esperado:W*(H+(H>>1)), bordes:bs, filasAlineadas:iguales});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r1);

console.log('1b) ancho alineado: mismo resultado y SIN copia intermedia (control)');
const r1b = await ev(`(()=>{ try{ ${TEX}
  const W=1920,H=8;
  const buf=nv12Read(hazTex(W,H),W,H,false,null);
  if(!buf) return JSON.stringify({err:'nv12Read devolvio null'});
  const N=nv12Prep(W,H); const bs=bordes(buf,W,H);
  return JSON.stringify({compacta:!!N.relleno, sinBuferDeRelleno:!N.pad,
    bordes:bs, filasAlineadas:bs.every(b=>b>=0&&Math.abs(b-bs[0])<=1)});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r1b);

console.log('2) si el FBO nuevo falla, no queda un descriptor con recursos borrados');
const r2 = await ev(`(()=>{ try{
  const bueno=nv12Prep(256,256); if(!bueno) return JSON.stringify({err:'no se pudo preparar 256x256'});
  const enorme=gl.getParameter(gl.MAX_TEXTURE_SIZE)*8;
  const roto=nv12Prep(enorme,enorme);            // no cabe: tiene que devolver null Y no dejar basura
  const trasFallo=(typeof _nv12!=='undefined')?_nv12:'no visible';
  const otra=nv12Prep(256,256);                  // el MISMO tamano de antes: aqui es donde volvia el descriptor muerto
  return JSON.stringify({elFalloDevuelveNull:roto===null, sinDescriptorMuerto:trasFallo===null,
    rehaceElBueno:!!otra, fboVivo:!!(otra&&gl.isFramebuffer(otra.fbo)), texVivo:!!(otra&&gl.isTexture(otra.tex)),
    conservaElPrograma:!!(otra&&otra.prog)});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r2);

console.log('3) el timecode horneado cuenta desde el origen de la SECUENCIA');
const r3 = await ev(`(()=>{ try{
  const orig=chapaTC; const vistos=[];
  chapaTC=function(i,fps){ vistos.push({i,fps}); return orig(i,fps); };
  try{ chapaContador(1024,1024,0,30,63.5); chapaContador(1024,1024,7,30,63.5); } finally { chapaTC=orig; }
  return JSON.stringify({vistos, tcDelPrimero:orig(vistos[0].i,30),
    usaElTiempo: vistos.length===2 && vistos[0].i===1905 && vistos[1].i===1905,
    noUsaElIndice: vistos.length===2 && vistos[0].i!==0});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r3);

console.log('4) dos fundidos largos sobre un clip corto: eventos en orden');
const r4 = await ev(`(()=>{ try{
  const hazer=()=>{ const ev=[]; return {ev, gain:{ setValueAtTime:(v,t)=>ev.push({q:'fija',v:+v.toFixed(4),t:+t.toFixed(4)}),
    exponentialRampToValueAtTime:(v,t)=>ev.push({q:'rampa',v:+v.toFixed(4),t:+t.toFixed(4)}) }}; };
  const corto=hazer(); programarFundidos(corto,10,2,3,3,1);      // fi+fo = 6 sobre 2 s de clip
  const normal=hazer(); programarFundidos(normal,10,10,1,1,1);   // caso de siempre
  const ord=l=>l.every((e,k)=>k===0||e.t>=l[k-1].t);
  return JSON.stringify({corto:corto.ev, ordenadoCorto:ord(corto.ev), ordenadoNormal:ord(normal.ev),
    normalIntacto: normal.ev.length===4 && normal.ev[1].t===11 && normal.ev[2].t===19 && normal.ev[3].t===20});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r4);

const malas=[];
const J=s=>{ try{ return JSON.parse(s); }catch(e){ return {err:String(s).slice(0,90)}; } };
const o1=J(r1),o1b=J(r1b),o2=J(r2),o3=J(r3),o4=J(r4);
for(const [n,o] of [['1',o1],['1b',o1b],['2',o2],['3',o3],['4',o4]]) if(o.err) malas.push('sonda '+n+' rota: '+o.err);
if(!o1.err){ if(!o1.empaquetadoRedondeaArriba) malas.push('el empaquetado NV12 sigue redondeando hacia abajo: se pierden columnas');
  if(o1.bufer!==o1.esperado) malas.push('el bufer NV12 no mide W*(H+H/2): '+o1.bufer+' en vez de '+o1.esperado);
  if(!o1.filasAlineadas) malas.push('las filas NV12 se desplazan con ancho no alineado: la imagen sale sesgada ('+o1.bordes+')'); }
if(!o1b.err){ if(o1b.compacta||!o1b.sinBuferDeRelleno) malas.push('con ancho alineado se esta copiando de mas');
  if(!o1b.filasAlineadas) malas.push('con ancho alineado las filas ya no cuadran: regresion'); }
if(!o2.err){ if(!o2.elFalloDevuelveNull) malas.push('nv12Prep no avisa del fallo');
  if(!o2.sinDescriptorMuerto) malas.push('tras el fallo queda un descriptor con recursos borrados');
  if(!o2.fboVivo||!o2.texVivo) malas.push('la siguiente llamada devuelve un FBO o una textura ya borrados');
  if(!o2.conservaElPrograma) malas.push('se ha perdido el programa: recompilar por cada fallo'); }
if(!o3.err&&(!o3.usaElTiempo||!o3.noUsaElIndice)) malas.push('el timecode horneado sigue contando desde el principio del export');
if(!o4.err){ if(!o4.ordenadoCorto) malas.push('con dos fundidos largos los eventos de ganancia salen desordenados');
  if(!o4.ordenadoNormal||!o4.normalIntacto) malas.push('el caso normal de fundidos ha cambiado: regresion'); }
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length ? ('*** '+malas.length+' FALLOS') : 'NV12 sin sesgo, timecode de secuencia y fundidos en orden');
ws.close(); process.exit(malas.length?1:0);
