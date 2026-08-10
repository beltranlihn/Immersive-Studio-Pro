/* [R349] Los diez puntos de la prueba de Beltran, comprobados sobre la app viva. Uno por bloque; cada uno mide la
   CONCLUSION (lo que el usuario ve) y no la premisa, y los que tienen estado anterior reconstruible lo
   reconstruyen para verse ROJOS antes del arreglo.

   Fuera de aqui, por necesitar su propio banco:
     · 1 (proxys que no se generan)  -> scratchpad/r349-cola-proxy.mjs (con su caso rojo)
     · 4 (estetica de Motion)        -> se mira, no se mide: scratchpad/r349-motion.png

   Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r349-revision.mjs
*/
import http from 'http';

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 500)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 240000 } })); });

const J = async (src) => { const r = await ev('(async()=>{ try{ return JSON.stringify(await (async()=>{' + src + '})()); }catch(e){ return "ERR "+String((e&&(e.stack||e.message))||e).slice(0,500); } })()'); try { return JSON.parse(r); } catch (e) { return { _err: String(r).slice(0, 500) }; } };

const malas = [];
let _tBloque = Date.now();
const tic = () => { const d = Date.now() - _tBloque; _tBloque = Date.now(); return ' [' + (d/1000).toFixed(1) + ' s]'; };
const ok = (cond, etiqueta, detalle) => { console.log('      ' + (cond ? 'OK  ' : '*** ') + etiqueta + (detalle ? '  ' + detalle : '')); if (!cond) malas.push(etiqueta + (detalle ? ' — ' + detalle : '')); };

console.log('');
console.log('R349 - los puntos de la prueba de Beltran, sobre la app viva');

/* Banco PROPIO, siempre el mismo. [R349] Antes esto reutilizaba el proyecto que hubiera abierto («si no hay
   clips, monta el demo»), y dentro de `npm run redes` eso significa el proyecto que dejo la red anterior: la
   sonda exportaba, componia y reproducia sobre material ajeno y arbitrario. Medido, ahi tardaba 6 min 40 s —
   pasandose de largo del plazo de 180 s del lanzador— frente a 4 s sobre instancia limpia. Un proyecto minimo y
   propio la hace rapida Y comparable entre pasadas. */
{
  const r = await J(`
    await newProject('dome',1024,1024,30,180,true);
    if(typeof hideLanding==='function')try{hideLanding();}catch(e){}
    _demoAddShape('rect','#C8C8C8',0,0,4,{az:0,el:45,size:40});
    _demoAddShape('rect','#787878',0,5,4,{az:90,el:45,size:40});
    state.playhead=0; renderTimeline(); renderInspector();
    return {clips:state.clips.length, medios:state.media.length};`);
  console.log('');
  console.log('   proyecto de prueba: ' + JSON.stringify(r) + tic());
  if (!r.clips) { console.log('   *** sin clips: no se puede medir'); ws.close(); process.exit(1); }
}

/* ---- 2 · la lista de codecs ya no ofrece los dos que topan bajo ---- */
console.log('');
console.log('   2 · codecs del panel de export'+tic());
{
  const r = await J(`
    if(document.getElementById('exOv'))document.getElementById('exOv').remove();
    openExport();
    for(let i=0;i<60;i++){ const s=document.getElementById('exCodec'); if(s&&s.options.length>1)break; await new Promise(r=>setTimeout(r,120)); }
    const s=document.getElementById('exCodec');
    const vals=s?[...s.options].map(o=>o.value):[];
    const sel=s?s.value:null;
    /* memoria de sesion con el codec retirado: tiene que traducirse, no dejar el desplegable descolgado */
    const trad=[exCodecNorm('mp4'),exCodecNorm('hevc'),exCodecNorm('png')];
    const ovv=document.getElementById('exOv'); if(ovv)ovv.remove();
    return {vals:vals, sel:sel, trad:trad};`);
  if (r._err) ok(false, 'no se pudo abrir el panel', r._err);
  else {
    ok(!r.vals.includes('mp4'), 'H.264 de WebCodecs (max 3072) fuera de la lista', r.vals.join(','));
    ok(!r.vals.includes('hevc'), 'H.265 de WebCodecs (max 1080) fuera de la lista');
    ok(r.vals.includes('ffh264') && r.vals.includes('ffhevc') && r.vals.includes('png') && r.vals.includes('hap') && r.vals.includes('hapq') && r.vals.includes('still'), 'siguen los que funcionan (4096, 8192, HAP, HAP Q, still, PNG)');
    ok(r.vals.includes(r.sel), 'el codec seleccionado esta en la lista', 'sel=' + r.sel);
    ok(r.trad[0] === 'ffh264' && r.trad[1] === 'ffhevc' && r.trad[2] === 'png', 'un preajuste viejo se traduce', r.trad.join(','));
  }
}

