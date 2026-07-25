import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  const out={};
  // 1) shader/program sanity + locations found (non-null → used by the compiled program)
  out.pwValid = (typeof PW!=='undefined') && gl.isProgram(PW);
  out.locs = { lift:LW.lift!=null, gamma:LW.gamma!=null, gain:LW.gain!=null };
  // 2) wheelRGB math: handle straight up (pure red push) at k=0.4 → [0.4,-0.2,-0.2]
  out.wheelUp = wheelRGB([0,1,0],0.4).map(v=>+v.toFixed(4));
  // 3) engine: set uniforms via bindClipGrade, read them back from the GPU
  gl.useProgram(PW);
  bindClipGrade({props:{cgGain:[0,0,0.5]}});           // master gain +0.5 → gain 1.5 all channels
  out.gain = Array.from(gl.getUniform(PW,LW.gain)).map(v=>+v.toFixed(3));
  bindClipGrade({props:{cgLift:[0,1,0]}});             // pure red balance in shadows
  out.lift = Array.from(gl.getUniform(PW,LW.lift)).map(v=>+v.toFixed(3));
  bindClipGrade({props:{cgGamma:[0,0,0.5]}});          // master gamma +0.5 → exp 0.5 (brighter mids)
  out.gamma = Array.from(gl.getUniform(PW,LW.gamma)).map(v=>+v.toFixed(3));
  bindClipGrade({props:{}});                            // neutral → identity: gain 1, lift 0, gamma 1
  out.identity = { gain:Array.from(gl.getUniform(PW,LW.gain)), lift:Array.from(gl.getUniform(PW,LW.lift)), gamma:Array.from(gl.getUniform(PW,LW.gamma)) };
  // 4) any GL error accumulated?
  out.glErr = gl.getError();
  return JSON.stringify(out,null,1);
})()`;
console.log(await evalInApp(expr, { timeout: 15000 }));
