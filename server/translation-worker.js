import {parentPort} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import {env,pipeline} from '@huggingface/transformers';
import {knownTranslation,sourceLanguage} from './translation-language.js';
env.allowRemoteModels=false;
env.localModelPath=fileURLToPath(new URL('../assets/translation/',import.meta.url)).replaceAll('\\','/');
env.useFSCache=false;
const translators=new Map();
let queue=Promise.resolve();
parentPort.on('message',job=>{
  queue=queue.then(async()=>{
    try{
      const groups=new Map(),results=[...job.texts];
      for(const [index,text] of job.texts.entries()){
        const known=knownTranslation(text);if(known){results[index]=known;continue;}
        const lang=sourceLanguage(text);
        if(lang==='en')continue;
        const model=lang==='ru'?'opus-mt-ru-en':lang==='de'?'opus-mt-de-en':'opus-mt-mul-en';
        if(!groups.has(model))groups.set(model,[]);groups.get(model).push({index,text});
      }
      for(const [model,items] of groups){
        if(!translators.has(model))translators.set(model,await pipeline('translation',model,{dtype:'q8',device:'cpu',local_files_only:true,session_options:{intraOpNumThreads:2,interOpNumThreads:1,logSeverityLevel:4}}));
        const result=await translators.get(model)(items.map(i=>i.text),{max_new_tokens:192,num_beams:4,batch_size:4,truncation:true});
        result.forEach((item,index)=>{results[items[index].index]=item.translation_text;});
      }
      parentPort.postMessage({id:job.id,texts:results});
    }catch{parentPort.postMessage({id:job.id,error:'Автоматический перевод недоступен. Повторите обработку после загрузки локальной модели перевода.'});}
  });
});
