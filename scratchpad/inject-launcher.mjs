// Inserta el launcher en app.js reemplazando el marcador, preservando CRLF.
import fs from 'fs';
const SRC = 'C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/915cce60-8c65-4707-95e3-4189823871fb/scratchpad/launcher.js';
const raw = fs.readFileSync('app.js', 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
if (!raw.includes('/*__LAUNCHER_HERE__*/')) { console.error('no está el marcador'); process.exit(1); }
const body = fs.readFileSync(SRC, 'utf8').replace(/\r?\n/g, nl).replace(/\s+$/, '');
fs.writeFileSync('app.js', raw.replace('/*__LAUNCHER_HERE__*/', body), 'utf8');
console.log('launcher insertado (' + body.split(nl).length + ' lineas)');
