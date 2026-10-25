import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createApp} from '../server/app.js';
import {decodeVin} from '../server/vin.js';
const live=process.argv.includes('--live'),directory=mkdtempSync(join(tmpdir(),'bmsport-photo-'));
let mode='found';const requests=[];
const stub=async vehicle=>{requests.push(vehicle);return mode==='found'?{found:true,url:'https://cdn.trustcar.info/test-car.jpg',title:'Mercedes-Benz W203',license:'CC BY-SA 4.0',author:'Test photographer',attribution:'Test photographer / CC BY-SA 4.0',sourceUrl:'https://www.wikidata.org/wiki/Q11344082',match:'chassis'}:{found:false,reason:'unavailable'};};
const {app,store}=createApp(join(directory,'test.sqlite'),{decodeVehicle:decodeVin,...(live?{}:{findVehicleImage:stub})});
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(!live)await page.route('https://cdn.trustcar.info/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340"><rect width="600" height="340" fill="#e9f0f6"/><path d="M90 230l40-70 110-40h130l100 70v60H90z" fill="#59778e"/></svg>'}));
  await page.goto(`http://127.0.0.1:${server.address().port}`);const vin=page.getByLabel('VIN',{exact:true});
  await page.getByLabel('Клиент *',{exact:true}).fill('Тест');await vin.fill('WDB2030351A000001');
  const preview=page.locator('#vehicle-preview');await preview.locator('.vehicle-photo-media img').waitFor({state:'visible'});
  assert.equal(await preview.locator('.vehicle-photo-media img').evaluate(img=>img.naturalWidth>0),true);assert.match(await preview.innerText(),/Mercedes-Benz C 180/);assert.match(await preview.innerText(),/Справочное фото модели/);
  const rowInputs=await Promise.all([vin,page.getByLabel('Марка автомобиля',{exact:true}),page.getByLabel('Модель автомобиля',{exact:true})].map(input=>input.boundingBox()));
  assert.ok(rowInputs.every(box=>Math.abs(box.y-rowInputs[0].y)<2));assert.ok(rowInputs[0].x<rowInputs[1].x && rowInputs[1].x<rowInputs[2].x);
  const photoBox=await preview.boundingBox();assert.ok(rowInputs[0].y>=photoBox.y+photoBox.height);
  if(!live){assert.ok(requests.length>0);assert.equal(Object.hasOwn(requests[0],'vin'),false);assert.equal(Object.hasOwn(requests[0],'client'),false);}
  await page.getByRole('button',{name:'Сохранить посещение',exact:true}).click();await page.locator('#message').filter({hasText:'Посещение сохранено'}).waitFor();await page.reload();await page.getByRole('button',{name:/Mercedes-Benz C 180/}).click();await preview.locator('.vehicle-photo-media img').waitFor({state:'visible'});assert.equal(await page.locator('#state').innerText(),'Сохранено');
  await page.evaluate(()=>scrollTo(0,0));mkdirSync('test-results',{recursive:true});await page.screenshot({path:`test-results/vehicle-photo${live?'-live':''}-desktop.png`,fullPage:true});
  if(live)await preview.screenshot({path:'test-results/vehicle-photo-card-live.png'});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`test-results/vehicle-photo${live?'-live':''}-mobile.png`,fullPage:true});
  await vin.fill('WBA');assert.equal(await preview.isVisible(),false);
  if(!live){mode='unavailable';await vin.fill('WDB2030351A000001');await preview.getByText('Фотографии временно недоступны. Данные автомобиля определены.',{exact:true}).waitFor();assert.equal(await page.getByLabel('Автомобиль *',{exact:true}).inputValue(),'Mercedes-Benz C 180 · W203');}
  if(!live){
    mode='found';await vin.fill('');
    const brand=page.locator('#brand'),model=page.locator('#model');
    await brand.fill('BMW');await page.locator('#brand-options [role=option]').filter({hasText:/^BMW$/}).click();
    await model.fill('3');await page.locator('#model-options [role=option]').filter({hasText:/^3 серия/}).click();
    await page.locator('#model-options [role=option]').filter({hasText:/ · E46$/}).click();
    await preview.locator('.vehicle-photo-media img').waitFor({state:'visible'});
    assert.equal(await vin.inputValue(),'');assert.equal(requests.at(-1).brand,'BMW');assert.equal(requests.at(-1).chassis,'E46');
    await page.locator('.marque-identity img').waitFor({state:'visible'});
    assert.equal(await page.locator('.marque-identity img').evaluate(img=>img.naturalWidth>0),true);
    assert.match(await page.locator('.marque-identity').innerText(),/Sheer Driving Pleasure/);
    await page.getByRole('button',{name:'Сохранить посещение',exact:true}).click();await page.locator('#message').filter({hasText:'Посещение сохранено'}).waitFor();
    await page.reload();assert.equal(await page.locator('#service-journal').isVisible(),false);
    const journal=page.getByRole('button',{name:'Журнал сервиса',exact:true});await journal.click();assert.equal(await journal.getAttribute('aria-expanded'),'true');
    await page.locator('#search').focus();await page.keyboard.press('Escape');assert.equal(await page.locator('#service-journal').isVisible(),false);assert.equal(await journal.evaluate(el=>el===document.activeElement),true);
    await journal.click();await page.getByRole('button',{name:/BMW 3 серия/}).click();assert.equal(await page.locator('#service-journal').isVisible(),false);await preview.locator('.vehicle-photo-media img').waitFor({state:'visible'});
    await page.setViewportSize({width:1440,height:1050});assert.equal(await page.locator('#service-journal').isVisible(),true);assert.equal(await journal.isVisible(),false);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/manual-brand-identity.png'});
    await brand.fill('Unknown brand');assert.equal(await page.locator('.marque-identity').isVisible(),false);assert.equal(await preview.isVisible(),false);
  }
  assert.deepEqual(errors,[]);console.log(`Vehicle photo ${live?'live':'mock'} browser OK: VIN and manual selection, logo, slogan, saved visits without VIN, mobile, stale image cleared.`);
}finally{await browser?.close();await new Promise(r=>server.close(r));store.close();rmSync(directory,{recursive:true,force:true});}
