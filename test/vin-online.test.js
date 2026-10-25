import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createVinDecoder,ONLINE_VIN_PROVIDERS} from '../server/vin-online.js';
const vin='JTDZZZZ'+'0000000001';
const response=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}});
const vehicle={make:'TOYOTA',model:'Corolla',trim:'LE',year:'2019',body_class:'Sedan/Saloon'};
test('online VIN: NHTSA is normalized, cached; exact chassis is not inferred from body class',async()=>{
  let count=0;
  const decode=createVinDecoder({fetchImpl:async()=>{count++;return response({Results:[{Make:'TOYOTA',Model:'Corolla',ModelYear:'2019',BodyClass:'Sedan/Saloon',ErrorCode:'0'}]});}});
  const result=await decode(vin);assert.equal(result.matched,true);assert.equal(result.brand,'Toyota');assert.equal(result.bodyStyle,'Седан');assert.equal(result.modelYear,'2019');assert.equal(result.chassis,'');assert.equal(result.source,'nhtsa');
  assert.equal((await decode(vin)).cached,true);assert.equal(count,1);
});
test('local BMW chassis wins and customer history does not trigger online requests',async()=>{
  const decode=createVinDecoder({fetchImpl:()=>{throw new Error('Must not call online provider');}});
  assert.equal((await decode('WBAEV33'+'0000000001')).chassis,'E46');
  const result=await decode(vin,[{vin,brand:'Toyota',model:'Corolla',vehicle:'Toyota Corolla'}]);assert.equal(result.source,'visit-history');
});
test('each free provider response is supported, and a failed primary falls back',async()=>{
  const fixtures={nhtsa:{Results:[{Make:'TOYOTA',Model:'Corolla',ModelYear:'2019',BodyClass:'Sedan/Saloon'}]},vinspecs:{success:true,data:{...vehicle,body_type:'Sedan/Saloon'}},cleanvins:{vehicle},checkmyvin:{vehicle:{...vehicle,modelYear:'2019',bodyClass:'Sedan/Saloon'}},carwhere:{decoded:{...vehicle,bodyStyle:'Sedan'}}};
  for(const provider of ONLINE_VIN_PROVIDERS){
    const decode=createVinDecoder({providers:[provider],fetchImpl:async()=>response(fixtures[provider.id])});const result=await decode(vin);assert.equal(result.source,provider.id);assert.equal(result.matched,true);assert.equal(result.brand,'Toyota');assert.equal(result.model,'Corolla');
  }
  let calls=0;const decode=createVinDecoder({fetchImpl:async()=>++calls===1?response({},503):response(fixtures.vinspecs)});
  const result=await decode(vin);assert.equal(result.source,'vinspecs');assert.equal(calls,2);assert.deepEqual(result.sourcesUsed,['vinspecs']);
});
test('empty data does not manufacture a brand; outages do not count as a definitive missing VIN',async()=>{
  const missing=createVinDecoder({fetchImpl:async()=>response({})});const result=await missing(vin);assert.equal(result.matched,false);assert.equal(result.brand,'');assert.equal(result.attempts.length,5);
  let calls=0;const outage=createVinDecoder({providers:ONLINE_VIN_PROVIDERS.slice(0,1),fetchImpl:async()=>{calls++;throw new Error('network unavailable');}});
  assert.equal((await outage(vin)).matched,false);await outage(vin);assert.equal(calls,2);
});
test('rate-limit cooldown is respected, and corrected/mismatched VINs are not auto-filled',async()=>{
  let calls=0;const limited=createVinDecoder({providers:ONLINE_VIN_PROVIDERS.slice(0,1),fetchImpl:async()=>{calls++;return response({},429,{'retry-after':'3600'});}});
  await limited(vin);await limited('JTDZZZZ'+'0000000002');assert.equal(calls,1);
  const unsafe=createVinDecoder({fetchImpl:async()=>response({Results:[{Make:'TOYOTA',Model:'Corolla',ErrorCode:'2'}]})});assert.equal((await unsafe(vin)).matched,false);
  const mismatch=createVinDecoder({fetchImpl:async()=>response({Results:[{VIN:'JTDZZZZ'+'0000000002',Make:'TOYOTA',Model:'Corolla',ErrorCode:'0'}]})});assert.equal((await mismatch(vin)).matched,false);
});

test('incomplete NHTSA decoding continues to other providers and never labels a covered-format VIN invalid',async()=>{
  let calls=0;
  const fallback=createVinDecoder({fetchImpl:async()=>++calls===1?response({Results:[{ErrorCode:'1,5,14',Make:'',Model:'',ModelYear:'2001'}]}):response({success:true,data:{...vehicle,body_type:'Sedan/Saloon'}})});
  const found=await fallback(vin);assert.equal(found.matched,true);assert.equal(found.source,'vinspecs');assert.equal(calls,2);
  const unsupported=createVinDecoder({fetchImpl:async()=>response({Results:[{ErrorCode:'1,5,14',Make:'',Model:'',ModelYear:'2001'}]})});
  const result=await unsupported(vin);assert.equal(result.matched,false);assert.equal(result.attempts.length,5);assert.match(result.message,/Это не означает/);assert.doesNotMatch(result.message,/Проверьте номер; данные/);
  const local=createVinDecoder({fetchImpl:()=>{throw new Error('No network needed for known European factory type');}});
  assert.equal((await local('WDB203035'+'1A000001')).vehicle,'Mercedes-Benz C 180 · W203');
});
