/* [R368] SONDA — el bucle de un hijo no se reinicia con el de su padre, y cortar conserva la fase.
   ───────────────────────────────────────────────────────────────────────────────────────────────────────────
   Ejecuta el codigo REAL de app.js (extrae `srcT`, `acotarBucle`, `duracionFuente`, `seqDur` y los corre);
   no reimplementa nada, que es como en este fichero se han quedado atras los gemelos.
   Uso: node scratchpad/r368-bucles.mjs
*/
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = fs.readFileSync(path.join(RAIZ,'app.js'),'utf8');
function extraer(n){
  const m=new RegExp('function\\s+'+n+'\\s*\\(','g').exec(SRC);
  if(!m) throw new Error('no encuentro '+n);
  let i=SRC.indexOf('{',m.index), prof=0, ini=m.index;
  for(;i<SRC.length;i++){ const c=SRC[i];
    if(c==='{')prof++; else if(c==='}'){ prof--; if(!prof){ i++; break; } } }
  if(prof!==0) throw new Error('llaves de '+n);
  return SRC.slice(ini,i);
}
const API=new Function(`
  let _MEDIA=[], _animNido=0;
  function isSeqMedia(m){ return !!(m&&m.kind==='nest'); }
  function mediaById(id){ return _MEDIA.find(m=>m.id===id); }
  function linkPartner(){ return null; }
  ${['seqDur','duracionFuente','acotarBucle','srcT'].map(extraer).join('\n')}
  return { srcT, acotarBucle, duracionFuente, setMedia(a){_MEDIA=a;}, setNido(v){_animNido=v;} };`)();
console.log('· extraidas de app.js: seqDur, duracionFuente, acotarBucle, srcT\n');

const fallos=[]; const exigir=(ok,m)=>{ console.log((ok?'  ✔ ':'  ✘ ')+m); if(!ok)fallos.push(m); };
const casi=(a,b,e=1e-3)=>Math.abs(a-b)<=e;

/* ── 1) CORTAR un clip en bucle conserva la FASE ───────────────────────────────────────────────────────── */
console.log('[1] cortar un clip en bucle — el caso «Creativity Dome Sequence»');
const FUENTE=392.216667;
API.setMedia([{id:900,kind:'video',dur:FUENTE}]);
const entero={id:1,mediaId:900,start:100,dur:300,inP:0,loop:true,loopLen:FUENTE,speed:1};
const CORTE=140;                                   /* se corta 40 s despues de empezar */
const derecha={...entero,id:2,start:entero.start+40,dur:260,inP:(entero.inP||0)+40};
console.log('    ciclo = fuente ENTERA (%.2f s) → margen cero: aqui es donde R366b aplastaba la fase', FUENTE);
exigir(casi(API.srcT(entero,CORTE),40), 'el clip sin cortar, en el instante del corte, va por el segundo 40 de su fuente — da '+API.srcT(entero,CORTE).toFixed(3));
exigir(casi(API.srcT(derecha,CORTE),40), 'la mitad DERECHA arranca en el segundo 40, no en el 0 — da '+API.srcT(derecha,CORTE).toFixed(3));
const cero={...derecha,inP:0};
exigir(casi(API.srcT(cero,CORTE),0), 'CONTROL: con `inP` aplastado a 0 arrancaria en el 0 (el defecto) — da '+API.srcT(cero,CORTE).toFixed(3));
exigir(API.srcT(derecha,CORTE)!==API.srcT(cero,CORTE), 'la medida distingue los dos casos: sabe fallar');
/* y la fase se mantiene una vuelta entera despues, sin pedir material inexistente */
const tarde=CORTE+FUENTE-1;
const st=API.srcT(derecha,tarde);
exigir(st>=0&&st<FUENTE, 'una vuelta despues sigue DENTRO de la fuente ('+st.toFixed(2)+' < '+FUENTE.toFixed(2)+'): se envuelve, no se sale');
exigir(!API.acotarBucle(derecha)&&casi(derecha.inP,40), 'el guardian ya NO le aplasta la fase — inP sigue en '+derecha.inP);

