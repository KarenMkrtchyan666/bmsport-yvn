import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto('http://127.0.0.1:3000');
 await page.waitForSelector('.brand-ambient-layer',{state:'attached'});
 for(const [brand,id,accent] of [['BMW','bmw','#99bfff'],['Mercedes-Benz','mercedes','#c5d2df'],['','neutral','#c9bba1']]){
  await page.locator('[name=brand]').fill(brand);
  await page.locator('[name=brand]').dispatchEvent('input');
  await page.waitForFunction(id=>document.documentElement.dataset.brand===id,id);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--brand-accent').trim()),accent);
  assert.equal(await page.locator('.brand-ambient-layer').evaluateAll(nodes=>nodes.filter(n=>n.style.opacity==='1').length),1);
 }
 await page.locator('[name=brand]').fill('BMW');
 await page.locator('[name=brand]').dispatchEvent('input');
 await page.waitForTimeout(1000);
 await page.screenshot({path:'test-results/brand-theme-bmw.png'});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log('Brand themes OK: BMW, Mercedes, neutral reset, inherited accents and mobile width.');
}finally{await browser.close();}
