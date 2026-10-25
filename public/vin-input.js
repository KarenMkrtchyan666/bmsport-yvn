import {VIN_SOURCES} from './vin-sources.js';
const normalize=value=>value.replace(/\s/g,'').toUpperCase();
const valid=value=>/^[A-HJ-NPR-Z0-9]{17}$/.test(value);
export function setupVinInput({input,status,button,sources,getSource,api,getVehicleState,apply,clearVehicle,isBusy,onVinChange}){
  let timer=null,controller=null,requestId=0,pending=null,generated=null;
  function show(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
  function renderSources(ids){
    if(!sources)return;sources.replaceChildren();
    for(const id of [...new Set(ids)]){
      const source=VIN_SOURCES[id];if(!source)continue;
      const element=document.createElement(source.url?'a':'span');element.textContent=source.label;
      if(source.url){element.href=id==='carwhere'?`https://www.carwhere.com/vin/${normalize(input.value)}`:source.url;element.target='_blank';element.rel='noopener noreferrer';}
      sources.append(element);
    }
  }
  function reset(){
    clearTimeout(timer);timer=null;controller?.abort();controller=null;requestId++;pending=null;
    button.textContent='Определить по VIN';button.disabled=false;
    generated=valid(normalize(input.value))?{vin:normalize(input.value),state:JSON.stringify(getVehicleState())}:null;
    renderSources(getSource?.()?[getSource()]:[]);
    show(input.value?'VIN сохранён. Для повторной проверки нажмите «Определить по VIN».':'После ввода полного VIN автомобиль определяется автоматически. Доступность модели и кузова зависит от базы.');
  }
  function run(){
    clearTimeout(timer);timer=null;controller?.abort();
    const vin=normalize(input.value);input.value=vin;
    const id=++requestId;
    if(!valid(vin)){show('Для определения нужен полный VIN: 17 букв и цифр, без I, O и Q.',true);return Promise.resolve();}
    controller=new AbortController();
    const snapshot=JSON.stringify(getVehicleState());
    button.disabled=true;button.textContent='Определяем…';show('Определяем марку, модель и кузов. При необходимости проверяем бесплатные онлайн-источники…');
    pending=(async()=>{
      try{
        const result=await api('/api/vin/decode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vin}),signal:controller.signal});
        if(id!==requestId || normalize(input.value)!==vin)return;
        if(JSON.stringify(getVehicleState())!==snapshot){show('Автомобиль изменён вручную. Чтобы применить данные VIN, нажмите «Определить по VIN» ещё раз.');return;}
        apply(result);generated={vin,state:JSON.stringify(getVehicleState())};renderSources(result.sourcesUsed || []);show(result.message);
      }catch(error){if(id===requestId && error.name!=='AbortError')show(`Не удалось определить автомобиль: ${error.message}. Можно заполнить поля вручную.`,true);}
      finally{if(id===requestId){button.disabled=false;button.textContent='Определить по VIN';controller=null;}}
    })();
    return pending;
  }
  input.addEventListener('input',()=>{
    onVinChange?.();
    const vin=normalize(input.value);input.value=vin;
    if(generated && generated.vin!==vin){if(JSON.stringify(getVehicleState())===generated.state)clearVehicle();generated=null;}
    clearTimeout(timer);timer=null;controller?.abort();controller=null;requestId++;pending=null;
    renderSources([]);
    button.disabled=false;button.textContent='Определить по VIN';
    if(!vin){show('Введите полный VIN для автоматического определения автомобиля.');return;}
    if(!valid(vin)){show(vin.length===17?'VIN содержит недопустимые символы. Буквы I, O и Q не используются.':`Введено ${vin.length} из 17 символов.`,vin.length>=17);return;}
    show('VIN введён. Проверяем данные автомобиля…');timer=setTimeout(run,350);
  });
  button.onclick=()=>{if(!isBusy())run();};
  return {reset,flush:async()=>{if(timer)await run();else if(pending)await pending;}};
}