/* ── 2) el hijo de un compose loopeado gira a su propio periodo ───────────────────────────────────────── */
console.log('\n[2] un video de 10 s dentro de un compose que envuelve cada 5,04 s');
const CICLO_PADRE=5.041667, SRC_HIJO=9.97;
API.setMedia([{id:901,kind:'video',dur:SRC_HIJO}]);
const hijo={id:3,mediaId:901,start:0,dur:CICLO_PADRE,inP:0,loop:true,loopLen:SRC_HIJO,speed:1};
const enNido=(vueltaPadre,ltLocal)=>{ API.setNido(vueltaPadre*CICLO_PADRE); const v=API.srcT(hijo,ltLocal); API.setNido(0); return v; };
const v0=enNido(0,2.5), v1=enNido(1,2.5), v2=enNido(2,2.5);
console.log('    mismo instante local (lt=2,5) en tres vueltas del padre: %.2f · %.2f · %.2f', v0,v1,v2);
exigir(casi(v0,2.5), 'vuelta 1 → segundo 2,50 de su fuente');
exigir(casi(v1,2.5+CICLO_PADRE), 'vuelta 2 → segundo '+(2.5+CICLO_PADRE).toFixed(2)+', NO vuelve al 2,50');
exigir(!casi(v0,v1)&&!casi(v1,v2), 'cada vuelta del padre cae en un punto distinto del hijo: ya no reinician a la vez');
exigir(v0<SRC_HIJO&&v1<SRC_HIJO&&v2<SRC_HIJO, 'y ninguno se sale de su fuente de '+SRC_HIJO+' s');
/* CONTROL: sin el reloj del nido (como antes de R368) los tres darian lo mismo */
API.setNido(0);
const sinNido=[API.srcT(hijo,2.5),API.srcT(hijo,2.5),API.srcT(hijo,2.5)];
exigir(casi(sinNido[0],sinNido[1])&&casi(sinNido[1],sinNido[2]), 'CONTROL: sin el reloj del nido las tres vueltas dan el MISMO fotograma — que es el defecto');

/* ── 3) lo que ya estaba montado NO se mueve ──────────────────────────────────────────────────────────── */
console.log('\n[3] cuando la ventana del hijo mide lo mismo que su fuente, nada cambia');
const SRC_IGUAL=5.041667;
API.setMedia([{id:902,kind:'video',dur:SRC_IGUAL}]);
const igual={id:4,mediaId:902,start:0,dur:SRC_IGUAL,inP:0,loop:true,loopLen:SRC_IGUAL,speed:1};
let mismo=true;
for(const lt of [0,1,2.5,4,5.0]){
  API.setNido(3*SRC_IGUAL); const a=API.srcT(igual,lt);
  API.setNido(0);           const b=API.srcT(igual,lt);
  if(!casi(a,b))mismo=false;
}
exigir(mismo, 'el ciclo del hijo y el del padre coinciden → mismo fotograma con y sin reloj de nido: el montaje existente no se toca');

/* ── 4) las guardas de R365 que siguen valiendo ───────────────────────────────────────────────────────── */
console.log('\n[4] guardas que se conservan');
API.setMedia([{id:903,kind:'nest',nestClips:[]}]);
const vacio={id:5,mediaId:903,start:0,dur:20,inP:0,loop:true,loopLen:5,speed:1};
exigir(API.acotarBucle(vacio)===false&&vacio.loopLen===5, 'nido VACIO: el guardian se abstiene, no machaca el ciclo a 0,1 s');
API.setMedia([{id:904,kind:'video',dur:5}]);
const largo={id:6,mediaId:904,start:0,dur:20,inP:0,loop:true,loopLen:12,speed:1};
API.acotarBucle(largo);
exigir(casi(largo.loopLen,5), 'un ciclo MAS LARGO que la fuente entera si se acota — queda en '+largo.loopLen);
const neg={id:7,mediaId:904,start:0,dur:20,inP:-1.4,loop:true,loopLen:5,speed:1};
API.acotarBucle(neg);
exigir(neg.inP===0, 'una entrada NEGATIVA se sube a 0 — es '+neg.inP);

/* ── 5) [R368b] cortar un bucle de REGION PARCIAL no mueve la region ──────────────────────────────────── */
console.log('\n[5] [R368b] bucle sobre un TROZO de una fuente larga (el caso «Ring 3»)');
API.setMedia([{id:905,kind:'video',dur:3878.18}]);
const trozo={id:8,mediaId:905,start:0,dur:60,inP:3795.12,loop:true,loopLen:4.98,speed:1};
const mitad={...trozo,id:9,start:20,dur:40,inP:trozo.inP};   /* lo que razorCore deja ahora */
const modulo={...trozo,id:10,start:20,dur:40,inP:((trozo.inP+20)%trozo.loopLen)};  /* lo que hacia el modulo */
const rango=c=>{ let lo=1e9,hi=-1e9; for(let k=0;k<200;k++){ const v=API.srcT(c,c.start+k*0.05); lo=Math.min(lo,v); hi=Math.max(hi,v); } return [lo,hi]; };
const rOrig=rango(trozo), rMitad=rango(mitad), rMod=rango(modulo);
console.log('    region del original : %s', rOrig.map(x=>x.toFixed(2)));
console.log('    region tras cortar  : %s', rMitad.map(x=>x.toFixed(2)));
console.log('    con el MODULO       : %s', rMod.map(x=>x.toFixed(2)));
exigir(casi(rMitad[0],rOrig[0],0.06)&&casi(rMitad[1],rOrig[1],0.06), 'la mitad cortada repite EL MISMO trozo que el original');
exigir(!casi(rMod[0],rOrig[0],1), 'CONTROL: con el modulo la region se iba a otro sitio del archivo — '+rMod[0].toFixed(2)+' en vez de '+rOrig[0].toFixed(2));

console.log('\n'+(fallos.length?'✘ '+fallos.length+' en rojo':'✔ todo verde'));
process.exit(fallos.length?1:0);
