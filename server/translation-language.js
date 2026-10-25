import {detectAll} from 'tinyld';

// Translate terminology, never infer a fault description from its numeric code.
const terms=new Map([
  ['смесь слишком бедная','Fuel mixture too lean'],
  ['смесь слишком богатая','Fuel mixture too rich'],
  ['ошибка смеси','Fuel mixture fault'],
  ['электродвигатель гидравлического насоса','Hydraulic pump motor'],
  ['несоответствие положения коленвала','Crankshaft position correlation fault'],
  ['потеря связи с блоком двигателя','Lost communication with the engine control module'],
  ['контроль передаточного отношения','Gear ratio monitoring'],
  ['verbrennungsaussetzer erkannt','Misfire detected'],
  ['zündaussetzer erkannt','Misfire detected'],
  ['hydraulikpumpenmotor','Hydraulic pump motor'],
  ['e-box-lüfter, ansteuerung','E-box fan control'],
  ['e-box-lufter, ansteuerung','E-box fan control'],
  ['e-box-luefter, ansteuerung','E-box fan control'],
  ['e-box-lofter, ansteuerung','E-box fan control']
]);
export const knownTranslation=text=>terms.get(text.toLocaleLowerCase().trim().replace(/[.!։]+$/,''));
export function sourceLanguage(text){
  if(/[А-Яа-яЁё]/.test(text))return 'ru';
  const detected=detectAll(text)[0];
  if(detected?.lang==='de' && detected.accuracy>=0.2 || /fehler|stromkreis|unterbrechung|unplausibel|spannung|steuerger[aä]t|verbrennung|z[uü]ndaussetzer|hydraulik|kurzschluss/i.test(text))return 'de';
  if(detected && detected.accuracy>=0.7 && detected.lang!=='en')return detected.lang;
  // Short English technical phrases are often misidentified as unrelated languages.
  if(/\b(crankshaft|camshaft|hydraulic|circuit|malfunction|communication|control|pressure|voltage|sensor|pump|mixture|cylinder|misfire|correlation|intake|exhaust|temperature|engine|fuel|position|transmission|valve|actuator|battery|fault|error|invalid|supply|module|missing|incorrect|internal|relay|ground|plausibility|wheel|speed|brake|steering|coolant|detected)\b/i.test(text))return 'en';
  return detected && detected.accuracy>=0.2 ? detected.lang : /^[\x00-\x7f]*$/.test(text) ? 'en' : 'mul';
}
