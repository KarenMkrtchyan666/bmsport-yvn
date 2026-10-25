import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {decodeVin,normalizeVin} from '../server/vin.js';
import {createApp} from '../server/app.js';
const sedan='WBAEV33'+'0000000001',coupe='WBAWC73'+'0000000001',unknown='WBAZZZZ'+'0000000001';
test('VIN: known BMW factory keys resolve series, model and chassis; unknown codes are not guessed',()=>{
  const result=decodeVin(sedan);assert.equal(result.brand,'BMW');assert.equal(result.model,'3 серия · E46');assert.equal(result.chassis,'E46');assert.match(result.vehicle,/325i/);
  assert.equal(decodeVin(coupe).chassis,'E92');assert.equal(decodeVin(unknown).matched,false);assert.equal(decodeVin(unknown).brand,'BMW');
  assert.equal(decodeVin('JTD'+'EV33'+'0000000001').matched,false);
  assert.equal(normalizeVin(` ${sedan.toLowerCase()} `),sedan);
  assert.throws(()=>decodeVin(sedan.slice(0,7)));assert.throws(()=>decodeVin(sedan.replace('V','I')));
  const history=[{vin:'JTDZZZZ'+'0000000001',brand:'Toyota',model:'Corolla',vehicle:'Toyota Corolla'}];
  assert.equal(decodeVin(history[0].vin,history).source,'visit-history');
  assert.equal(decodeVin(history[0].vin,[...history,{...history[0],model:'Camry'}]).matched,false);
});
test('VIN API validates input and reads saved vehicle history without exposing attachments',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'bmsport-vin-'));const {app,store}=createApp(join(directory,'test.sqlite'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const url=`http://127.0.0.1:${server.address().port}/api/vin/decode`;
  try{
    let response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vin:sedan.toLowerCase()})});assert.equal(response.status,200);assert.equal((await response.json()).chassis,'E46');
    response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,400);
    store.save({id:'sample',vin:'JTDZZZZ'+'0000000001',brand:'Toyota',model:'Corolla',vehicle:'Toyota Corolla',diagnosticPdf:{data:'not-returned'}});
    response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vin:'JTDZZZZ'+'0000000001'})});const data=await response.json();assert.equal(data.source,'visit-history');assert.equal(data.vehicle,'Toyota Corolla');assert.equal(data.diagnosticPdf,undefined);
  }finally{await new Promise(r=>server.close(r));store.close();rmSync(directory,{recursive:true,force:true});}
});

test('European Mercedes factory type is decoded independently of US VIN validation rules',()=>{
  const result=decodeVin('WDB203035'+'1A000001');
  assert.equal(result.matched,true);assert.equal(result.brand,'Mercedes-Benz');assert.equal(result.model,'C-Class · W203');assert.equal(result.chassis,'W203');assert.equal(result.trim,'C 180');assert.equal(result.modelYear,'');assert.equal(result.source,'mercedes-archive');
  assert.equal(decodeVin('WDB999999'+'1A000001').matched,false);
});
