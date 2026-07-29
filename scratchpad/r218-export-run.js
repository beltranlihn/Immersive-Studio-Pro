(async function(){
  await buildDemoProject(); // shape/text-only demo scene — no video decode needed, fast to render
  var outPath = 'C:\\Users\\beltr\\AppData\\Local\\Temp\\claude\\r218-export-test.mp4';
  var log = [];
  var job = {
    prog: function(i,total){ log.push('prog '+i+'/'+total); },
    frame: function(i,total){ /* thumbnail callback, no-op */ },
    wrote: function(n){ log.push('wrote '+n); },
    fail: function(e){ log.push('FAIL '+(e&&e.message)); },
    done: function(v){ log.push('done '+JSON.stringify(v)); }
    // deliberately NO .label — this is the exact case R218 guards against
  };
  var opt = {
    codec: 'avc', fps: 12, res: 256, outW: 256, outH: 256,
    range: 'clips', wcDecode: false, noAudio: true,
    outPath: outPath, job: job
  };
  try {
    await runExport(opt);
  } catch(e) {
    log.push('THROW: ' + (e && e.message));
  }
  var stat = null;
  try { stat = await DSP.stat(outPath); } catch(e) { log.push('stat err: '+e.message); }
  return { log: log, stat: stat };
})()
