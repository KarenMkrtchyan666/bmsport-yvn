const clean=(value,max=100)=>typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,max):'';
const plain=(value,max=2000)=>clean(value,max).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&');
const bodyCode=value=>clean(value).match(/\b(?:[EFGUR]\d{2}|[WSCAV]\d{3}|RR\d{1,2})\b/i)?.[0].toUpperCase() || '';
const includesCode=(title,code)=>new RegExp(`\\b${code}\\b`,'i').test(title);
function imageUrl(value){
  try{const url=new URL(value);return url.protocol==='https:' && !url.username && !url.password && ['cdn.trustcar.info','carapi.trustcar.info','upload.wikimedia.org'].includes(url.hostname)?url.href:'';}catch{return '';}
}
export function imageQuery(vehicle){
  const brand=clean(vehicle?.brand),model=clean(vehicle?.model);
  if(!brand || !model || /\b[A-HJ-NPR-Z0-9]{17}\b/i.test(`${brand} ${model}`))return null;
  const chassis=bodyCode(vehicle.chassis) || bodyCode(model);
  const series=model.match(/^([1-8])\s*(?:серия|Series)/i)?.[1];
  const base=model.split(' · ')[0].replace(/^([1-8])\s*серия$/i,'$1 Series');
  const models=chassis ? brand.toUpperCase()==='BMW' && series?[`${series} Series (${chassis})`,chassis]:[chassis]:[base];
  const year=/^(?:19|20|21)\d{2}$/.test(clean(vehicle.modelYear))?clean(vehicle.modelYear):'';
  return {brand,models,chassis,year,key:JSON.stringify([brand.toLowerCase(),models,year])};
}
export function createVehicleImageLookup({fetchImpl=globalThis.fetch,timeoutMs=6500,now=Date.now}={}){
  const cache=new Map(),inflight=new Map();
  async function lookup(query){
    let unavailable=false;
    for(const model of query.models){
      try{
        const url=new URL('https://carapi.trustcar.info/getImage');url.search=new URLSearchParams({make:query.brand,model,format:'json',...(query.year&&!query.chassis?{year:query.year}:{})});
        const response=await fetchImpl(url,{signal:AbortSignal.timeout(timeoutMs),redirect:'error'});
        if(response.status===404)continue;
        if(!response.ok){unavailable=true;continue;}
        const data=await response.json(),src=imageUrl(data.image_url),title=plain(data.title,200);
        if(!data.found || !src || !title || !plain(data.license))continue;
        // A broad model match must never masquerade as a confirmed chassis photo.
        if(query.chassis && !includesCode(title,query.chassis))continue;
        const result={found:true,url:src,title,author:plain(data.author),license:plain(data.license),attribution:plain(data.attribution) || `${title} / ${plain(data.author)} / ${plain(data.license)}`,sourceUrl:/^Q\d+$/.test(data.reference || '')?`https://www.wikidata.org/wiki/${data.reference}`:'https://carapi.trustcar.info/',match:query.chassis?'chassis':'model',chassis:query.chassis};
        cache.set(query.key,{value:result,until:now()+86400000});return result;
      }catch{unavailable=true;}
    }
    const result={found:false,reason:unavailable?'unavailable':'not-found'};
    if(!unavailable)cache.set(query.key,{value:result,until:now()+3600000});
    return result;
  }
  return async vehicle=>{
    const query=imageQuery(vehicle);if(!query)return {found:false,reason:'model-required'};
    const cached=cache.get(query.key);if(cached?.until>now())return cached.value;
    if(!inflight.has(query.key))inflight.set(query.key,lookup(query).finally(()=>{inflight.delete(query.key);while(cache.size>500)cache.delete(cache.keys().next().value);}));
    return inflight.get(query.key);
  };
}
export const lookupVehicleImage=createVehicleImageLookup();
