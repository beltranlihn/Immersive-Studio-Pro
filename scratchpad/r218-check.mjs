import { evalInApp } from './cdp.mjs';

const expr = process.argv[2];
evalInApp(expr).then(v => console.log(JSON.stringify(v, null, 2))).catch(e => { console.error('ERR', e.message); process.exit(1); });
