import {readFileSync} from 'node:fs';
import {decodeVin,normalizeVin} from './vin.js';
import {VIN_SOURCES} from '../public/vin-sources.js';

const names=Object.keys(JSON.parse(readFileSync(new URL('../public/models.json',import.meta.url),'utf8')));
const key=value=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]/gu,'');
const string=value=>typeof value==='string'||typeof value==='number'?String(value).trim().slice(0,200):'';
const field=value=>/^(?:n\/a|not applicable|not available|null|undefined)$/i.test(string(value))?'':string(value);
const canonicalMake=value=>value ? names.find(name=>key(name)===key(value)) || string(value) : '';
const bodies={ 'sedan/saloon':'Седан',sedan:'Седан',coupe:'Купе',hatchback:'Хэтчбек', 'hatchback/liftback/notchback':'Хэтчбек', 'convertible/cabriolet':'Кабриолет',convertible:'Кабриолет', 'wagon':'Универсал', 'sport utility vehicle (suv)/multi-purpose vehicle (mpv)':'Внедорожник / кроссовер', 'sport utility vehicle [suv]/multipurpose vehicle [mpv]':'Внедорожник / кроссовер',pickup:'Пикап',minivan:'Минивэн',van:'Фургон'};
const bodyName=value=>bodies[field(value).toLowerCase()] || field(value);
export const ONLINE_VIN_PROVIDERS=[
  {id:'nhtsa',url:vin=>`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${vin}?format=json`,read:data=>{
    const row=data.Results?.[0] || {},codes=String(row.ErrorCode || '').split(',').map(c=>c.trim()).filter(Boolean);
    return {vin:row.VIN,brand:row.Make,model:row.Model,series:row.Series,trim:row.Trim,year:row.ModelYear,body:row.BodyClass,checkDigitInvalid:codes.includes('1'),unsafe:codes.some(c=>['2','3','4','7','8','11','12','14'].includes(c))};
  }},
  {id:'vinspecs',url:vin=>`https://vinspecs.org/api/decode?vin=${vin}`,read:data=>{
    const row=data.success===false?{}:data.data || {};return {vin:row.vin,brand:row.make,model:row.model,series:row.series,trim:row.trim,year:row.year,body:row.body_type,unsafe:String(row.error_code || '').split(',').some(c=>['2','3','4','7','8','11','12','14'].includes(c.trim()))};
  }},
  {id:'cleanvins',url:vin=>`https://npsltgwdjigigymthnee.supabase.co/functions/v1/public-api/v1/vin/${vin}`,read:data=>{
    const row=data.vehicle || {};return {vin:data.vin,brand:row.make,model:row.model,trim:row.trim,year:row.year,body:row.body_class};
  }},
  {id:'checkmyvin',url:()=> 'https://checkmyvin.net/api/decode',options:vin=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vin})}),read:data=>{
    const row=data.vehicle || {};return {vin:data.vin,brand:row.make,model:row.model,trim:row.trim,year:row.modelYear,body:row.bodyClass,checkDigitInvalid:data.checkDigitInvalid};
  }},
  {id:'carwhere',url:vin=>`https://www.carwhere.com/api/public/vin/${vin}`,read:data=>{
    const row=data.decoded || {};return {vin:data.vin,brand:row.make,model:row.model,trim:row.trim,year:row.year,body:row.bodyStyle};
  }}
];

function normalizeResult(raw,id,vin){
  if(raw.vin && normalizeVin(raw.vin)!==vin)raw={...raw,unsafe:true};
  const brand=canonicalMake(field(raw.brand)),model=field(raw.model),trim=field(raw.trim);
  const series=brand==='BMW' ? field(raw.series).match(/\b([1-8])\s*[- ]?series\b/i)?.[1] : '';
  const year=/^(?:19|20|21)\d{2}$/.test(field(raw.year))?field(raw.year):'';
  const modelName=series?`${series} серия`:model;
  const bodyStyle=bodyName(raw.body);
  const extra=trim && !model.toLowerCase().includes(trim.toLowerCase())?` ${trim}`:'';
  return {matched:Boolean(brand && model && !raw.unsafe),brand,model:modelName,chassis:'',bodyStyle,modelYear:year,vehicle:brand && model?`${brand} ${model}${extra}`:'',source:id,sourcesUsed:[id],warnings:raw.checkDigitInvalid?['Источник сообщает о несовпадении контрольной цифры VIN. Проверьте введённый номер.']:[],unsafe:Boolean(raw.unsafe)};
}

