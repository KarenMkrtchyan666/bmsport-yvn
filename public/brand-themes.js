import {setupBrandIdentity} from './brand-identity.js';
const normalize=value=>(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
// Design palettes inspired by the marques; all backdrops remain dark and low-glare.
const palettes={
  neutral:{accent:'#c9bba1',one:'rgba(111,99,76,.12)',two:'rgba(59,65,75,.09)'},
  bmw:{accent:'#99bfff',one:'rgba(25,78,150,.34)',two:'rgba(119,32,61,.19)',three:'rgba(59,53,122,.18)'},
  mercedes:{accent:'#c5d2df',one:'rgba(135,150,164,.23)',two:'rgba(69,91,113,.18)'},
  audi:{accent:'#e5a4ac',one:'rgba(123,30,51,.29)',two:'rgba(96,107,124,.15)'},
  porsche:{accent:'#d7bb87',one:'rgba(130,94,44,.28)',two:'rgba(95,33,42,.14)'},
  toyota:{accent:'#efa0a6',one:'rgba(139,34,51,.30)',two:'rgba(58,66,81,.16)'},
  ford:{accent:'#99b8ec',one:'rgba(29,69,134,.32)',two:'rgba(40,80,112,.16)'},
  landrover:{accent:'#b0c5a6',one:'rgba(37,89,61,.29)',two:'rgba(108,93,61,.18)'},
  lexus:{accent:'#c4d6d5',one:'rgba(51,100,102,.23)',two:'rgba(92,85,67,.17)'},
  volkswagen:{accent:'#a6c5ef',one:'rgba(36,78,138,.31)',two:'rgba(65,107,132,.14)'},
  skoda:{accent:'#b6d0ba',one:'rgba(28,99,67,.29)',two:'rgba(68,84,73,.15)'},
  volvo:{accent:'#afc4e0',one:'rgba(37,67,110,.28)',two:'rgba(93,116,139,.15)'},
  mazda:{accent:'#e3acb5',one:'rgba(123,31,55,.30)',two:'rgba(87,78,95,.15)'},
  renault:{accent:'#dcc77c',one:'rgba(132,105,28,.25)',two:'rgba(77,80,70,.15)'},
  mini:{accent:'#c1ceb5',one:'rgba(38,83,62,.29)',two:'rgba(114,97,65,.14)'},
  rollsroyce:{accent:'#cebee3',one:'rgba(75,48,112,.30)',two:'rgba(102,93,115,.16)'},
  lamborghini:{accent:'#dece86',one:'rgba(133,110,30,.29)',two:'rgba(45,69,58,.15)'},
  ferrari:{accent:'#e1c279',one:'rgba(148,30,43,.31)',two:'rgba(112,78,28,.15)'},
  bentley:{accent:'#c7c59d',one:'rgba(25,81,65,.31)',two:'rgba(110,100,62,.16)'}
};
const families={bmw:['BMW','Alpina','БМВ'],mercedes:['Mercedes-Benz','Mercedes','Maybach','Мерседес'],audi:['Audi','Cupra','SEAT'],porsche:['Porsche'],toyota:['Toyota','Honda','Acura','Kia','Tesla','BYD','Chery','EXEED','Omoda','Jaecoo','Nissan','Dodge','Mitsubishi'],ford:['Ford','Hyundai','Subaru','Peugeot','GAC','Changan','JAC','Suzuki'],landrover:['Land Rover','Range Rover','Jaguar'],lexus:['Lexus','Infiniti','Genesis'],volkswagen:['Volkswagen','VW','Bugatti'],skoda:['Škoda','Skoda'],volvo:['Volvo','Polestar','Geely','Zeekr'],mazda:['Mazda','Maserati','Aston Martin'],renault:['Renault','Dacia','Chevrolet','Opel'],mini:['MINI'],rollsroyce:['Rolls-Royce'],lamborghini:['Lamborghini','Lotus'],ferrari:['Ferrari','Alfa Romeo','Abarth','Fiat'],bentley:['Bentley']};
const lookup=new Map(Object.entries(families).flatMap(([id,names])=>names.map(name=>[normalize(name),id])));
export function brandPalette(brand){const id=lookup.get(normalize(brand)) || 'neutral';return {id,...palettes[id]};}
export function setupBrandTheme(){
  const identity=setupBrandIdentity();
  const layers=[0,1].map(()=>{const layer=document.createElement('div');layer.className='brand-ambient-layer';layer.setAttribute('aria-hidden','true');document.body.prepend(layer);return layer;});
  const label=document.querySelector('.header-label'),initialLabel=label?.textContent || '';
  let current='',active=0;
  function apply(brand){
    identity.apply(brand);
    const theme=brandPalette(brand);
    if(label)label.textContent=brand?.trim()?`${brand.trim()} · BMSPORT YVN`:initialLabel;
    if(theme.id===current)return;
    current=theme.id;document.documentElement.dataset.brand=theme.id;
    for(const [key,value] of Object.entries({accent:theme.accent,selection:theme.accent+'18',line:theme.accent+'55',glow:theme.accent+'24'}))document.documentElement.style.setProperty(`--brand-${key}`,value);
    const next=1-active;
    layers[next].style.background=`radial-gradient(ellipse at 12% 5%,${theme.one},transparent 60%),radial-gradient(ellipse at 95% 20%,${theme.two},transparent 64%),radial-gradient(ellipse at 50% 100%,${theme.three || 'rgba(30,34,42,.18)'},transparent 65%),linear-gradient(150deg,#13171c,#17191c 48%,#121519)`;
    layers[next].style.opacity='1';layers[active].style.opacity='0';active=next;
  }
  apply('');return {apply};
}