/* ---- 3 · secuencia PNG con fondo NEGRO (el caso que moria con «undefined q») ---- */
console.log('');
console.log('   3 · export de secuencia PNG, fondo negro'+tic());
{
  const r = await J(`
    const base='C:/Users/beltr/AppData/Local/Temp/r349-png';
    await DSP.ensureDir(base);
    const nada=()=>{};
    const job={prog:nada,frame:nada,label:nada,warn:nada,wrote:nada,done:nada,fail:nada};
    let err=null;
    try{ await runExport({codec:'png', res:512, outW:512, outH:512, fps:24, range:'clips', rangeT:[0,2/24],
                          pngBg:'black', outDir:base, silent:true, noAudio:true, job:job}); }
    catch(e){ err=String((e&&(e.stack||e.message))||e).slice(0,300); }
    let hijos=null; try{ hijos=await DSP.listDir(base); }catch(e){}
    return {err:err, base:base, hijos:hijos?JSON.stringify(hijos).slice(0,300):'(sin listado)'};`);
  if (r._err) ok(false, 'la sonda del PNG no corrio', r._err);
  else ok(!r.err, 'exporta sin excepcion', r.err || ('carpeta ' + r.base));
}

/* ---- 5 · un menu largo cabe entero en la pantalla ---- */
console.log('');
console.log('   5 · colocacion del menu de «Anadir efecto»'+tic());
{
  const r = await J(`
    /* El menu DE VERDAD, abierto por su boton de verdad: es el unico que tiene la altura real (25 efectos + 4
       separadores) y el ancla real. Un menu inventado en medio de la pantalla no reproduce nada. */
    state.selId=state.clips[0].id; state.selIds=[state.selId]; renderInspector();
    await new Promise(r=>setTimeout(r,60));
    const btn=document.getElementById('motionAddFx')||document.getElementById('arAddFx');
    if(!btn)return {salta:'no encuentro el boton de Anadir efecto'};
    /* El boton puede estar a cualquier altura -el inspector se desplaza-, asi que se BARRE toda la ventana en vez
       de mirar un solo sitio: un caso suelto no dice si el problema esta resuelto o si simplemente se cayo del
       lado bueno. Para cada altura se abre el menu DE VERDAD y se mide; despues, sobre el MISMO nodo (misma
       altura real), se aplica la colocacion anterior al arreglo y se vuelve a medir. */
    /* El ancla se fabrica en vez de mover el boton: openFxMenu solo le pide getBoundingClientRect() a e.target, y
       mover el nodo de verdad no sirve -esta dentro de un contenedor con transform, asi que position:fixed se
       ancla a EL y el barrido se quedaba clavado en una sola altura (medido: 0 casos rojos que si existen)-. */
    const b0=btn.getBoundingClientRect();
    const ancla=(ty)=>({target:{getBoundingClientRect:()=>({left:b0.left,right:b0.right,width:b0.width,top:ty,bottom:ty+b0.height,height:b0.height})}});
    const nItems=FXTYPES.length+4; let fueraHoy=0, fueraAntes=0, n=0, abiertos=0, peorAntes=null, peorHoy=null;
    for(let ty=80; ty<=innerHeight-60; ty+=40){ n++;
      const rb=ancla(ty).target.getBoundingClientRect();
      /* [R349] Sin esto, la sonda mide UNA sola vez. openMenu trae desde R172 un anti-rebote: si el mismo
         pointerdown que cerro el menu lo vuelve a abrir sobre el mismo sitio, se calla. Sin eventos de puntero de
         por medio el sello _ptrSeq no cambia nunca, asi que a partir de la segunda vuelta openMenu cerraba y
         volvia sin crear nada, y el barrido de veinte alturas era en realidad una. */
      _menuPrevRect=null; _menuOwnerRect=null;
      openFxMenu(ancla(ty));
      let m=document.querySelector('.menu'); if(!m)continue; abiertos++;
      let b=m.getBoundingClientRect();
      if(b.top<-0.5||b.bottom>innerHeight+0.5){ fueraHoy++; if(!peorHoy||b.top<peorHoy.top)peorHoy={top:Math.round(b.top),bottom:Math.round(b.bottom),ancla:ty}; }
      /* colocacion ANTERIOR: el ancla que ponia openFxMenu, y el unico ajuste que hacia openMenu (solo el borde de abajo) */
      m.style.maxHeight=''; m.style.overflowY='';
      const yV=Math.max(46, rb.top-8-Math.min(nItems,20)*22);
      m.style.left=rb.left+'px'; m.style.top=yV+'px';
      b=m.getBoundingClientRect(); if(b.bottom>innerHeight)m.style.top=(yV-b.height)+'px';
      b=m.getBoundingClientRect();
      if(b.top<-0.5||b.bottom>innerHeight+0.5){ fueraAntes++; if(!peorAntes||b.top<peorAntes.top)peorAntes={top:Math.round(b.top),bottom:Math.round(b.bottom),ancla:ty}; }
      closeMenu();
    }

    return {n:n, abiertos:abiertos, fueraHoy:fueraHoy, fueraAntes:fueraAntes, peorAntes:peorAntes, peorHoy:peorHoy, alto:innerHeight, nItems:nItems};`);
  if (r._err) ok(false, 'la sonda del menu no corrio', r._err);
  else if (r.salta) console.log('      -- ' + r.salta);
  else {
    ok(r.abiertos === r.n, 'el barrido abrio el menu en las ' + r.n + ' alturas', 'abiertos=' + r.abiertos);
    ok(r.fueraAntes > 0, 'la red sabe fallar: con la colocacion anterior el menu se salia de la pantalla', r.fueraAntes + ' de ' + r.n + ' alturas de boton · la peor ' + JSON.stringify(r.peorAntes));
    ok(r.fueraHoy === 0, 'hoy cabe entero desde CUALQUIER altura del boton', r.n + ' alturas probadas · ' + r.nItems + ' entradas · ventana ' + r.alto + (r.peorHoy ? ' · peor ' + JSON.stringify(r.peorHoy) : ''));
  }
}

