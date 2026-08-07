/* [MANUAL] Convierte manual.html en PDF con el propio Chromium de Electron.
   La PORTADA se imprime aparte, sin margenes y sin pie, y el CUERPO con margenes y numero de pagina; despues se
   pegan. Hacerlo en una sola pasada obligaba a elegir: o la portada a sangre sin numeracion en todo el
   documento, o numeracion con la portada encajonada dentro de un margen. */
const {app, BrowserWindow} = require('electron');
const fs = require('fs'); const path = require('path');

const DIR  = path.resolve(__dirname, '..');
const HTML = 'file://' + path.join(DIR, 'manual.html').replace(/\\/g, '/');
const SALIDA = process.argv[2] || path.join(DIR, 'salida');
fs.mkdirSync(SALIDA, {recursive:true});

const PIE = `<div style="width:100%;font-family:'Segoe UI',sans-serif;font-size:7.5pt;color:#8A9096;
  padding:0 17mm;display:flex;justify-content:space-between;align-items:center;">
  <span style="letter-spacing:.06em;">IMMERSIVE STUDIO PRO &nbsp;·&nbsp; USER MANUAL</span>
  <span class="pageNumber"></span></div>`;
const VACIO = '<span></span>';

app.whenReady().then(async () => {
  const win = new BrowserWindow({show:false, width:1240, height:1750,
    webPreferences:{offscreen:true, backgroundThrottling:false}});
  await win.loadURL(HTML);
  /* Las fotos son 45 PNG grandes; sin esta espera el PDF sale con huecos donde deberia haber imagenes. */
  await new Promise(r => setTimeout(r, 4000));
  await win.webContents.executeJavaScript(
    'Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r})))');
  await new Promise(r => setTimeout(r, 800));

  const comun = {printBackground:true, preferCSSPageSize:false, pageSize:'A4'};

  const portada = await win.webContents.printToPDF({...comun, pageRanges:'1',
    margins:{top:0,bottom:0,left:0,right:0}, displayHeaderFooter:false});
  fs.writeFileSync(path.join(SALIDA,'_portada.pdf'), portada);

  const cuerpo = await win.webContents.printToPDF({...comun, pageRanges:'2-',
    margins:{top:0.75,bottom:0.67,left:0.67,right:0.67},
    displayHeaderFooter:true, headerTemplate:VACIO, footerTemplate:PIE});
  fs.writeFileSync(path.join(SALIDA,'_cuerpo.pdf'), cuerpo);

  console.log('portada ' + Math.round(portada.length/1024) + ' KB   cuerpo ' + Math.round(cuerpo.length/1024) + ' KB');
  app.quit();
}).catch(e => { console.error('FALLO: ' + e); app.exit(1); });
