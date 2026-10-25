import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createVehicleImageLookup,imageQuery} from '../server/vehicle-images.js';
const photo={found:true,image_url:'https://cdn.trustcar.info/carphotos/test.jpg',title:'Mercedes-Benz W203',author:'Sample Author',license:'CC BY-SA 4.0',attribution:'Sample Author / CC BY-SA 4.0',reference:'Q11344082'};
const response=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
test('photos use only make/model, preserve attribution, and are cached',async()=>{
  let count=0;const lookup=createVehicleImageLookup({fetchImpl:async url=>{count++;const query=new URL(url);assert.equal(query.searchParams.get('make'),'Mercedes-Benz');assert.equal(query.searchParams.get('model'),'W203');assert.equal(query.searchParams.has('vin'),false);return response(photo);}});
  const result=await lookup({brand:'Mercedes-Benz',model:'C-Class · W203',vin:'WDB2030351A000001'});assert.equal(result.found,true);assert.equal(result.match,'chassis');assert.equal(result.license,'CC BY-SA 4.0');assert.equal(result.attribution,photo.attribution);
  await lookup({brand:'Mercedes-Benz',model:'C-Class · W203'});assert.equal(count,1);
});
test('a generic or different generation photo is rejected for a known chassis',async()=>{
  const lookup=createVehicleImageLookup({fetchImpl:async()=>response({...photo,title:'BMW M3'})});
  assert.equal((await lookup({brand:'BMW',model:'3 серия · E46'})).found,false);
  assert.equal(imageQuery({brand:'BMW',model:'3 серия · E46'}).models[0],'3 Series (E46)');
});
test('untrusted image URLs and unlicensed images are not shown',async()=>{
  for(const overrides of [{image_url:'javascript:alert(1)'},{image_url:'https://untrusted.example/test.jpg'},{license:''}]){
    const lookup=createVehicleImageLookup({fetchImpl:async()=>response({...photo,...overrides})});assert.equal((await lookup({brand:'Mercedes-Benz',model:'C-Class · W203'})).found,false);
  }
  assert.equal(imageQuery({brand:'BMW',model:'WBAEV330000000001'}),null);
});
test('image provider outages do not block decoding or become permanently cached misses',async()=>{
  let calls=0;const lookup=createVehicleImageLookup({fetchImpl:async()=>{calls++;throw new Error('network failure');}});
  assert.equal((await lookup({brand:'Honda',model:'Accord'})).reason,'unavailable');await lookup({brand:'Honda',model:'Accord'});assert.equal(calls,2);
});