/* ---- 6 · play MAS ALLA del tramo de trabajo ---- */
console.log('');
console.log('   6 · reproducir fuera del bucle y mas alla de los clips'+tic());
{
  const r = await J(`
    /* Sin marca de insercion: play() arranca DESDE la seleccion de tiempo si la hay (R279), asi que una que
       hubiera dejado puesta la red anterior teletransportaba el cabezal y la medida no era del transporte. */
    state.tl.selA=null; state.tl.selB=null; state.tl.selLanes=[];
    const prueba=async(ph,out,ms)=>{ pause(); state.workIn=1; state.workOut=out; state.playhead=ph;
      play(); await new Promise(r=>setTimeout(r,ms||700));
      const res={sigue:state.playing, ph:+state.playhead.toFixed(3), avanzo:+(state.playhead-ph).toFixed(3)}; pause(); return res; };
    const fuera=await prueba(9,3);          /* detras del tramo: antes volvia a workOut y pausaba en el acto */
    const dentro=await prueba(1.2,3);       /* dentro: envuelve, no se detiene */
    const antes=await prueba(0.2,1.4,1600); /* delante: corre recto y PARA en workOut, que es el limite querido */
    state.workIn=null; state.workOut=null; state.playhead=0;
    return {fuera:fuera, dentro:dentro, antes:antes};`);
  if (r._err) ok(false, 'la sonda del transporte no corrio', r._err);
  else {
    ok(r.fuera.sigue && r.fuera.avanzo > 0.2, 'arrancando DETRAS del tramo, sigue reproduciendo', JSON.stringify(r.fuera));
    ok(r.dentro.sigue, 'arrancando DENTRO, el bucle envuelve y no para', JSON.stringify(r.dentro));
    ok(!r.antes.sigue && Math.abs(r.antes.ph - 1.4) < 0.05, 'arrancando DELANTE, sigue parando al final del tramo', JSON.stringify(r.antes));
  }
}

/* ---- 8 · la mascara de una composicion ya creada se aplica a TODOS sus clips ---- */
console.log('');
console.log('   8 · cambiar la mascara de una composicion existente'+tic());
{
  const r = await J(`
    let m=state.media.find(x=>x.comp&&Array.isArray(x.nestClips)&&x.nestClips.length);
    if(!m){ const src=state.media.find(x=>x.kind==='video'||x.kind==='image'||x.kind==='shape'||x.kind==='text');
      if(!src)return {salta:'no hay medio con el que componer'};
      m=createComposition({kind:'ring',mediaIds:[src.id],count:6,mask:'none'}); }
    if(!m||!m.nestClips||!m.nestClips.length)return {salta:'no se pudo crear la composicion'};
    m.comp.mask='circle'; regenComposeNest(m);
    const antes=m.nestClips.map(c=>c.props.mask);
    m.comp.mask='diamond'; regenComposeNest(m);      /* sin tocar la cantidad: es el caso que fallaba */
    const despues=m.nestClips.map(c=>c.props.mask);
    /* y un retoque a mano sobrevive si el cuadro NO cambia nada */
    m.nestClips[0].props.mask='vignette'; regenComposeNest(m);
    const traRetoque=m.nestClips.map(c=>c.props.mask);
    return {n:m.nestClips.length, antes:antes, despues:despues, traRetoque:traRetoque};`);
  if (r._err) ok(false, 'la sonda de la composicion no corrio', r._err);
  else if (r.salta) console.log('      -- ' + r.salta);
  else {
    ok(r.despues.every(x => x === 'diamond'), 'la nueva mascara llega a TODOS los elementos', r.despues.join(','));
    ok(r.traRetoque[0] === 'vignette', 'un retoque a mano sobrevive si el cuadro no cambia', r.traRetoque.join(','));
  }
}

