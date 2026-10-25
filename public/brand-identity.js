const normalize=value=>(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
// Brand campaign lines vary by market; source links are in docs/BRAND-ASSETS.md.
const slogans={bmw:'Sheer Driving Pleasure',mercedesbenz:'The best or nothing',audi:'Vorsprung durch Technik',porsche:'There is no substitute',toyota:"Let’s Go Places",ford:'Built Ford Proud',lexus:'Experience Amazing'};
export function setupBrandIdentity(){
 const root=document.createElement('div');root.className='marque-identity';root.hidden=true;root.setAttribute('aria-live','polite');
 const image=document.createElement('img');image.alt='';image.hidden=true;
 const copy=document.createElement('div'),name=document.createElement('strong'),slogan=document.createElement('span');copy.append(name,slogan);root.append(image,copy);
 document.querySelector('.vehicle-photo-info').prepend(root);
 let catalog={},current='',requested='';
 function apply(brand){
  requested=brand;const key=normalize(brand),entry=catalog[key];
  if(key===current)return;
  current=key;root.getAnimations().forEach(animation=>animation.cancel());
  if(!entry){root.hidden=true;image.removeAttribute('src');return;}
  root.hidden=false;name.textContent=entry.name;slogan.textContent=slogans[key]||'';slogan.hidden=!slogans[key];image.hidden=true;
  image.onload=()=>{image.hidden=false;};image.onerror=()=>{image.hidden=true;};image.src=entry.logo;
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)root.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:650,easing:'ease-out'});
 }
 fetch('/brand-logos.json').then(r=>{if(!r.ok)throw Error('logos');return r.json();}).then(data=>{catalog=data;current='';apply(requested);}).catch(()=>{});
 return {apply};
}
