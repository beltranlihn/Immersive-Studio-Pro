/* [R263] Auditoria ESTATICA del cuadro de composicion: ¿que otro mando sufre lo mismo que el fundido del tunel?
   El fallo de R262 tenia tres capas independientes, y cada una puede darse por separado:
     1. el mando se LEE para la vista previa pero no se GUARDA al aplicar   -> "no lo aplica"
     2. el mando no se RESTAURA al reabrir la composicion                   -> vuelve al valor por defecto
     3. el mando no esta CONECTADO a preview/sync                           -> la vista previa no reacciona
   Se listan todos los controles del cuadro y se comprueban las tres cosas leyendo el codigo. */
import fs from 'fs';
const src=fs.readFileSync('app.js','utf8');
const i0=src.indexOf('function openCompose(');
if(i0<0) throw new Error('openCompose no encontrado');
const i1=src.indexOf('\nfunction ', src.indexOf('$(\'#cGo\').onclick'));
const reg=src.slice(i0, i1>0?i1:src.length);

/* controles reales (input/select), no los <span> de rotulo */
const ctrl=new Map();
for(const m of reg.matchAll(/<(input|select)\b[^>]*?\bid="(c[A-Za-z0-9]+)"[^>]*>/g)){
  const tag=m[1], id=m[2], tipo=(/type="checkbox"/.test(m[0])?'casilla':/type="range"/.test(m[0])?'deslizador':/type="number"/.test(m[0])?'numero':tag==='select'?'lista':'texto');
  const solo=(()=>{ const antes=reg.slice(Math.max(0,m.index-400), m.index); const d=[...antes.matchAll(/data-only="([a-z]+)"/g)].pop(); return d?d[1]:'(todas)'; })();
  ctrl.set(id,{tipo,solo});
}
/* bloques */
const corte=(a,b)=>{ const x=reg.indexOf(a); if(x<0)return ''; const y=reg.indexOf(b,x); return reg.slice(x, y>0?y:reg.length); };
const bReadForm = corte('const readForm=()=>{','let reshuf=false');
const bPre      = corte("if(pre){ $('#cKind')", "const tt=ov.querySelector('.t')");
const bOpts     = corte('const opts=readForm()', 'if(nestMedia)');
const usaReadForm = /const opts=readForm\(\)/.test(reg);
/* conexion: cualquier mencion del id FUERA de la plantilla, readForm y el pre-relleno */
const bResto = reg.replace(bReadForm,'').replace(bPre,'').replace(/<(input|select)\b[^>]*>/g,'');

const filas=[];
for(const [id,info] of ctrl){
  const leido   = bReadForm.includes("'#"+id+"'") || bOpts.includes("'#"+id+"'");
  const restaur = bPre.includes("'#"+id+"'");
  const conect  = bResto.includes("'#"+id+"'");
  filas.push({id, ...info, leido, restaur, conect});
}
const S=(b)=>b?'  si  ':'  NO  ';
console.log('opts sale de readForm(): '+(usaReadForm?'SI (arreglado en R262)':'NO -> todo el cuadro en riesgo'));
console.log('\nmando           tipo         solo en      se guarda  se restaura  reacciona');
console.log('-'.repeat(78));
for(const f of filas.sort((a,b)=>(a.solo+a.id).localeCompare(b.solo+b.id)))
  console.log(f.id.padEnd(15)+f.tipo.padEnd(13)+f.solo.padEnd(13)+S(f.leido)+'    '+S(f.restaur)+'    '+S(f.conect));

const sinGuardar=filas.filter(f=>!f.leido);
const sinRestaurar=filas.filter(f=>!f.restaur);
const sinConectar=filas.filter(f=>!f.conect);
console.log('\nRESUMEN');
console.log('  no se guardan al aplicar : '+(sinGuardar.length?sinGuardar.map(f=>f.id).join(', '):'ninguno'));
console.log('  no se restauran al abrir : '+(sinRestaurar.length?sinRestaurar.map(f=>f.id).join(', '):'ninguno'));
console.log('  no reaccionan en la vista: '+(sinConectar.length?sinConectar.map(f=>f.id).join(', '):'ninguno'));