/* ---- 9 · umbral de arrastre: un clic no mueve el clip ---- */
console.log('');
console.log('   9 · sensibilidad del arrastre de clips'+tic());
{
  const r = await J(`
    renderTimeline(); await new Promise(r=>requestAnimationFrame(r));
    const cid=(()=>{ const n=document.querySelector('#tracks .clip[data-clip]'); return n?+n.dataset.clip:null; })();
    if(cid==null)return {salta:'sin nodo de clip'};
    const c=clipById(cid);
    /* [R349] El nodo se vuelve a buscar en CADA gesto: renderTimeline() rehace el DOM del timeline entero, asi
       que el de la vuelta anterior esta desconectado y un pointerdown sobre el no llega al contenedor #tracks.
       Con el nodo cacheado el segundo gesto no movia nada y la sonda acusaba al programa de su propio fallo. */
    const gesto=async(dx)=>{ const s0=c.start;
      const nodo=document.querySelector('#tracks .clip[data-clip="'+cid+'"]'); if(!nodo)return null;
      const b=nodo.getBoundingClientRect();
      const x0=Math.round(b.left+b.width/2), y0=Math.round(b.top+b.height/2);
      state._lastClipClick=null;   /* sin herencia del gesto anterior: dos clics seguidos son un doble clic */
      nodo.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:x0,clientY:y0,button:0,pointerId:1}));
      window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x0+dx,clientY:y0,pointerId:1}));
      await new Promise(r=>setTimeout(r,30));
      window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x0+dx,clientY:y0,pointerId:1}));
      await new Promise(r=>setTimeout(r,60));
      const d=+(c.start-s0).toFixed(4); c.start=s0; renderTimeline(); return d; };
    const tembleque=await gesto(3);   /* el temblor de la mano al hacer clic */
    const querido=await gesto(220);   /* un arrastre de verdad, largo para que no se lo coma el iman */
    return {tembleque:tembleque, querido:querido, pps:+state.tl.pxPerSec.toFixed(1)};`);
  if (r._err) ok(false, 'la sonda del arrastre no corrio', r._err);
  else if (r.salta) console.log('      -- ' + r.salta);
  else {
    ok(r.tembleque === 0, 'un desplazamiento de 3 px NO mueve el clip', 'movio ' + r.tembleque + ' s');
    ok(Math.abs(r.querido) > 0.001, 'un arrastre de 220 px SI lo mueve', 'movio ' + r.querido + ' s · ' + r.pps + ' px/s');
  }
}

/* ---- 10 · la rueda sobre las pestanas de secuencia avanza despacio ---- */
console.log('');
console.log('   10 · rueda sobre la tira de secuencias'+tic());
{
  const r = await J(`
    const bar=document.getElementById('seqTabs');
    if(!bar)return {salta:'no encuentro la tira de pestanas'};
    /* se fuerza desbordamiento para que el manejador actue, sin depender de cuantas secuencias haya */
    const ancho0=bar.style.width, ov0=bar.style.overflowX;
    const relleno=document.createElement('span'); relleno.style.cssText='display:block;flex:0 0 1400px;height:1px;'; bar.appendChild(relleno);
    bar.style.overflowX='auto';
    bar.scrollLeft=0;
    bar.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120,deltaMode:0}));
    const unGolpe=bar.scrollLeft;
    relleno.remove(); bar.style.width=ancho0; bar.style.overflowX=ov0; bar.scrollLeft=0;
    return {unGolpe:unGolpe};`);
  if (r._err) ok(false, 'la sonda de la rueda no corrio', r._err);
  else if (r.salta) console.log('      -- ' + r.salta);
  else ok(r.unGolpe > 0 && r.unGolpe <= 60, 'un golpe de rueda avanza menos de media pestana', r.unGolpe + ' px (antes: 120)');
}

console.log('');
if (malas.length) { console.log('   ' + malas.length + ' FALLO(S):'); for (const x of malas) console.log('      *** ' + x); }
else console.log('   todo verde');
ws.close();
process.exitCode = malas.length ? 1 : 0;
