import { connect } from './r222-lib.mjs';
const { cmd, ws } = await connect();
const outDir = 'C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/f0de9ad5-8bdc-480b-8a2f-b96e2600a726/scratchpad/';
const args = process.argv.slice(2); // x y w h outname
const [x,y,w,h,name] = args;
const {data} = await cmd('Page.captureScreenshot',{format:'png', clip:{x:+x,y:+y,width:+w,height:+h,scale:3}});
const fs = await import('fs');
fs.writeFileSync(outDir+name, Buffer.from(data,'base64'));
console.log('saved', outDir+name);
ws.close();
