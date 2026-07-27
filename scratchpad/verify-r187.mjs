import { evalInApp } from './cdp.mjs';
const expr = `(()=>{ const src=runExport.toString();
  return JSON.stringify({
    ssDecididoUnaVez: src.indexOf("ssExport = (opt.codec==='png') ? 1 :")>=0 || src.indexOf("ssExport =")>=0,
    nestUsaSsExport: src.indexOf("nestSize=Math.min(qRes*ssExport")>=0,
    sinExportSSSuelto: (src.match(/exportSS\\(qRes\\)/g)||[]).length,
    monitorLimitado: openExport.toString().indexOf("_monT")>=0,
    faseSeRepone: openExport.toString().indexOf("if(S.phase==='run')")>=0,
    panelVivo: typeof exPx==='function'
  }); })()`;
console.log(await evalInApp(expr, { port: 9223 }));
