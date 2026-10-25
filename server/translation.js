import {Worker} from 'node:worker_threads';
let worker,sequence=0;
const pending=new Map(),cache=new Map();
function getWorker(){
  if(worker)return worker;
  worker=new Worker(new URL('./translation-worker.js',import.meta.url),{execArgv:[]});
  worker.on('message',message=>{
    const job=pending.get(message.id);if(!job)return;
    clearTimeout(job.timer);pending.delete(message.id);
    message.error?job.reject(new Error(message.error)):job.resolve(message.texts);
    if(!pending.size)worker?.unref();
  });
  const failed=()=>{for(const job of pending.values()){clearTimeout(job.timer);job.reject(new Error('Перевод остановлен. Повторите обработку.'));}pending.clear();worker=null;};
  worker.on('error',failed);worker.on('exit',failed);worker.unref();return worker;
}
async function translateTexts(texts){
  const missing=[...new Set(texts.filter(text=>!cache.has(text)))];
  if(missing.length){
    const results=await new Promise((resolve,reject)=>{
      const thread=getWorker(),id=++sequence;thread.ref();
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Перевод занял слишком много времени. Повторите обработку с меньшим числом ошибок.'));thread.terminate();},180000);
      pending.set(id,{resolve,reject,timer});thread.postMessage({id,texts:missing});
    });
    results.forEach((text,index)=>{if(!text?.trim())throw new Error('Не удалось получить перевод описания ошибки.');cache.set(missing[index],text.trim());});
    while(cache.size>2000)cache.delete(cache.keys().next().value);
  }
  return texts.map(text=>cache.get(text));
}
export async function translateFaults(faults){
  const real=faults.filter(f=>f.description);
  const translations=real.length?await translateTexts(real.map(f=>f.description)):[];
  let index=0;
  return faults.map(fault=>({...fault,originalDescription:fault.description,description:fault.description?translations[index++]:'Description not provided on the code line',language:'en'}));
}
