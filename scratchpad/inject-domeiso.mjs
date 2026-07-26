// Inserta drawDomeIso justo antes de drawRoomStrip, preservando CRLF.
import fs from 'fs';
const SRC = 'C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/915cce60-8c65-4707-95e3-4189823871fb/scratchpad/domeiso.js';
const raw = fs.readFileSync('app.js', 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const anchor = 'function drawRoomStrip(cv,walls,floorOn,activeRole,pal)';
if (!raw.includes(anchor)) { console.error('sin ancla'); process.exit(1); }
if (raw.includes('function drawDomeIso')) { console.log('ya estaba'); process.exit(0); }
const body = fs.readFileSync(SRC, 'utf8').replace(/\r?\n/g, nl).replace(/\s+$/, '');
fs.writeFileSync('app.js', raw.replace(anchor, body + nl + anchor), 'utf8');
console.log('drawDomeIso insertado (' + body.split(nl).length + ' lineas)');
