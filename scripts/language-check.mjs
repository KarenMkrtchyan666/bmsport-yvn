import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.js';
const directory=mkdtempSync(join(tmpdir(),'bmsport-language-'));
const {app,store}=createApp(join(directory,'test.sqlite'),{findVehicleImage:async()=>({found:false})});
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.locator('[name=client]').fill('Клиент без перевода');await page.locator('[name=vehicle]').fill('Тестовый автомобиль');
 await page.locator('#language').selectOption('en');
 await page.getByRole('button',{name:'Save visit',exact:true}).waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'en');
 assert.equal(await page.locator('[name=client]').inputValue(),'Клиент без перевода');
 await page.getByRole('tab',{name:'Diagnostics',exact:false}).click();await page.getByRole('button',{name:'+ Add fault',exact:true}).click();
 await page.getByLabel('Description *',{exact:true}).fill('Customer description');await page.locator('[name=notes]').fill('Заметки клиента');assert.equal(await page.locator('[data-field=status]').inputValue(),'remaining');
 await page.getByRole('tab',{name:'Documents',exact:true}).click();await page.getByText('No file attached',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Save visit',exact:true}).click();await page.getByText('Visit saved on this computer.',{exact:true}).waitFor();
 await page.locator('#language').selectOption('ru');await page.getByRole('button',{name:'Сохранить посещение',exact:true}).waitFor();
 await page.getByRole('tab',{name:/Диагностика/}).click();assert.equal(await page.getByLabel('Описание *',{exact:true}).inputValue(),'Customer description');assert.equal(await page.locator('[name=notes]').inputValue(),'Заметки клиента');
 await page.locator('#language').selectOption('en');await page.reload();await page.getByRole('button',{name:'Save visit',exact:true}).waitFor();
 assert.equal(await page.locator('#language').inputValue(),'en');await page.locator('#visits .visit').click();assert.equal(await page.locator('[name=vehicle]').inputValue(),'Тестовый автомобиль');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('Language OK: live switch, dynamic faults, save, reload persistence, preserved customer text and mobile.');
}finally{await browser?.close();await new Promise(r=>server.close(r));store.close();rmSync(directory,{recursive:true,force:true});}
