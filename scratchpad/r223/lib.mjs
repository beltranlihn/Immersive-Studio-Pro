// [R223] harness de verificación: eval + screenshot + colector de errores
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 9222;
export const SHOTS = path.join(import.meta.dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

function targets() {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: PORT, path: '/json/list' }, r => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

let _ws = null;
async function ws() {
  if (_ws && _ws.readyState === 1) return _ws;
  const list = await targets();
  const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error('no page target on ' + PORT);
  const s = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { s.onopen = res; s.onerror = () => rej(new Error('ws connect failed')); });
  _ws = s; return s;
}
let _id = 0;
export async function cmd(method, params = {}, timeout = 120000) {
  const s = await ws(); const id = ++_id;
  return await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('CDP timeout ' + method)), timeout);
    const h = ev => { const m = JSON.parse(ev.data); if (m.id !== id) return; s.removeEventListener('message', h); clearTimeout(t);
      if (m.error) return rej(new Error('CDP error: ' + JSON.stringify(m.error))); res(m.result); };
    s.addEventListener('message', h);
    s.send(JSON.stringify({ id, method, params }));
  });
}
export async function ev(expr, timeout = 120000) {
  const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout }, timeout);
  if (r.exceptionDetails) {
    const e = r.exceptionDetails;
    throw new Error('page threw: ' + ((e.exception && (e.exception.description || e.exception.value)) || e.text));
  }
  return r.result.value;
}
// IIFE async wrapper: permite `return`
export const fn = (body, timeout) => ev('(async function(){' + body + '\n})()', timeout);

export async function shot(name) {
  const r = await cmd('Page.captureScreenshot', { format: 'png' });
  const p = path.join(SHOTS, name.endsWith('.png') ? name : name + '.png');
  fs.writeFileSync(p, Buffer.from(r.data, 'base64'));
  return p;
}
export async function installErrs() {
  await ev(`(function(){ window.__errs=[];
    window.addEventListener('error',e=>window.__errs.push('error: '+(e.message||'')+' @'+(e.filename||'')+':'+(e.lineno||'')));
    window.addEventListener('unhandledrejection',e=>window.__errs.push('rejection: '+((e.reason&&(e.reason.message||e.reason))||'')));
    const ce=console.error; console.error=function(...a){ try{window.__errs.push('console.error: '+a.map(x=>{try{return (x&&x.message)||String(x);}catch(_){return '?';}}).join(' '));}catch(_){} return ce.apply(console,a); };
    return true; })()`);
}
export const errs = () => ev('JSON.stringify(window.__errs||[])').then(s => JSON.parse(s || '[]'));
export function close() { try { if (_ws) _ws.close(); } catch (_) {} }
export const sleep = ms => new Promise(r => setTimeout(r, ms));
