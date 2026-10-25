import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {join,resolve,dirname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createApp} from '../server/app.js';

// Verify rollback in a disposable directory, never against the working project.
const rollbackRoot=mkdtempSync(join(tmpdir(),'bmsport-rollback-'));
try{
  const files=['public/index.html','public/styles.css','public/app.js','scripts/browser-check.mjs'],snapshot=join(rollbackRoot,'.ui-backups','snapshot-1');const entries=[];
  for(const file of files){const path=join(rollbackRoot,file),saved=join(snapshot,file),original=`original-${file}`;mkdirSync(dirname(path),{recursive:true});mkdirSync(dirname(saved),{recursive:true});writeFileSync(path,'new UI');writeFileSync(saved,original);entries.push({path:file,sha256:createHash('sha256').update(original).digest('hex')});}
  writeFileSync(join(rollbackRoot,'.ui-backups/current.json'),JSON.stringify({name:'snapshot-1'}));writeFileSync(join(snapshot,'manifest.json'),JSON.stringify({files:entries}));writeFileSync(join(rollbackRoot,'public/workspace-ui.js'),'new module');
  const result=spawnSync(process.execPath,[resolve('scripts/restore-ui.mjs')],{cwd:rollbackRoot,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  for(const file of files)assert.equal(readFileSync(join(rollbackRoot,file),'utf8'),`original-${file}`);assert.equal(existsSync(join(rollbackRoot,'public/workspace-ui.js')),false);
  console.log('Rollback OK: original UI files restored exactly in isolated workspace.');
}finally{assert.ok(resolve(rollbackRoot).startsWith(resolve(tmpdir())+sep));rmSync(rollbackRoot,{recursive:true,force:true});}

const directory=mkdtempSync(join(tmpdir(),'bmsport-premium-')),{app,store}=createApp(join(directory,'test.sqlite'),{findVehicleImage:async()=>({found:false,reason:'not-found'})});
const vin='WBAEV33'+'0000000001';
for(const [id,date,vehicleVin,vehicle] of [['old','2026-10-25',vin,'BMW 325i · E46'],['current','2026-10-26',vin,'BMW 325i · E46'],['other','2026-10-26','WBAWC73'+'0000000002','BMW 335xi · E92']])store.save({id,date,vin:vehicleVin,vehicle,brand:'BMW',model:'3 серия · E46',client:'Тестовый клиент',issues:[],notes:''});
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('tab',{name:'Документы',exact:true}).click();await page.getByRole('button',{name:'Сохранить посещение',exact:true}).click();
  assert.equal(await page.getByRole('tab',{name:'Посещение',exact:true}).getAttribute('aria-selected'),'true');assert.equal(await page.evaluate(()=>document.activeElement.name),'client');
  await page.getByLabel('Клиент *',{exact:true}).fill('Новый тест');await page.getByLabel('Автомобиль *',{exact:true}).fill('BMW');
  await page.getByRole('tab',{name:/Диагностика/}).click();await page.getByRole('button',{name:'+ Добавить ошибку',exact:true}).click();
  await page.getByRole('tab',{name:'Документы',exact:true}).click();await page.getByRole('button',{name:'Сохранить посещение',exact:true}).click();assert.equal(await page.getByRole('tab',{name:/Диагностика/}).getAttribute('aria-selected'),'true');assert.equal(await page.evaluate(()=>document.activeElement.dataset.field),'description');
  await page.getByLabel('Описание *',{exact:true}).fill('Тестовая ошибка');await page.getByRole('tab',{name:'Документы',exact:true}).click();await page.getByRole('tab',{name:/Диагностика/}).click();assert.equal(await page.getByLabel('Описание *',{exact:true}).inputValue(),'Тестовая ошибка');
  page.once('dialog',dialog=>dialog.accept());await page.locator('#visits .visit').filter({hasText:'BMW 325i'}).filter({hasText:'2026-10-26'}).click();
  await page.getByRole('tab',{name:'История',exact:true}).click();assert.equal(await page.locator('#vehicle-history .history-card').count(),2);assert.equal(await page.locator('#vehicle-history .current').count(),1);assert.equal(await page.locator('#vehicle-history').getByText('BMW 335xi · E92',{exact:true}).count(),0);
  await page.locator('#vehicle-history .history-card').filter({hasText:'25.10.2026'}).click();assert.equal(await page.getByRole('tab',{name:'Посещение',exact:true}).getAttribute('aria-selected'),'true');assert.equal(await page.getByLabel('Дата *',{exact:true}).inputValue(),'2026-10-25');
  await page.getByRole('tab',{name:'Посещение',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('tab',{name:/Диагностика/}).getAttribute('aria-selected'),'true');await page.keyboard.press('Home');assert.equal(await page.getByRole('tab',{name:'Посещение',exact:true}).getAttribute('aria-selected'),'true');
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);console.log('Premium UI OK: tabs, draft preservation, hidden-field validation, VIN history, keyboard and mobile.');
}finally{await browser?.close();await new Promise(r=>server.close(r));store.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}
