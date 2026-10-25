import { Worker } from 'node:worker_threads';
import {translateFaults} from './translation.js';

export function parseDiagnostic(text) {
  const faults = [], seen = new Set();
  let block = 'Блок не указан', page = 1;
  const lines = text.split(/\r?\n/);
  for (let i=0;i<lines.length;i++) {
    const line = lines[i].trim();
    const pageMatch = line.match(/^--- Страница (\d+) ---$/);
    if (pageMatch) { page = Number(pageMatch[1]); continue; }
    if(/^(?:error\s+type|readiness\s+flag|Fehlerart|Fehlerh[aä]ufigkeit|Umweltbedingungen|frequency|occurrences)\s*[:(]/i.test(line))continue;
    const loader=line.match(/\bLoader\s*:\s*([A-Z][A-Z0-9_.-]*)/i) || line.match(/^([A-Z][A-Z0-9_.-]*)\s+Read error memory\b/i);
    if(loader)block=loader[1].toUpperCase();
    const heading = line.match(/\b(DME|DDE|DDE\d|DSC|ABS|EGS|TCU|ECM|ECU|BDC|FEM|FRM|CAS|JBE|KOMBI|ICM|ACSM|SRS|IHKA|EPS|VTG|DTCM|ZGM|CIC|NBT|HU|FZD|PDC|EMF|DWA|EKPS|SMFA|SMBF|GWS|SZL)\b/i);
    const explicit = line.match(/^(?:Блок(?: управления)?|ЭБУ|Control unit|System|Module|ECU)\s*[:\-]\s*(.+)/i);
    // OBD codes and manufacturer hexadecimal codes; plain years and mileage are excluded.
    const candidates = [...line.matchAll(/\b(?:0x\s*[0-9A-F]{4,8}|[PBCU][0-3][0-9A-F]{3}|[0-9A-F]{4,8})\b/gi)].filter(m => {
      const code=m[0];
      if(/^0x\s*[0-9A-F]{4,8}$/i.test(code))return true;
      if (/^[PBCU][0-3][0-9A-F]{3}$/i.test(code)) return true;
      if (!/\d/.test(code) || /^(?:19|20)\d{2}$/.test(code)) return false;
      if (/VIN|пробег|mileage|одометр|телефон|phone|дата|date|номер отч[её]та/i.test(line)) return false;
      let prefix=line.slice(0,m.index);
      if(heading && heading.index<=3)prefix=prefix.replace(heading[0],'');
      return /[A-F]/i.test(code) || /^\s*(?:\d{1,3}\s+)?(?:код(?: ошибки)?|DTC|Fault(?: code)?|Code)?\s*[:#|\-]?\s*$/i.test(prefix) && (code.length === 6 || code.length===5 && code.startsWith('0'));
    });
    if(explicit && !candidates.length) block=explicit[1].trim().slice(0,200);
    else if(heading && heading.index<=3)block=candidates.length ? heading[1].toUpperCase() : line.slice(0,200);
    for (const [index,match] of candidates.entries()) {
      const code=/^0x/i.test(match[0]) ? `0x${match[0].slice(2).replace(/\s/g,'').toUpperCase()}` : match[0].toUpperCase();
      const key=`${block}|${code.replace(/^0x/,'')}|${page}`;
      if (seen.has(key)) continue; seen.add(key);
      const description = line.slice(match.index+match[0].length,candidates[index+1]?.index).replace(/^[\s:;|\-–—]+/,'').trim();
      faults.push({code,block,description,page});
    }
  }
  return faults;
}

export async function interpretDiagnostic(text){return translateFaults(parseDiagnostic(text));}

let running = false;
export async function analyzePdf(data) {
  if (running) { const error=new Error('Распознавание другого PDF ещё выполняется. Повторите чуть позже.'); error.status=429; throw error; }
  running=true;
  try {
    const result=await new Promise((resolve,reject) => {
      const worker = new Worker(new URL('./diagnostic-worker.js',import.meta.url),{workerData:data,execArgv:[]});
      const timer=setTimeout(()=>{ worker.terminate(); reject(new Error('Распознавание заняло слишком много времени. Попробуйте PDF с меньшим числом страниц.')); },120000);
      worker.once('message',result=>{clearTimeout(timer); worker.terminate(); result.error ? reject(new Error(result.error)) : resolve(result);});
      worker.once('error',()=>{clearTimeout(timer);reject(new Error('Не удалось прочитать PDF диагностики. Проверьте файл.'));});
      worker.once('exit',code=>{clearTimeout(timer);if(code!==0)reject(new Error('Распознавание PDF остановлено. Попробуйте ещё раз.'));});
    });
    return {...result,faults:await interpretDiagnostic(result.text),formatVersion:3};
  } finally {running=false;}
}
