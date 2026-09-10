/* [R369] SONDA — la espera del cierre cuenta desde la ULTIMA SEÑAL DE VIDA, no desde el principio.
   Ejecuta la funcion REAL extraida de main.js; no la reimplementa.
   Reproduce el fallo del 2026-09-10: un master de 96,48 GB agoto el plazo fijo de 5 min a mitad del
   `faststart`, la app mato a FFmpeg y el `moov` no se escribio — cinco horas de render tiradas.
   Uso: node scratchpad/r369-cierre.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const RAIZ=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC=fs.readFileSync(path.join(RAIZ,'main.js'),'utf8');
const m=/async function esperarCierre\s*\(/.exec(SRC);
if(!m) throw new Error('no encuentro esperarCierre en main.js');
let i=SRC.indexOf('{',m.index), prof=0, ini=m.index;
for(;i<SRC.length;i++){ const c=SRC[i]; if(c==='{')prof++; else if(c==='}'){ prof--; if(!prof){i++;break;} } }
const esperarCierre=new Function('return '+SRC.slice(ini,i))();
console.log('· esperarCierre extraida de main.js\n');

const fallos=[]; const exigir=(ok,m)=>{ console.log((ok?'  ✔ ':'  ✘ ')+m); if(!ok)fallos.push(m); };
const SIN_AVANCE=300, LATIDO=50;          /* los mismos plazos, en milisegundos */

/* [1] un cierre LENTO pero que avanza: no se corta aunque tarde mucho mas que el plazo */
{
  let size=0; const t0=Date.now();
  const mirar=async()=>({size:size++, mtimeMs:Date.now()});      /* avanza siempre */
  const fin=new Promise(r=>setTimeout(()=>r(0), SIN_AVANCE*6));  /* tarda 6 plazos en cerrar */
  const code=await esperarCierre(fin,mirar,SIN_AVANCE,LATIDO);
  const ms=Date.now()-t0;
  console.log('[1] cierre lento pero con avance (tarda 6 plazos)');
  exigir(code===0, 'devuelve el codigo real del proceso (0), no el corte — dio '+code);
  exigir(ms>SIN_AVANCE*4, 'y espero de verdad ('+ms+' ms, mas de 4 plazos): un plazo FIJO lo habria matado');
}
/* CONTROL: el plazo fijo de R352b sobre el mismo caso */
{
  const fin=new Promise(r=>setTimeout(()=>r(0), SIN_AVANCE*6));
  const viejo=await Promise.race([fin, new Promise(r=>setTimeout(()=>r(null), SIN_AVANCE))]);
  exigir(viejo===null, 'CONTROL: con el plazo FIJO el mismo cierre se corta (null) — es el fallo de anoche');
}
/* [2] un cierre ATASCADO de verdad: se corta */
{
  const t0=Date.now();
  const mirar=async()=>({size:42, mtimeMs:1000});               /* nunca cambia */
  const fin=new Promise(()=>{});                                 /* no termina jamas */
  const code=await esperarCierre(fin,mirar,SIN_AVANCE,LATIDO);
  const ms=Date.now()-t0;
  console.log('\n[2] cierre atascado de verdad (el archivo no se mueve)');
  exigir(code===null, 'se corta y devuelve null');
  exigir(ms>=SIN_AVANCE && ms<SIN_AVANCE*3, 'y se corta a tiempo ('+ms+' ms, plazo '+SIN_AVANCE+')');
}
/* [3] el archivo desaparece o no se puede mirar: no se cuelga */
{
  const mirar=async()=>{ throw new Error('ENOENT'); };
  const fin=new Promise(()=>{});
  const code=await esperarCierre(fin,mirar,SIN_AVANCE,LATIDO);
  console.log('\n[3] `mirar` falla siempre (archivo inaccesible)');
  exigir(code===null, 'se corta igual en vez de esperar para siempre');
}
/* [4] cierre inmediato */
{
  const code=await esperarCierre(Promise.resolve(0), async()=>({size:1,mtimeMs:1}), SIN_AVANCE, LATIDO);
  console.log('\n[4] cierre inmediato');
  exigir(code===0, 'devuelve 0 sin esperar');
}
console.log('\n'+(fallos.length?'✘ '+fallos.length+' en rojo':'✔ todo verde'));
process.exit(fallos.length?1:0);
