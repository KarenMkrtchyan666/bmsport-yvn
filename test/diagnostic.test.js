import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {diagnosticFixture} from '../scripts/diagnostic-fixture.mjs';
import {analyzePdf,parseDiagnostic,interpretDiagnostic} from '../server/diagnostic.js';
import {createApp} from '../server/app.js';

test('diagnostic PDF: codes grouped by unit, page, no mileage/VIN; saved text survives restart and appears in report',async()=>{
  const bytes=await diagnosticFixture(),data=bytes.toString('base64');
  const result=await analyzePdf(data);
  assert.equal(result.pages,2);assert.equal(result.faults.length,5);
  assert.match(result.faults.find(f=>f.code==='118001').block,/DME/);
  assert.match(result.faults.find(f=>f.code==='5DF0').block,/DSC/);
  assert.equal(result.faults.find(f=>f.code==='420321').page,2);
  assert.ok(result.faults.every(f=>f.language==='en' && !/[А-Яа-яЁё]/.test(f.description)));
  assert.equal(result.faults.find(f=>f.code==='118001').originalDescription,'Смесь слишком бедная');
  assert.ok(result.text.includes('Հայերեն տեքստ։'));
  assert.equal(parseDiagnostic('Дата: 2026-10-26\nПробег: 320000\nVIN: WBA12345678901234').length,0);
  const directory=mkdtempSync(join(tmpdir(),'bmsport-recognition-')),path=join(directory,'test.sqlite');
  let instance=createApp(path),server;
  const start=async()=>{server=instance.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));return `http://127.0.0.1:${server.address().port}`;};
  const stop=async()=>{await new Promise(r=>server.close(r));instance.store.close();};
  let url=await start();
  try{
    const payload={client:'Тест',vehicle:'BMW',date:'2026-10-26',issues:[],diagnosticPdf:{name:'diagnostic.pdf',data,analysis:result}};
    let response=await fetch(`${url}/api/visits`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    assert.equal(response.status,201);const visit=await response.json();assert.equal(visit.diagnosticPdf.analysis.faults.length,5);
    await stop();instance=createApp(path);url=await start();
    const saved=await(await fetch(`${url}/api/visits`)).json();assert.equal(saved[0].diagnosticPdf.analysis.text,result.text);
    const reviewed=result.text.replace('118001','118002');
    const update={...payload,diagnosticText:reviewed};delete update.diagnosticPdf;
    response=await fetch(`${url}/api/visits/${visit.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(update)});
    const changed=await response.json();assert.ok(changed.diagnosticPdf.analysis.faults.some(f=>f.code==='118002'));assert.equal(changed.diagnosticPdf.analysis.reviewed,true);
    const report=await(await fetch(`${url}/api/visits/${visit.id}/pdf`)).arrayBuffer();
    const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:new Uint8Array(report),verbosity:0});const pdf=await task.promise;let text='';
    for(let p=1;p<=pdf.numPages;p++)text+=(await(await pdf.getPage(p)).getTextContent()).items.map(i=>i.str || '').join(' ');
    await task.destroy();assert.match(text,/118002/);assert.match(text,/5DF0/);assert.match(text,/420321/);assert.doesNotMatch(text,/Полный текст диагностики|Количество повторений|Условия появления/);
    response=await fetch(`${url}/api/visits/${visit.id}/analyze`,{method:'POST'});assert.equal(response.status,200);assert.ok((await response.json()).faults.some(f=>f.code==='118001'));
    response=await fetch(`${url}/api/diagnostic/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:Buffer.from('%PDF-not-valid').toString('base64')})});assert.equal(response.status,422);
    payload.diagnosticPdf=null;response=await fetch(`${url}/api/visits/${visit.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});assert.equal((await response.json()).diagnosticPdf,null);
  }finally{await stop();rmSync(directory,{recursive:true,force:true});}
});

test('only the text on the code line is taken; following lines are excluded',()=>{
  const faults=parseDiagnostic('Блок: DME\n118001 Смесь слишком бедная\nЧастота: 4\nНе добавлять эту строку\n118002\nЭто нижняя строка, а не описание\nP0016 Crankshaft correlation');
  assert.equal(faults.length,3);assert.equal(faults[0].description,'Смесь слишком бедная');assert.equal(faults[1].description,'');assert.equal(faults[2].description,'Crankshaft correlation');
});

test('INPA 0x codes: decimal alias excluded, block read from loader, same-line text translated',async()=>{
  const text='INPA - Loader: MSD80 Version 1.001\nMSD80 Read error memory\nError: 1(13) No.: 12145 0x2F71 E-Box-Lofter, Ansteuerung\nerror type: 4 (4118) Leitungsunterbrechung\nreadiness Flag: (16) Testbedingungen erfuellt';
  const raw=parseDiagnostic(text);assert.equal(raw.length,1);assert.equal(raw[0].code,'0x2F71');assert.equal(raw[0].block,'MSD80');assert.equal(raw[0].description,'E-Box-Lofter, Ansteuerung');
  const faults=await interpretDiagnostic(text);assert.equal(faults[0].description,'E-box fan control');assert.equal(faults[0].originalDescription,raw[0].description);
  assert.equal(parseDiagnostic('0X2f71 E-Box-Lüfter, Ansteuerung')[0].code,'0x2F71');
  assert.equal(parseDiagnostic('0x1234 Test fault')[0].code,'0x1234');
});

test('scanned PDF is recognized locally by OCR', {timeout:120000},async()=>{
  const result=await analyzePdf((await diagnosticFixture({scan:true})).toString('base64'));
  assert.deepEqual(result.ocrPages,[1]);assert.match(result.text,/P0016/);assert.match(result.text,/5DF[0O]/i);
  assert.ok(result.warnings.some(w=>w.includes('OCR')));
  assert.ok(result.faults.some(f=>f.code==='P0016' && /DME/.test(f.block)));
});
