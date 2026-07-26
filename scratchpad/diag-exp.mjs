import { evalInApp } from './cdp.mjs';
console.log(await evalInApp(`(()=>{
  return JSON.stringify({
    exporting:(typeof exporting!=='undefined')?exporting:'?',
    _exbusy:(typeof _exbusy!=='undefined')?_exbusy:'?',
    colaPendiente:(typeof _exq!=='undefined')?_exq.length:'?',
    cancelExport:(typeof cancelExport!=='undefined')?cancelExport:'?',
    _exPaused:(typeof _exPaused!=='undefined')?_exPaused:'?',
    jobs:(typeof _exJobs!=='undefined')?_exJobs.map(j=>({n:j.name,s:j.status,p:+(j.p||0).toFixed(2)})):'?',
    hayExWaitPause:(typeof exWaitPause==='function'),
    ultimoOpt:(typeof _exJobs!=='undefined'&&_exJobs.length&&_exJobs[_exJobs.length-1].opt)?
      (()=>{const o=_exJobs[_exJobs.length-1].opt;return {codec:o.codec,res:o.res,outW:o.outW,outH:o.outH,fps:o.fps,range:o.range,tieneJob:!!o.job,tieneFrame:!!(o.job&&o.job.frame),tieneWrote:!!(o.job&&o.job.wrote)};})():null
  },null,1);
})()`, { port: 9222 }));
