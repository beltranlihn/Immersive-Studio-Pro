/* [R263b] El REVERSO del fallo de R262: parametros que el motor de composiciones LEE (`g.algo`) y que el cuadro
   no escribe nunca -> quedan siempre en su valor por defecto y el usuario no puede tocarlos.
   Y de paso: desde donde mas se puede editar una composicion (inspector), para ver si hay una tercera lista. */
import fs from 'fs';
const src=fs.readFileSync('app.js','utf8');
const trozo=(nombre)=>{ const i=src.indexOf('function '+nombre+'('); if(i<0)return '';
  const j=src.indexOf('\nfunction ', i+1); return src.slice(i, j>0?j:src.length); };
const motor=['compLayout','compLayoutFlat','compElProps','compTunnelAnim','compWeaveAnim','weaveLayout','regenComposeNest','regenComp','createComposition','ensureCompOrder','compMediaIndex','ensureRand']
  .map(trozo).join('\n');
const leidos=new Set([...motor.matchAll(/\bg\.([A-Za-z_][A-Za-z0-9_]*)/g)].map(m=>m[1]));

const i0=src.indexOf('const readForm=()=>{'), i1=src.indexOf('let reshuf=false', i0);
const rf=src.slice(i0,i1);
const escritos=new Set([...rf.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map(m=>m[1]));
/* lo que anade el manejador de Aplicar ademas de readForm */
const i2=src.indexOf('const opts=readForm()'), i3=src.indexOf('if(nestMedia)', i2);
for(const m of src.slice(i2,i3).matchAll(/opts\.([A-Za-z0-9_]+)\s*=/g)) escritos.add(m[1]);

/* campos internos o de otra procedencia: no son mandos y no deben salir en el informe */
const internos=new Set(['kind','id','mediaId','mediaIds','name','_scope','_orderR','_aspect','_aspects','clips','nestClips','length','spin','scopeInP','scopeSpeed','fade']);
const huerfanos=[...leidos].filter(k=>!escritos.has(k)&&!internos.has(k)&&!k.startsWith('_')).sort();

console.log('parametros que el motor lee de la composicion: '+leidos.size);
console.log('parametros que el cuadro escribe             : '+escritos.size);
console.log('\nHUERFANOS (el motor los usa, el cuadro no los pone):');
if(!huerfanos.length) console.log('   ninguno');
for(const k of huerfanos){
  const ej=(motor.match(new RegExp('[^\\n]*\\bg\\.'+k+'\\b[^\\n]*'))||[''])[0].trim().slice(0,110);
  console.log('   g.'+k.padEnd(14)+'  '+ej);
}
/* ¿hay una TERCERA lista? cualquier otro sitio que construya/actualice un `comp` */
console.log('\notros sitios que escriben en una composicion:');
for(const m of src.matchAll(/[^\n]*\.comp\s*=\s*[^\n]*/g)){
  const l=m[0].trim(); if(l.length>150)continue; console.log('   '+l.slice(0,140));
}
