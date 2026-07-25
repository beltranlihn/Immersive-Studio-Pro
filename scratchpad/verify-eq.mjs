// [X1] Verify the redesigned Reactive-FX equalizer paints a real spectrum analyzer.
// Injects a synthetic 32-bin spectrum + _arCache so arDrawMeter runs its full path, then dumps the canvas PNG.
import { evalInApp } from './cdp.mjs';
import fs from 'fs';

const expr = `(async()=>{
  // go to the Reactive FX tab so #arMeter exists
  state.inspTab='react'; renderInspector();
  const cv=document.getElementById('arMeter'); if(!cv) return {err:'no #arMeter'};
  // synthetic source clip + media carrying a fake but plausible spectrum (peak-normalised, low tilt)
  const FR=200, B=32, data=new Float32Array(FR*B);
  for(let f=0;f<FR;f++){ const beat=Math.abs(Math.sin(f*0.19)); for(let b=0;b<B;b++){ const tilt=Math.pow(1-b/B,1.4); // more low-end
    const wob=0.5+0.5*Math.sin(f*0.11+b*0.7); data[f*B+b]=Math.min(1, tilt*(0.35+0.65*wob)*(0.5+0.5*beat)); } }
  const fakeMedia={id:999001,name:'probe.wav',kind:'audio',spec:{data,frames:FR,bins:B,fps:90,f0:40,f1:12000}};
  if(!state.media.some(m=>m.id===999001)) state.media.push(fakeMedia);
  const clip={id:999002,mediaId:999001,start:0,dur:10,speed:1,inP:0};
  _arCache={clip,fps:90,bpm:120,beat0:0,onsets:{bass:[0.5,1.0,1.5],mid:[0.75],treble:[0.25,1.25]},beats:[],
            raw:{},bass:new Float32Array(1),mid:new Float32Array(1),treble:new Float32Array(1),bright:new Float32Array(1)};
  state.playhead=1.02;
  // paint several frames so peak-hold caps settle
  for(let i=0;i<8;i++){ state.playhead=1.0+i*0.03; arDrawMeter(); }
  // sample: how many pixels are lit above the dark trough?
  const g=cv.getContext('2d'); const im=g.getImageData(0,0,cv.width,cv.height).data; let lit=0;
  for(let p=0;p<im.length;p+=4){ if(im[p]>60||im[p+1]>60||im[p+2]>60) lit++; }
  return { w:cv.width, h:cv.height, litPct:Math.round(lit/(im.length/4)*100), png:cv.toDataURL('image/png'), hasSpec: !!specColAt(state.playhead) };
})()`;

const r = await evalInApp(expr);
if (r.err) { console.log('ERR', r.err); process.exit(1); }
console.log('canvas', r.w+'x'+r.h, 'litPct', r.litPct, 'hasSpec', r.hasSpec);
fs.writeFileSync('scratchpad/eq-shot.png', Buffer.from(r.png.split(',')[1], 'base64'));
console.log('wrote scratchpad/eq-shot.png');
