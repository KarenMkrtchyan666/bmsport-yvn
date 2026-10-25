export function setupVehiclePhoto({root,api}){
  const img=root.querySelector('.vehicle-photo-media img'),placeholder=root.querySelector('[data-photo-placeholder]'),status=root.querySelector('[data-photo-status]'),title=root.querySelector('[data-photo-title]'),specs=root.querySelector('[data-photo-specs]'),credit=root.querySelector('[data-photo-credit]'),caption=root.querySelector('[data-photo-caption]'),retry=root.querySelector('button');
  let sequence=0,controller=null,current=null;
  function clear(){sequence++;controller?.abort();controller=null;current=null;root.hidden=true;img.removeAttribute('src');img.hidden=true;credit.replaceChildren();}
  function unavailable(message,canRetry=false){img.hidden=true;placeholder.hidden=false;status.textContent=message;retry.hidden=!canRetry;}
  async function show(vehicle){
    clear();if(!vehicle?.brand || !vehicle?.model)return;
    current={...vehicle};root.hidden=false;
    title.textContent=vehicle.vehicle || `${vehicle.brand} ${vehicle.model}`;
    specs.textContent=[vehicle.bodyStyle,vehicle.modelYear?`${vehicle.modelYear} г.`:''].filter(Boolean).join(' · ');
    caption.textContent='Справочное фото модели. Цвет и комплектация могут отличаться.';
    unavailable('Подбираем фотографию…');root.setAttribute('aria-busy','true');
    const id=sequence;controller=new AbortController();
    try{
      const data=await api('/api/vehicle/image',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({brand:vehicle.brand,model:vehicle.model,chassis:vehicle.chassis || '',modelYear:vehicle.modelYear || ''})});
      if(id!==sequence)return;
      if(!data.found){unavailable(data.reason==='unavailable'?'Фотографии временно недоступны. Данные автомобиля определены.':'Подходящее фото модели пока не найдено.',data.reason==='unavailable');return;}
      img.alt=`Фото модели ${data.title}`;img.referrerPolicy='no-referrer';img.hidden=true;
      img.onload=()=>{if(id!==sequence)return;img.hidden=false;placeholder.hidden=true;root.setAttribute('aria-busy','false');};
      img.onerror=()=>{if(id!==sequence)return;unavailable('Не удалось загрузить фотографию.',true);root.setAttribute('aria-busy','false');};
      const link=document.createElement('a');link.href=data.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent=data.attribution;credit.append(link);
      if(data.match==='model')caption.textContent='Справочное фото модели. Поколение, цвет и комплектация могут отличаться.';
      img.src=data.url;
    }catch(error){if(id===sequence && error.name!=='AbortError')unavailable('Фотографии временно недоступны.',true);}
    finally{if(id===sequence)root.setAttribute('aria-busy','false');}
  }
  retry.onclick=()=>{if(current)show(current);};
  return {show,clear};
}