export function createVinDecoder({fetchImpl=globalThis.fetch,timeoutMs=4000,totalTimeoutMs=18000,now=Date.now,providers=ONLINE_VIN_PROVIDERS}={}){
  const cache=new Map(),inflight=new Map(),cooldowns=new Map();
  async function lookup(vin,local){
    const start=now(),attempts=[];let best=null;
    for(const provider of providers){
      if(now()-start>=totalTimeoutMs)break;
      if((cooldowns.get(provider.id)||0)>now()){attempts.push({id:provider.id,status:'rate-limited'});continue;}
      try{
        const response=await fetchImpl(provider.url(vin),{...provider.options?.(vin),signal:AbortSignal.timeout(Math.max(1,Math.min(timeoutMs,totalTimeoutMs-(now()-start)))),redirect:'error'});
        if(response.status===429){
          const retry=response.headers.get('retry-after');const seconds=Number(retry);const until=Number.isFinite(seconds)&&seconds>0?now()+Math.min(seconds,86400)*1000:Date.parse(retry || '') || now()+3600000;
          cooldowns.set(provider.id,until);attempts.push({id:provider.id,status:'rate-limited'});continue;
        }
        if(!response.ok){attempts.push({id:provider.id,status:response.status===404?'not-found':'unavailable'});continue;}
        if(Number(response.headers.get('content-length'))>2000000)throw new Error('Response too large');
        const candidate=normalizeResult(provider.read(await response.json()),provider.id,vin);
        if(local.brand && candidate.brand && key(local.brand)!==key(candidate.brand))candidate.unsafe=true;
        // A provider's failure to decode an EU VIN does not invalidate the VIN.
        // Skip unconfirmed data and continue with the remaining providers.
        if(candidate.unsafe){attempts.push({id:provider.id,status:'unconfirmed'});continue;}
        attempts.push({id:provider.id,status:candidate.matched?'found':candidate.brand?'partial':'not-found'});
        const score=value=>Number(value.matched)*20+Number(Boolean(value.brand))*2+Number(Boolean(value.model))*4+Number(Boolean(value.bodyStyle))*2+Number(Boolean(value.modelYear));
        if(!best || score(candidate)>score(best))best=candidate;
        if(best.matched && best.bodyStyle)break;
      }catch{attempts.push({id:provider.id,status:'unavailable'});}
    }
    let result;
    if(best?.matched){
      const missingBody=best.bodyStyle?` Тип кузова: ${best.bodyStyle}.`:' Тип кузова не указан источником.';
      result={...best,attempts,message:`Определено: ${best.vehicle}${best.modelYear?`, ${best.modelYear} г`:''}.${missingBody} Заводской код кузова (например, E90) источник не предоставил. Проверьте данные.`};
    }else{
      const unavailable=attempts.some(a=>['unavailable','rate-limited'].includes(a.status));
      result={...local,brand:local.brand || best?.brand || '',sourcesUsed:best?.brand?best.sourcesUsed:[],attempts,message:unavailable?'Онлайн-источники ответили неполно или временно недоступны. Это не означает, что VIN неверный. Можно повторить поиск или заполнить поля вручную.':'Бесплатные базы не смогли полностью расшифровать этот VIN. Это не означает, что номер неверный: европейские автомобили могут отсутствовать в американской базе NHTSA. Модель и кузов можно выбрать вручную.'};
    }
    if(result.warnings?.length)result.message+=` ${result.warnings.join(' ')}`;
    // Do not cache outages as a definitive absence of data.
    if(result.matched || !attempts.some(a=>['unavailable','rate-limited'].includes(a.status))){cache.set(vin,{value:result,expires:now()+(result.matched?86400000:600000)});while(cache.size>500)cache.delete(cache.keys().next().value);}
    return result;
  }
  return async function decode(value,history=[]){
    const local=decodeVin(value,history),vin=normalizeVin(value);
    if(local.matched)return {...local,bodyStyle:bodyName(local.bodyStyle),sourcesUsed:[local.source]};
    const cached=cache.get(vin);if(cached?.expires>now())return {...cached.value,cached:true};
    if(!inflight.has(vin))inflight.set(vin,lookup(vin,local).finally(()=>inflight.delete(vin)));
    return inflight.get(vin);
  };
}
export const decodeVinWithSources=createVinDecoder();
export const availableVinSources=()=>ONLINE_VIN_PROVIDERS.map(({id})=>({id,...VIN_SOURCES[id],free:true,requiresKey:false}));
