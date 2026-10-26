import {fork,execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2] || 'output/BMSPORT-YVN-Windows');
const directory=mkdtempSync(join(tmpdir(),'bmsport-portable-check-'));
const runtime=join(root,'runtime/node.exe');let child;
try{
 assert.ok(existsSync(runtime));
 child=fork(join(root,'scripts/desktop-launcher.mjs'),[],{execPath:runtime,cwd:root,env:{...process.env,BMSPORT_DATA_DIR:directory,BMSPORT_NO_BROWSER:'1',PORT:'0'},stdio:['ignore','pipe','pipe','ipc']});
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Portable startup timeout')),30000);child.once('error',reject);child.once('exit',code=>reject(Error(`Portable stopped (${code})`)));child.once('message',message=>{clearTimeout(timer);resolve(message.url);});});
 const page=await fetch(url);assert.equal(page.status,200);assert.match(await page.text(),/BMSPORT/);
 assert.deepEqual(await (await fetch(url+'/api/visits')).json(),[]);
 const decoded=await (await fetch(url+'/api/vin/decode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vin:'WDB2030351A000001'})})).json();assert.equal(decoded.brand,'Mercedes-Benz');
 const modulePath=pathToFileURL(join(root,'server/diagnostic.js')).href;
 const code=`const {interpretDiagnostic}=await import(${JSON.stringify(modulePath)});const rows=await interpretDiagnostic('DME\\nP0300 '+String.fromCodePoint(1055,1088,1086,1087,1091,1089,1082,1080,32,1079,1072,1078,1080,1075,1072,1085,1080,1103));if(!rows.length||/[\\u0400-\\u04ff]/.test(rows[0].description))process.exit(1);console.log('Packaged translation OK');`;
 console.log(execFileSync(runtime,['--input-type=module','-e',code],{cwd:root,encoding:'utf8',timeout:180000,windowsHide:true}).trim());
 console.log('Portable OK: bundled runtime, local HTTP, empty private database, local VIN and packaged translation.');
}finally{if(child&&!child.killed){child.kill();await new Promise(r=>child.once('exit',r));}assert.ok(directory.startsWith(tmpdir()));rmSync(directory,{recursive:true,force:true});}
