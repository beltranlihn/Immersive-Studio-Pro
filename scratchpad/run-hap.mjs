import fs from 'fs';
import { evalInApp } from './cdp.mjs';
const script = fs.readFileSync(new URL('./hap-inpage.js', import.meta.url), 'utf8');
const r = await evalInApp(script);
console.log(typeof r === 'string' ? JSON.stringify(JSON.parse(r), null, 1) : r);
