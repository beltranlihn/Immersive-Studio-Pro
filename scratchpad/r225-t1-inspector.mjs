// [R225] Verificación 1: adjust (todos los efectos + efecto sobre lo de abajo) · fisheye gate · sin párrafos · audio · text
import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  const R={};
  const txtOf=s=>(s||'').replace(/\\s+/g,' ').trim();
  const MV1=${8}, MV2=${9};
  // ---------- dos clips de vídeo + una capa de ajuste encima ----------
  state.clips=[];
  const P=()=>({az:0,el:35,size:55,rot:0,spin:0,opacity:100,blur:0,feather:0,crop:0,exposure:0,contrast:0,saturation:0,temperature:0,tint:0,glow:0,chroma:0,x:0,y:0,scale:100,volume:100,fulldome:false,fisheye:false,equirect:false,mask:'none',blend:'normal'});
  const cA={id:uid(),mediaId:MV1,lane:1,start:0,dur:6,inP:0,name:'A',props:P(),kf:{},fx:[]};
  const cB={id:uid(),mediaId:MV2,lane:2,start:0,dur:6,inP:0,name:'B',props:P(),kf:{},fx:[]};
  state.clips.push(cA,cB);
  addAdjustmentLayer();                       // crea pista arriba + clip de ajuste seleccionado
  const adj=selClip();
  R.adj={ id:adj&&adj.id, esAjuste:!!(adj&&adj.adjust), lane:adj&&adj.lane, laneKind:adj&&state.lanes[adj.lane]&&state.lanes[adj.lane].kind, dur:adj&&adj.dur };
  renderInspector();
  R.adjSecs=['#secTf','#secSource','#secPlayback','#secColor','#secFx','#secMotion'].map(s=>s+'='+(document.querySelector(s)?getComputedStyle(document.querySelector(s)).display:'-'));
  R.adjTieneCatalogoFx=!!document.querySelector('#motionFx #motionAddFx');
  R.adjSecMotionTitulo=txtOf(document.querySelector('#secMotion .t')&&document.querySelector('#secMotion .t').textContent);
  R.adjFilas=[...document.querySelectorAll('#fxRows .prow')].map(r=>txtOf(r.textContent).slice(0,40));
  R.adjParrafos=[...document.querySelectorAll('#fxRows *, #motionRows *')].filter(e=>e.children.length===0&&txtOf(e.textContent).length>60).map(e=>txtOf(e.textContent).slice(0,80));
  // efecto de COLOR sobre la capa de ajuste → tiene que afectar a los dos clips de debajo como conjunto
  const tipos=Object.keys(FXBY); R.fxColorCandidatos=tipos.filter(t=>/hue|color|satur|invert|tint|mono|posteriz/i.test(t));
  const tipo=R.fxColorCandidatos[0]||'invert';
  adj.fx=[newFx(tipo)]; const f=adj.fx[0]; f.int=100; f.band='none';
  for(const p of (FXBY[tipo].params||[])) adj.props['fx:'+f.id+':'+p.k]=(p.max!=null?p.max:100);
  R.fxUsado=tipo;
  R.adjHasFx=hasFx(adj);
  return {R, errs:window.__errs};
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
