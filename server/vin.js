import {readFileSync} from 'node:fs';
import {bmwBodies} from '../public/bmw-bodies.js';

const catalog=JSON.parse(readFileSync(new URL('../assets/vin/bmw-production-codes.json',import.meta.url),'utf8')).results;
const mercedesTypes=JSON.parse(readFileSync(new URL('../assets/vin/mercedes-types.json',import.meta.url),'utf8'));
const byCode=new Map();
for(const row of catalog){if(!byCode.has(row.code))byCode.set(row.code,[]);byCode.get(row.code).push(row);}
const makes={WBA:'BMW',WBS:'BMW',WBY:'BMW',WBX:'BMW','4US':'BMW','5UX':'BMW','5UM':'BMW','5YM':'BMW','3MW':'BMW',WMW:'MINI',WMZ:'MINI',SCA:'Rolls-Royce',WDB:'Mercedes-Benz',WDD:'Mercedes-Benz',W1K:'Mercedes-Benz',WDC:'Mercedes-Benz',W1N:'Mercedes-Benz'};
export function normalizeVin(value){return typeof value==='string'?value.replace(/\s/g,'').toUpperCase():'';}
export function validVin(value){return /^[A-HJ-NPR-Z0-9]{17}$/.test(value);}
export function decodeVin(value,history=[]){
  const vin=normalizeVin(value);
  if(!validVin(vin)){const error=new Error('Для определения автомобиля введите полный VIN: 17 букв и цифр, без I, O и Q.');error.status=400;throw error;}
  const brand=makes[vin.slice(0,3)] || '';
  const mercedes=brand==='Mercedes-Benz' && mercedesTypes[vin.slice(3,9)];
  if(mercedes){
    return {matched:true,source:'mercedes-archive',brand,series:mercedes.series,trim:mercedes.trim,chassis:mercedes.chassis,bodyStyle:mercedes.bodyStyle,model:`${mercedes.series} · ${mercedes.chassis}`,vehicle:`${brand} ${mercedes.trim} · ${mercedes.chassis}`,modelYear:'',message:`Определено: ${brand} ${mercedes.trim}, кузов ${mercedes.chassis}. Заводской тип подтверждён архивом Mercedes-Benz. Точный год выпуска по этой записи не определяется.`};
  }
  const matches=(byCode.get(vin.slice(3,7)) || []).filter(row=>row.brand===brand);
  if(matches.length===1){
    const row=matches[0],chassis=row.chassis.match(/^[A-Z]\d{2}/)?.[0] || row.chassis;
    const series=Object.entries(bmwBodies).find(([,codes])=>codes.includes(chassis))?.[0] || row.chassis_description.match(/BMW\s+(X\d|Z\d|i\d|iX)\b/i)?.[1] || '';
    const trim=row.model.replace(/(\d)I\b/g,'$1i').replace(/(\d)D\b/g,'$1d');
    return {matched:true,source:'local-catalog',brand,model:`${series || trim} · ${chassis}`,series,chassis,trim,bodyStyle:row.body,vehicle:`${brand} ${trim} · ${chassis}`,message:`Определено: ${brand} ${trim}, кузов ${chassis}. Проверьте данные перед сохранением.`};
  }
  const known=history.filter(item=>normalizeVin(item.vin)===vin && item.brand && item.model && item.vehicle);
  const configurations=new Set(known.map(item=>JSON.stringify([item.brand,item.model,item.vehicle])));
  if(configurations.size===1){
    const saved=known[0];return {matched:true,source:'visit-history',brand:saved.brand,model:saved.model,vehicle:saved.vehicle,bodyStyle:saved.bodyStyle || '',modelYear:saved.modelYear || '',chassis:saved.model.match(/\b[A-Z]\d{2}\b/)?.[0] || '',message:'Автомобиль найден в сохранённой истории посещений. Проверьте данные.'};
  }
  return {matched:false,source:'local-catalog',brand,model:'',chassis:'',message:brand?`Марка: ${brand}. Точного кода модели и кузова в локальной базе нет. Выберите их вручную.`:'VIN пока не найден в локальной базе. Выберите марку, модель и кузов вручную.'};
}
