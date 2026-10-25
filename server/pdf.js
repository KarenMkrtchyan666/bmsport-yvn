import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import {VIN_SOURCES} from '../public/vin-sources.js';

export function createReport(visit, service, response) {
  const doc = new PDFDocument({ margins: { top: 96, bottom: 60, left: 44, right: 44 }, size: 'A4', bufferPages: true, info: { Title: `${service.name} - ${visit.vehicle}`, Author: service.name } });
  doc.registerFont('Regular', fileURLToPath(new URL('../assets/fonts/Report-Unicode.ttf', import.meta.url)));
  doc.registerFont('Bold', fileURLToPath(new URL('../assets/fonts/Report-Unicode-Bold.ttf', import.meta.url)));
  doc.pipe(response);
  const left = 44, width = doc.page.width - 88;
  const blue = '#123C65', ink = '#172C40', muted = '#60758A';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(visit.date) ? visit.date.split('-').reverse().join('.') : visit.date;
  function header() {
    const previousFont = doc._font?.name?.includes('Bold') ? 'Bold' : 'Regular';
    const previousSize = doc._fontSize;
    const previousColor = doc._fillColor;
    doc.save();
    doc.rect(0,0,doc.page.width,7).fill('#2786C8');
    doc.font('Bold').fontSize(21).fillColor(blue).text(service.name,left,28,{width});
    doc.font('Regular').fontSize(9).fillColor(muted).text([service.city,service.address,service.phone,service.instagram].filter(Boolean).join('  /  '),left,57,{width});
    doc.moveTo(left,77).lineTo(left+width,77).lineWidth(0.6).strokeColor('#D7E2EB').stroke();
    doc.restore(); doc.font(previousFont).fontSize(previousSize);
    if (previousColor) doc.fillColor(...previousColor);
    doc.x = left; doc.y = 96;
  }
  header(); doc.on('pageAdded',header);
  function ensure(height) { if (doc.y+height > doc.page.height-62) doc.addPage(); }
  function text(value,{bold=false,size=10,color=ink}={}) {
    doc.font(bold?'Bold':'Regular').fontSize(size).fillColor(color).text(String(value),left,doc.y,{width,lineGap:3});
  }
  function section(number,title) {
    ensure(65); doc.y += 15;
    const y = doc.y;
    doc.roundedRect(left,y,width,27,4).fill('#EDF3F8');
    doc.font('Bold').fontSize(10).fillColor(blue).text(`${number}  ${title}`,left+12,y+8,{width:width-24,lineBreak:false});
    doc.y = y+39; doc.x = left;
  }
  function field(label,value) {
    const content = value ? String(value) : 'Не указано';
    doc.font('Regular').fontSize(10);
    ensure(Math.max(22,doc.heightOfString(content,{width:width-120,lineGap:3})+9));
    const y = doc.y;
    doc.fontSize(9).fillColor(muted).text(label,left,y,{width:110});
    doc.font('Regular').fontSize(10).fillColor(ink).text(content,left+120,y,{width:width-120,lineGap:3});
    doc.y = Math.max(doc.y,y+14)+7; doc.x = left;
  }
  text('ОТЧЁТ О ПОСЕЩЕНИИ',{bold:true,size:20,color:blue});
  text(`Диагностика и обслуживание  /  ${date}`,{size:10,color:muted});
  section('01','КЛИЕНТ И АВТОМОБИЛЬ');
  for (const [label,value] of [['Клиент',visit.client],['Автомобиль',visit.vehicle],...(visit.bodyStyle?[['Тип кузова',visit.bodyStyle]]:[]),...(visit.modelYear?[['Модельный год',visit.modelYear]]:[]),['Госномер',visit.plate],['VIN',visit.vin],['Пробег, км',visit.mileage]]) field(label,value);
  const vinSource=VIN_SOURCES[visit.vinSource];
  if(vinSource){
    ensure(30);doc.font('Regular').fontSize(8).fillColor(muted).text(`Источник данных VIN: ${vinSource.label}`,left,doc.y,{width,link:visit.vinSource==='carwhere'?`https://www.carwhere.com/vin/${encodeURIComponent(visit.vin || '')}`:vinSource.url || undefined});
  }
  section('02','РЕЗУЛЬТАТЫ ДИАГНОСТИКИ И РАБОТЫ');
  const issues = visit.issues || [];
  const labels = { fixed: 'Устранено', remaining: 'Осталось', observed: 'Требует проверки' };
  if (!issues.length) {
    text(visit.diagnosticPdf?.analysis?.text ? 'Ручные записи по ошибкам и работам не внесены.' : 'Результаты диагностики не внесены.',{bold:true});
    text(visit.diagnosticPdf?.analysis?.text ? 'Распознанная диагностика, коды и блоки приведены в разделе 04.' : 'Отсутствие записей в отчёте не подтверждает отсутствие неисправностей.',{size:9,color:muted});
  } else {
    text(`Всего: ${issues.length}   /   Устранено: ${issues.filter(i=>i.status==='fixed').length}   /   Осталось: ${issues.filter(i=>i.status==='remaining').length}   /   Проверить: ${issues.filter(i=>i.status==='observed').length}`,{size:9,color:muted});
    const colors = {fixed:'#247348',remaining:'#A33A32',observed:'#94630B'};
    for (const [index,item] of issues.entries()) {
      ensure(95); doc.y += 13;
      text(`${String(index+1).padStart(2,'0')}   ${item.code || 'Без кода'}   /   ${labels[item.status] || 'Статус не указан'}`,{bold:true,size:11,color:colors[item.status] || blue});
      if(item.block)text(`Блок: ${item.block}`,{size:9,color:muted});
      doc.y += 4; text(item.description || 'Описание не указано');
      doc.y += 6; text('Выполненные работы',{bold:true,size:9,color:muted});
      text(item.work || 'Не указаны'); doc.y += 8;
      doc.moveTo(left,doc.y).lineTo(left+width,doc.y).lineWidth(0.5).strokeColor('#D7E2EB').stroke();
    }
  }
  section('03','РЕКОМЕНДАЦИИ');
  text(visit.notes || 'Рекомендации не внесены.',{color:visit.notes ? ink : muted});
  ensure(visit.diagnosticPdf?.analysis?.faults?.length ? 190 : 125);
  section('04','РАСШИФРОВКА PDF ДИАГНОСТИКИ');
  if (visit.diagnosticPdf) {
    text(`PDF диагностики: ${visit.diagnosticPdf.name}`);
    const analysis=visit.diagnosticPdf.analysis;
    if(analysis?.text?.trim()) {
      doc.y+=8;
      text('Код и описание из одной строки документа. Описание автоматически переведено на английский.',{size:9,color:muted});
      if(analysis.reviewed)text('Текст отредактирован в приложении пользователем.',{size:9,color:muted});
      for(const warning of analysis.warnings || [])text(warning,{size:9,color:'#94630B'});
      if(analysis.faults?.length) {
        ensure(110);doc.y+=10;text('Найденные коды и блоки',{bold:true,size:11,color:blue});
        for(const fault of analysis.faults) {
          ensure(65);doc.y+=8;
          text(`${fault.block}  /  ${fault.code}  /  стр. ${fault.page}`,{bold:true,size:10});
          text(fault.description,{size:10});
        }
      } else {doc.y+=6;text('Коды ошибок автоматически не выделены. Проверьте исходный PDF в приложении.',{size:9,color:muted});}
    } else text('Текст диагностики ещё не распознан. Откройте посещение и нажмите «Распознать PDF».',{size:9,color:muted});
  } else text('PDF диагностики не прикреплён.',{color:muted});
  const pages = doc.bufferedPageRange();
  for (let i=pages.start;i<pages.start+pages.count;i++) {
    doc.switchToPage(i);
    const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    const y = doc.page.height-36;
    doc.moveTo(left,y-10).lineTo(left+width,y-10).lineWidth(0.5).strokeColor('#D7E2EB').stroke();
    doc.font('Regular').fontSize(8).fillColor(muted).text(`${service.name}  /  ${date}`,left,y,{width:width-85,lineBreak:false});
    doc.text(`${i+1} / ${pages.count}`,left+width-75,y,{width:75,align:'right',lineBreak:false});
    doc.page.margins.bottom = bottom;
  }
  doc.end();
}
