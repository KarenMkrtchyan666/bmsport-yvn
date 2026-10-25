import express from 'express';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.js';
import { createReport } from './pdf.js';
import { analyzePdf, interpretDiagnostic } from './diagnostic.js';
import {translateFaults} from './translation.js';
import {decodeVinWithSources,availableVinSources} from './vin-online.js';
import {normalizeVin} from './vin.js';
import {VIN_SOURCES} from '../public/vin-sources.js';
import {lookupVehicleImage} from './vehicle-images.js';

export function createApp(databasePath,{decodeVehicle=decodeVinWithSources,findVehicleImage=lookupVehicleImage}={}) {
  const store = openStore(databasePath);
  const service = JSON.parse(readFileSync(new URL('../config/service.json', import.meta.url), 'utf8'));
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.post('/api/vehicle/image',async(req,res)=>{
    try{res.json(await findVehicleImage(req.body));}catch{res.json({found:false,reason:'unavailable'});}
  });
  app.get('/api/vin/sources',(req,res)=>res.json(availableVinSources()));
  app.post('/api/vin/decode',async (req,res)=>{
    res.setHeader('Cache-Control','no-store');
    try{res.json(await decodeVehicle(req.body?.vin,store.vehicles()));}catch(error){res.status(error.status || 500).json({error:error.status===400?error.message:'Не удалось определить автомобиль по VIN. Повторите попытку или заполните данные вручную.'});}
  });
  const publicVisit = visit => ({ ...visit, diagnosticPdf: visit.diagnosticPdf ? { name: visit.diagnosticPdf.name, size: visit.diagnosticPdf.size, analysis:visit.diagnosticPdf.analysis || null } : null });
  app.post('/api/diagnostic/parse',async (req,res)=>{
    if(typeof req.body?.text!=='string' || req.body.text.length>500000)return res.status(400).json({error:'Некорректный текст диагностики'});
    try{res.json({faults:await interpretDiagnostic(req.body.text),formatVersion:3});}catch(error){res.status(422).json({error:error.message});}
  });
  app.post('/api/diagnostic/analyze',async (req,res) => {
    const data=req.body?.data;
    if(typeof data!=='string' || data.length>14*1024*1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length%4!==0) return res.status(400).json({error:'Некорректный PDF диагностики'});
    const bytes=Buffer.from(data,'base64');
    if(bytes.length>10*1024*1024 || bytes.subarray(0,5).toString()!=='%PDF-')return res.status(400).json({error:'Выберите PDF не больше 10 МБ'});
    try {res.json(await analyzePdf(data));}catch(error){res.status(error.status || 422).json({error:error.message});}
  });
  app.post('/api/visits/:id/analyze',async (req,res) => {
    const visit=store.get(req.params.id);
    if(!visit?.diagnosticPdf)return res.status(404).json({error:'PDF диагностики не найден'});
    try {
      const analysis=await analyzePdf(visit.diagnosticPdf.data);
      // Read again after OCR so a concurrent save is never overwritten.
      const current=store.get(req.params.id);
      if(current?.diagnosticPdf?.data!==visit.diagnosticPdf.data)return res.status(409).json({error:'PDF был заменён. Откройте посещение заново.'});
      current.diagnosticPdf.analysis=analysis;store.save(current);res.json(analysis);
    }catch(error){res.status(error.status || 422).json({error:error.message});}
  });
  app.get('/api/service', (req,res) => res.json(service));
  app.get('/api/visits', (req,res) => res.json(store.list().map(publicVisit)));
  app.get('/api/visits/:id/diagnostic-pdf', (req,res) => {
    const file = store.get(req.params.id)?.diagnosticPdf;
    if (!file) return res.status(404).json({ error: 'PDF диагностики не найден' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="diagnostic.pdf"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(file.data, 'base64'));
  });
  app.get('/api/visits/:id/pdf', (req,res,next) => {
    const visit = store.get(req.params.id);
    if (!visit) return res.status(404).json({ error: 'Посещение не найдено' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="BMSPORT-${visit.date}-${visit.id}.pdf"`);
    try { createReport(visit, service, res); } catch (error) { next(error); }
  });
  const save = async (req,res) => {
    const source = req.body;
    const string = (value,max=200) => typeof value === 'string' ? value.trim().slice(0,max) : '';
    if (!source || !string(source.client) || !string(source.vehicle) || !/^\d{4}-\d{2}-\d{2}$/.test(source.date || '') || Number.isNaN(Date.parse(source.date))) return res.status(400).json({ error: 'Укажите клиента, автомобиль и дату' });
    if (!Array.isArray(source.issues) || source.issues.length > 100 || source.issues.some(item => !item || !string(item.description) || !['fixed','remaining','observed'].includes(item.status))) return res.status(400).json({ error: 'Проверьте описание и статус ошибок (максимум 100)' });
    const existing = req.params.id ? store.get(req.params.id) : null;
    if (req.params.id && !existing) return res.status(404).json({ error: 'Посещение не найдено' });
    let diagnosticPdf = existing?.diagnosticPdf || null;
    if (Object.hasOwn(source, 'diagnosticPdf')) {
      diagnosticPdf = source.diagnosticPdf;
      if (diagnosticPdf !== null) {
        if (!diagnosticPdf || typeof diagnosticPdf.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(diagnosticPdf.data) || diagnosticPdf.data.length % 4 !== 0) return res.status(400).json({ error: 'Некорректный PDF диагностики' });
        const bytes = Buffer.from(diagnosticPdf.data, 'base64');
        if (bytes.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'PDF диагностики должен быть не больше 10 МБ' });
        if (bytes.subarray(0,5).toString() !== '%PDF-') return res.status(400).json({ error: 'Выберите файл в формате PDF' });
        const analysisSource=diagnosticPdf.analysis;
        let analysis=null;
        if(analysisSource && typeof analysisSource.text==='string') {
          if(analysisSource.text.length>500000)return res.status(400).json({error:'Слишком много распознанного текста'});
          const text=analysisSource.text.replace(/\u0000/g,'');
          analysis={text,faults:await interpretDiagnostic(text),formatVersion:3,pages:Number.isInteger(analysisSource.pages)?analysisSource.pages:0,ocrPages:Array.isArray(analysisSource.ocrPages)?analysisSource.ocrPages.filter(Number.isInteger):[],warnings:Array.isArray(analysisSource.warnings)?analysisSource.warnings.filter(x=>typeof x==='string').slice(0,40).map(x=>x.slice(0,300)):[]};
        }
        diagnosticPdf = { name: string(diagnosticPdf.name).replace(/[\r\n]/g, '') || 'diagnostic.pdf', size: bytes.length, data: diagnosticPdf.data, analysis };
      }
    }
    const visit = { id: existing?.id || randomUUID(), createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), client: string(source.client), vehicle: string(source.vehicle), date: source.date, plate: string(source.plate), vin: string(source.vin), mileage: string(source.mileage), notes: string(source.notes,10000), issues: source.issues.map(item => ({ code: string(item.code), description: string(item.description,5000), status: item.status, work: string(item.work,5000) })) };
    if(Object.hasOwn(source,'diagnosticText')) {
      if(!diagnosticPdf || typeof source.diagnosticText!=='string' || source.diagnosticText.length>500000)return res.status(400).json({error:'Некорректный текст диагностики'});
      const text=source.diagnosticText.replace(/\u0000/g,'');
      diagnosticPdf.analysis={...diagnosticPdf.analysis,text,faults:await interpretDiagnostic(text),formatVersion:3,reviewed:true};
    }
    visit.diagnosticPdf = diagnosticPdf;
    if(visit.diagnosticPdf?.analysis?.text && visit.diagnosticPdf.analysis.formatVersion!==3){
      visit.diagnosticPdf.analysis={...visit.diagnosticPdf.analysis,faults:await interpretDiagnostic(visit.diagnosticPdf.analysis.text),formatVersion:3};
    }
    visit.issues=await translateFaults(visit.issues);
    visit.brand = string(source.brand);
    visit.model = string(source.model);
    const sameVin=existing && normalizeVin(existing.vin)===normalizeVin(source.vin);
    visit.bodyStyle=string(source.bodyStyle ?? (sameVin?existing.bodyStyle:''));
    const year=string(source.modelYear ?? (sameVin?existing.modelYear:''));visit.modelYear=/^(?:19|20|21)\d{2}$/.test(year)?year:'';
    const vinSource=source.vinSource ?? (sameVin?existing.vinSource:'');visit.vinSource=Object.hasOwn(VIN_SOURCES,vinSource || '')?vinSource:'';
    visit.issues.forEach((item,index)=>{item.block=string(source.issues[index].block);});
    store.save(visit);
    res.status(existing ? 200 : 201).json(publicVisit(visit));
  };
  app.post('/api/visits', save);
  app.put('/api/visits/:id', save);
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
  app.use((error,req,res,next) => {
    if (res.headersSent) return next(error);
    if(error.message?.includes('перевод') || error.message?.includes('Перевод'))return res.status(422).json({error:error.message});
    if (error.status === 413) return res.status(413).json({ error: 'Файл слишком большой. Максимальный размер PDF — 10 МБ.' });
    res.status(error.status === 400 ? 400 : 500).json({ error: error.status === 400 ? 'Некорректные данные' : 'Не удалось выполнить операцию. Проверьте журнал сервера.' });
  });
  return { app, store };
}
