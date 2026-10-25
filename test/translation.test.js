import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translateFaults} from '../server/translation.js';
test('English diagnostics stay unchanged; descriptions in Russian and German are translated locally', {timeout:180000},async()=>{
  const descriptions=['Crankshaft position correlation','Смесь слишком бедная','Датчик давления топлива: обрыв цепи','Batteriespannung zu niedrig'];
  const result=await translateFaults(descriptions.map((description,index)=>({code:String(index),description})));
  assert.equal(result[0].description,descriptions[0]);assert.equal(result[1].description,'Fuel mixture too lean');
  assert.match(result[2].description,/fuel.*pressure.*sensor/i);assert.match(result[3].description,/battery.*voltage/i);
  result.forEach((fault,index)=>{assert.equal(fault.originalDescription,descriptions[index]);assert.equal(fault.language,'en');});
});
