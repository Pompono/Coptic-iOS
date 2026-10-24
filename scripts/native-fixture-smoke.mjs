// WebKit regression for the CI fixture under Capacitor SPA document routing.
// Native plugin calls are stubbed here; macOS separately verifies the real bridge.
import { webkit } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';

const root = path.resolve('out');
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = !path.extname(pathname) ? path.join(root, 'index.html') : path.resolve(root, `.${pathname}${pathname.endsWith('/') ? 'index.html' : ''}`);
    if (!file.startsWith(root + path.sep)) throw Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const types = { '.txt': 'text/plain', '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf' };
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
 browser = await webkit.launch({headless:true});
 const context = await browser.newContext();
 await context.route('**/native-backup-api.js', async route => route.fulfill({contentType:'text/javascript',body:await readFile('ios/App/App/public/native-backup-api.js','utf8')}));
 const page=await context.newPage();
 const fixture=await readFile('scripts/native-backup-smoke.js','utf8');
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 let result;
 for(let attempt=0;attempt<200;attempt++) {
  try {
   await page.evaluate(()=>{
    if(window.__nativeBackupApi) window.__nativeBackupApi.saveProgressFile=async()=> 'Export cancelled.';
    let value;
    window.Capacitor={nativePromise:async(plugin,method,args)=>{
     if(method==='setItem')value=args.value;
     if(method==='getItem')return {value};
     if(method==='readdir')return {files:[]};
     return {};
    }};
   });
   result=await page.evaluate(fixture);
   if(result?.status==='failed')throw new Error(result.message);
   if(result?.status==='passed')break;
  }catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}
  await page.waitForTimeout(100);
 }
 assert.equal(result?.status,'passed',JSON.stringify(result));
 console.log('PASS: updated CI fixture drives current recovery UI, cancellation, validation, restore and reload with real storage functions (native plugins stubbed locally).');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}



