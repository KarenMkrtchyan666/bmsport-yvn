import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
export async function diagnosticFixture({scan=false}={}) {
  const doc=new PDFDocument({size:'A4',margin:40});const chunks=[];
  const done=new Promise((resolve,reject)=>{doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
  if(scan){
    const {createCanvas}=await import('@napi-rs/canvas');const canvas=createCanvas(1600,2000),ctx=canvas.getContext('2d');
    ctx.fillStyle='white';ctx.fillRect(0,0,1600,2000);ctx.fillStyle='black';ctx.font='36px Arial';
    ['DIAGNOSTIC REPORT','Control unit: DME','P0016 Crankshaft position correlation','Control unit: DSC','5DF0 Hydraulic pump motor'].forEach((line,i)=>ctx.fillText(line,70,120+i*100));
    doc.image(canvas.toBuffer('image/png'),40,40,{width:515});
  }else{
    doc.font(fileURLToPath(new URL('../assets/fonts/Report-Unicode.ttf',import.meta.url))).fontSize(12);
    for(const line of ['Диагностический отчёт','Дата: 2026-10-26','Пробег: 320000','VIN: TEST1234567890123','Блок: DME - управление двигателем','118001 Смесь слишком бедная','Количество повторений: 12','Условия появления: служебная строка','P0016 Несоответствие положения коленвала','Блок: DSC - стабилизация','5DF0 Электродвигатель гидравлического насоса','U0100 Потеря связи с блоком двигателя','Հայերեն տեքստ։'])doc.text(line);
    doc.addPage().text('Блок: EGS - коробка передач').text('420321 Контроль передаточного отношения');
  }
  doc.end();return done;
}
