import { parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

let task, ocr;
try {
  task=getDocument({data:Uint8Array.from(Buffer.from(workerData,'base64')),isEvalSupported:false,useSystemFonts:false,verbosity:0,
    standardFontDataUrl:fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/',import.meta.url)).replaceAll('\\','/'),
    cMapUrl:fileURLToPath(new URL('../node_modules/pdfjs-dist/cmaps/',import.meta.url)).replaceAll('\\','/'),cMapPacked:true});
  const pdf=await task.promise;
  if(pdf.numPages>40)throw new Error('В PDF больше 40 страниц. Разделите его на несколько файлов.');
  const pages=[],ocrPages=[],warnings=[];
  for(let n=1;n<=pdf.numPages;n++) {
    const page=await pdf.getPage(n), content=await page.getTextContent();
    const rows=[];
    for(const item of content.items) {
      if(!item.str?.trim())continue;
      const y=item.transform[5],x=item.transform[4];
      let row=rows.find(row=>Math.abs(row.y-y)<3);
      if(!row){row={y,items:[]};rows.push(row);}row.items.push({x,str:item.str});
    }
    let text=rows.sort((a,b)=>b.y-a.y).map(row=>row.items.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' ')).join('\n');
    const textLength=text.replace(/\s/g,'').length;
    const hasScan=textLength<200 && (await page.getOperatorList()).fnArray.some(op=>op===OPS.paintImageXObject || op===OPS.paintInlineImageXObject);
    if(textLength<20 || hasScan) {
      if(!ocr) {
        const {createWorker}=await import('tesseract.js');
        ocr=await createWorker(['eng','rus','hye'],1,{langPath:fileURLToPath(new URL('../assets/ocr/',import.meta.url)),gzip:false,cacheMethod:'none',errorHandler:()=>{}});
      }
      const {createCanvas}=await import('@napi-rs/canvas');
      const base=page.getViewport({scale:1});
      const scale=Math.min(2.4,Math.sqrt(10000000/(base.width*base.height)));
      const viewport=page.getViewport({scale});
      const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
      await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
      const result=await ocr.recognize(canvas.toBuffer('image/png'));
      text=result.data.text.trim();ocrPages.push(n);
      if(result.data.confidence<75)warnings.push(`Страница ${n}: низкая уверенность OCR. Проверьте текст и коды по оригиналу.`);
      if(!text)warnings.push(`Страница ${n}: текст не распознан.`);
    }
    pages.push(`--- Страница ${n} ---\n${text}`);page.cleanup();
    if(pages.join('\n').length>500000)throw new Error('В PDF слишком много текста. Разделите документ.');
  }
  if(ocrPages.length)warnings.unshift('Текст получен через OCR: возможны ошибки в кодах (например, O вместо 0). Проверьте и при необходимости исправьте текст.');
  parentPort.postMessage({text:pages.join('\n\n'),pages:pdf.numPages,ocrPages,warnings});
} catch(error) {
  const message=error.name==='PasswordException' ? 'PDF защищён паролем. Снимите защиту и загрузите его снова.' : error.message?.startsWith('В PDF') ? error.message : 'Не удалось распознать PDF. Возможно, файл повреждён или содержит неподдерживаемые данные.';
  parentPort.postMessage({error:message});
} finally {await ocr?.terminate(); await task?.destroy();}
