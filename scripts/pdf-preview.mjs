import { createWriteStream, mkdirSync } from 'node:fs';
import { finished } from 'node:stream/promises';
import { createReport } from '../server/pdf.js';
import {diagnosticFixture} from './diagnostic-fixture.mjs';
import {analyzePdf} from '../server/diagnostic.js';
import {translateFaults} from '../server/translation.js';
mkdirSync('output/pdf',{recursive:true});
const visit = {id:'sample',date:'2026-10-26',client:'Тестовый клиент',vehicle:'BMW 3 серия · E46',plate:'ТЕСТ',vin:'TEST-VIN',mileage:'180 000',issues:[{code:'118001',status:'fixed',description:'Ошибка состава топливовоздушной смеси. Проверена герметичность впуска.',work:'Устранён подсос воздуха. Выполнена повторная проверка.'},{code:'030101',status:'observed',description:'Проверить состояние аккумуляторной батареи.',work:''}],notes:'Контрольная диагностика после пробной поездки. Проверить напряжение аккумулятора.',diagnosticPdf:{name:'Диагностика автомобиля.pdf'}};
const service = {name:'BMSPORT YVN',city:'Ереван',instagram:'@bmsport_yvn'};
visit.bodyStyle='Седан';visit.modelYear='2004';visit.vinSource='local-catalog';
visit.issues=await translateFaults(visit.issues);
for (const [name,data] of [['report-preview',visit],['report-empty',{...visit,issues:[],notes:'',diagnosticPdf:null}],['report-long',{...visit,issues:[{...visit.issues[0],description:'Проверка двигателя и электронных систем. Հայերեն տեքստ։ '.repeat(100),work:'Выполнена проверка. '.repeat(100)}],notes:'Контроль состояния. '.repeat(250)}]]) {
  const stream = createWriteStream(`output/pdf/${name}.pdf`); createReport(data,service,stream); await finished(stream);
}
console.log('PDF previews generated');
const analysis=await analyzePdf((await diagnosticFixture()).toString('base64'));
const stream=createWriteStream('output/pdf/report-extracted.pdf');
createReport({...visit,diagnosticPdf:{name:'Диагностика автомобиля.pdf',analysis}},service,stream);await finished(stream);
