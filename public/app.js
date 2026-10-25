import {setupLanguage,t} from './i18n.js';
setupLanguage();
const $ = selector => document.querySelector(selector);
const form = $('#form');
let visits = [], currentId = null, dirty = false, busy = false;
let diagnosticPdf = null, diagnosticChanged = false;
let diagnosticObjectUrl = null;
let diagnosticText = null;
async function recognizeDiagnostic() {
  message('Распознаём PDF и переводим описания ошибок на английский…');
  const analysis = diagnosticPdf.data
    ? await api('/api/diagnostic/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:diagnosticPdf.data})})
    : await api(`/api/visits/${currentId}/analyze`,{method:'POST'});
  diagnosticPdf.analysis=analysis;
  diagnosticText=null;
  if (!diagnosticChanged) {
    const visit=visits.find(v=>v.id===currentId); if(visit?.diagnosticPdf)visit.diagnosticPdf.analysis=analysis;
  }
  renderDiagnostic();
  message(`PDF распознан. Найдено кодов: ${analysis.faults.length}. Описания переведены на английский. Проверьте результат по оригиналу.${diagnosticChanged ? ' Сохраните посещение.' : ''}`);
}
function renderDiagnostic() {
  if(diagnosticObjectUrl){URL.revokeObjectURL(diagnosticObjectUrl);diagnosticObjectUrl=null;}
  const info = $('#diagnostic-info'); info.replaceChildren();
  $('#remove-diagnostic').hidden = !diagnosticPdf;
  if (!diagnosticPdf) { info.textContent = 'Файл не прикреплён'; return; }
  const name = document.createElement('p'); name.textContent = `${diagnosticPdf.name} · ${(diagnosticPdf.size / 1024 / 1024).toFixed(2)} МБ`;
  info.append(name);
  const link=document.createElement('a');
  if(diagnosticPdf.data){const bytes=Uint8Array.from(atob(diagnosticPdf.data),c=>c.charCodeAt(0));diagnosticObjectUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));link.href=diagnosticObjectUrl;}
  else link.href=`/api/visits/${currentId}/diagnostic-pdf`;
  link.target='_blank';link.rel='noopener';link.textContent='Открыть PDF диагностики';info.append(link);
  const recognize=document.createElement('button');recognize.type='button';recognize.textContent='Распознать PDF';recognize.onclick=()=>operation(recognizeDiagnostic);info.append(recognize);
  const analysis=diagnosticPdf.analysis;
  if(!analysis){const hint=document.createElement('p');hint.textContent='Текст ещё не распознан. Нажмите «Распознать PDF». Оригинал можно сохранить отдельно.';info.append(hint);return;}
  const summary=document.createElement('p');summary.textContent=`Страниц: ${analysis.pages}. Найдено кодов: ${analysis.faults.length}.${analysis.ocrPages?.length ? ' Использовано OCR.' : ''} Проверьте распознавание по оригиналу.`;info.append(summary);
  for(const warning of analysis.warnings || []){const p=document.createElement('p');p.className='error';p.textContent=warning;info.append(p);}
  if(analysis.faults.length){
    const wrapper=document.createElement('div');wrapper.className='diagnostic-table';
    const table=document.createElement('table');const head=document.createElement('tr');
    for(const label of ['Блок','Код','Описание (English)','Стр.']){const th=document.createElement('th');th.textContent=label;head.append(th);}const thead=document.createElement('thead');thead.append(head);table.append(thead);
    const body=document.createElement('tbody');
    for(const fault of analysis.faults){const row=document.createElement('tr');for(const value of [fault.block,fault.code,fault.description,fault.page]){const td=document.createElement('td');td.textContent=value;row.append(td);}body.append(row);}table.append(body);wrapper.append(table);info.append(wrapper);
    const transfer=document.createElement('button');transfer.type='button';transfer.textContent='Добавить найденные коды в ошибки';transfer.onclick=()=>{
      const existing=new Set([...$('#issues').children].map(row=>`${row.querySelector('[data-field="block"]').value}|${row.querySelector('[data-field="code"]').value.toUpperCase()}`));let count=0;
      for(const fault of analysis.faults){const key=`${fault.block}|${fault.code}`;if(existing.has(key))continue;if($('#issues').children.length>=100)break;existing.add(key);addIssue({block:fault.block,code:fault.code,description:fault.description,status:'observed'});count++;}
      if(count){markDirty();workspaceUi.activate('diagnostics');}message(`Добавлено ошибок: ${count}. Статус: «Требует проверки». Проверьте записи и сохраните посещение.`);
    };info.append(transfer);
  } else {const p=document.createElement('p');p.textContent='Коды автоматически не выделены. Просмотрите полный текст диагностики.';info.append(p);}
  const details=document.createElement('details');details.open=false;const title=document.createElement('summary');title.textContent='Исходный текст PDF — для проверки и исправлений';
  const label=document.createElement('label');label.textContent='Проверить и исправить распознанный текст';
  const editor=document.createElement('textarea');editor.className='diagnostic-text';editor.rows=10;editor.maxLength=500000;editor.value=diagnosticText ?? analysis.text;
  editor.oninput=()=>{diagnosticText=editor.value;markDirty();message('Текст изменён. Обновите коды по тексту и сохраните посещение.');};label.append(editor);
  const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Обновить коды по тексту';refresh.onclick=()=>operation(async()=>{
    const text=editor.value,result=await api('/api/diagnostic/parse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
    diagnosticPdf.analysis={...analysis,text,faults:result.faults,formatVersion:3,reviewed:true};diagnosticText=text;markDirty();renderDiagnostic();message('Коды обновлены, описания переведены на английский. Сохраните посещение. Уже добавленные ошибки можно изменить вручную.');
  });details.append(title,label,refresh);info.append(details);
}
const fields = ['client','date','brand','model','vehicle','plate','vin','mileage','notes','bodyStyle','modelYear','vinSource'];
import { setupBrandPicker } from './brands.js';
import { bmwBodies } from './bmw-bodies.js';
import {setupVinInput} from './vin-input.js';
import {setupVehiclePhoto} from './vehicle-photo.js';
import {setupWorkspaceUI} from './workspace-ui.js';
import {setupBrandTheme} from './brand-themes.js';
const brandTheme=setupBrandTheme();
const vehiclePhoto=setupVehiclePhoto({root:$('#vehicle-preview'),api});
const workspaceUi=setupWorkspaceUI({form,getContext:()=>({visits,currentId,vin:form.elements.vin.value}),onOpen:visit=>load(visit)});
let modelCatalog = {}, previousBrand = '', automaticVehicle = '';
let modelSeries = null;
const isBMW = () => $('#brand').value.trim().toUpperCase() === 'BMW';
function resetModelSeries() { modelSeries = null; $('#model').placeholder = 'Выберите или введите модель'; }
function clearVinSource(){clearTimeout(manualPhotoTimer);form.elements.vinSource.value='';$('#vin-sources').replaceChildren();vehiclePhoto.clear();}
const closeModels = setupBrandPicker($('#model'), $('#model-options'), name => {
  clearVinSource();
  if (isBMW() && bmwBodies[name]) {
    modelSeries = name; $('#model').value = ''; $('#model').placeholder = `${name} — выберите кузов`;
    updateVehicle(); markDirty(); return false;
  }
  updateVehicle(); markDirty(); scheduleManualPhoto(0);
}, () => {
  if (isBMW() && modelSeries) return bmwBodies[modelSeries].map(code => `${modelSeries} · ${code}`);
  const key = Object.keys(modelCatalog).find(key => key.toLocaleLowerCase() === $('#brand').value.trim().toLocaleLowerCase());
  return modelCatalog[key] || [];
}, 'Модель не найдена в каталоге. Можно указать свою.', {
  header: () => modelSeries,
  back: () => { resetModelSeries(); $('#model').value = ''; updateVehicle(); markDirty(); },
  hasChildren: name => isBMW() && Boolean(bmwBodies[name]),
  searchTerms: name => name.includes(' · ') ? [name.split(' · ')[1]] : []
});
function updateVehicle() {
  const value = [$('#brand').value.trim(), $('#model').value.trim()].filter(Boolean).join(' ');
  if (!form.elements.vehicle.value || form.elements.vehicle.value === automaticVehicle) {
    form.elements.vehicle.value = $('#model').value.trim() ? value : ''; automaticVehicle = form.elements.vehicle.value;
  }
}
function updateBrand() {
  if (previousBrand !== $('#brand').value.trim()) { resetModelSeries(); $('#model').value = ''; closeModels(); updateVehicle(); }
  previousBrand = $('#brand').value.trim();
  $('#model-picker').hidden = !previousBrand;
}
const closeBrands = setupBrandPicker($('#brand'), $('#brand-options'), () => { clearVinSource(); updateBrand(); markDirty(); });
$('#brand').addEventListener('input', updateBrand);
$('#model').addEventListener('input', updateVehicle);
for(const key of ['brand','model','vehicle','bodyStyle','modelYear'])form.elements[key].addEventListener('input',clearVinSource);
let manualPhotoTimer;
function scheduleManualPhoto(delay=600){
  clearTimeout(manualPhotoTimer);
  manualPhotoTimer=setTimeout(()=>{
    const brand=form.elements.brand.value.trim(),model=form.elements.model.value.trim();
    if(!brand || !model)return;
    vehiclePhoto.show({brand,model,vehicle:`${brand} ${model}`,chassis:model.split(' · ')[1] || '',bodyStyle:form.elements.bodyStyle.value,modelYear:form.elements.modelYear.value});
  },delay);
}
for(const key of ['brand','model','bodyStyle','modelYear'])form.elements[key].addEventListener('input',()=>scheduleManualPhoto());
const vinInput=setupVinInput({input:form.elements.vin,status:$('#vin-status'),button:$('#decode-vin'),sources:$('#vin-sources'),getSource:()=>form.elements.vinSource.value,api,isBusy:()=>busy,
  onVinChange:()=>{clearTimeout(manualPhotoTimer);vehiclePhoto.clear();},
  getVehicleState:()=>[form.elements.brand.value,form.elements.model.value,form.elements.vehicle.value,form.elements.bodyStyle.value,form.elements.modelYear.value],
  clearVehicle:()=>{vehiclePhoto.clear();for(const key of ['brand','model','vehicle','bodyStyle','modelYear','vinSource'])form.elements[key].value='';$('#vin-details').hidden=true;previousBrand='';automaticVehicle='';resetModelSeries();closeBrands();closeModels();$('#model-picker').hidden=true;markDirty();},
  apply:result=>{
    if(result.matched){
      form.elements.brand.value=result.brand;form.elements.model.value=result.model;form.elements.vehicle.value=result.vehicle;
      form.elements.bodyStyle.value=result.bodyStyle || '';form.elements.modelYear.value=result.modelYear || '';form.elements.vinSource.value=result.source || '';
      $('#vin-details').hidden=!(result.bodyStyle || result.modelYear);
      previousBrand=result.brand;resetModelSeries();closeBrands();closeModels();$('#model-picker').hidden=false;
      const series=result.model.split(' · ')[0];if(isBMW() && bmwBodies[series])modelSeries=series;
      automaticVehicle=result.vehicle;markDirty();
      vehiclePhoto.show(result);
    }else if(result.brand && !form.elements.brand.value){form.elements.brand.value=result.brand;updateBrand();markDirty();}
  }
});
async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || 'Ошибка сервера'); }
  return response.json();
}
function message(text, error=false) { $('#message').textContent = text; $('#message').className = error ? 'error' : ''; }
function markDirty() { dirty = true; $('#state').textContent = 'Есть несохранённые изменения'; brandTheme.apply(form.elements.brand.value); workspaceUi.update(); }
function addIssue(item={}) {
  const fragment = $('#issue-template').content.cloneNode(true);
  const row = fragment.querySelector('fieldset');
  const blockLabel=document.createElement('label');blockLabel.textContent='Блок управления';
  const blockInput=document.createElement('input');blockInput.dataset.field='block';blockInput.maxLength=200;blockInput.placeholder='DME, DSC, EGS…';blockLabel.append(blockInput);row.querySelector('.issue-grid').after(blockLabel);
  row.querySelectorAll('[data-field]').forEach(input => { if (item[input.dataset.field] !== undefined) input.value = item[input.dataset.field]; });
  row.querySelector('[data-remove]').onclick = () => { row.remove(); markDirty(); };
  $('#issues').append(fragment);
}
function load(visit) {
  if (busy || (dirty && !confirm(t('Оставить несохранённые изменения и открыть другое посещение?')))) return;
  currentId = visit?.id || null;
  form.reset();
  closeBrands();
  diagnosticPdf = visit?.diagnosticPdf || null; diagnosticChanged = false; diagnosticText=null; renderDiagnostic();
  fields.forEach(key => form.elements[key].value = visit?.[key] || (key === 'date' ? new Date().toLocaleDateString('en-CA') : ''));
  brandTheme.apply(form.elements.brand.value);
  vinInput.reset();
  clearTimeout(manualPhotoTimer);vehiclePhoto.clear();if(visit?.brand && visit.model)vehiclePhoto.show(visit);
  $('#vin-details').hidden=!(form.elements.bodyStyle.value || form.elements.modelYear.value);
  previousBrand = $('#brand').value.trim(); $('#model-picker').hidden = !previousBrand; closeModels();
  resetModelSeries();
  if (isBMW() && bmwBodies[$('#model').value.split(' · ')[0]]) modelSeries = $('#model').value.split(' · ')[0];
  automaticVehicle = visit?.model && visit.vehicle === `${visit.brand} ${visit.model}` ? visit.vehicle : '';
  $('#issues').replaceChildren();
  (visit?.issues || []).forEach(addIssue);
  $('#title').textContent = visit ? visit.vehicle : 'Новое посещение';
  $('#state').textContent = visit ? 'Сохранено' : 'Не сохранено';
  dirty = false; message(''); renderList();
  workspaceUi.closeJournal();
  workspaceUi.activate('visit');workspaceUi.update();
  if(diagnosticPdf?.analysis?.text && diagnosticPdf.analysis.formatVersion!==3)operation(async()=>{
    message('Обновляем список ошибок и переводим описания на английский…');
    const analysis=diagnosticPdf.analysis;
    const result=await api('/api/diagnostic/parse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:analysis.text})});
    diagnosticPdf.analysis={...analysis,faults:result.faults,formatVersion:3};diagnosticText=analysis.text;markDirty();renderDiagnostic();message('Описания переведены на английский. Сохраните посещение, чтобы обновить отчёт.');
  });
}
let journalModel='';
try{journalModel=localStorage.getItem('bmsport-journal-model') || '';}catch{}
function journalModelLabel(visit){return visit.model?.trim()?[visit.brand?.trim(),visit.model.trim()].filter(Boolean).join(' '):visit.vehicle?.trim() || '';}
function journalModelKey(visit){return journalModelLabel(visit).normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase();}
function renderList() {
  const query = $('#search').value.toLocaleLowerCase();
  const container = $('#visits'); container.replaceChildren();
  const modelSelect=$('#journal-model'),models=new Map();
  for(const visit of visits){const key=journalModelKey(visit);if(key&&!models.has(key))models.set(key,journalModelLabel(visit));}
  if(visits.length && journalModel && !models.has(journalModel))journalModel='';
  const collator=new Intl.Collator(document.documentElement.lang,{numeric:true,sensitivity:'base'});
  modelSelect.replaceChildren();const all=document.createElement('option');all.value='';all.textContent='Все модели';modelSelect.append(all);
  for(const [key,label] of [...models].sort((a,b)=>collator.compare(a[1],b[1]))){const option=document.createElement('option');option.value=key;option.textContent=label;modelSelect.append(option);}
  modelSelect.value=journalModel;
  const matches=visits.filter(v => (!journalModel || journalModelKey(v)===journalModel) && [v.client,v.brand,v.model,v.vehicle,v.vin,v.plate].join(' ').toLocaleLowerCase().includes(query));
  matches.sort((a,b)=>b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  for (const visit of matches) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'visit' + (visit.id === currentId ? ' selected' : '');
    const title = document.createElement('strong'); title.textContent = visit.vehicle;
    const detail = document.createElement('span'); detail.textContent = `${visit.date} · ${visit.client}`;
    button.append(title,detail); button.onclick = () => load(visit); container.append(button);
  }
  if (!container.children.length) container.textContent = 'Посещений пока нет или ничего не найдено.';
  workspaceUi.update();
}
async function save() {
  await vinInput.flush();
  if (!workspaceUi.validate()) return null;
  const payload = Object.fromEntries(fields.map(key => [key,form.elements[key].value]));
  payload.issues = [...$('#issues').children].map(row => Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input => [input.dataset.field,input.value])));
  if (diagnosticChanged) payload.diagnosticPdf = diagnosticPdf;
  if (diagnosticText !== null && diagnosticPdf) payload.diagnosticText=diagnosticText;
  const visit = await api(currentId ? `/api/visits/${currentId}` : '/api/visits', { method: currentId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  currentId = visit.id; dirty = false;
  diagnosticPdf = visit.diagnosticPdf; diagnosticChanged = false; diagnosticText=null; $('#diagnostic-file').value = ''; renderDiagnostic();
  $('#issues').replaceChildren();visit.issues.forEach(addIssue);
  visits = [visit,...visits.filter(v => v.id !== visit.id)]; renderList();
  $('#state').textContent = 'Сохранено'; $('#title').textContent = visit.vehicle;
  workspaceUi.update();
  message('Посещение сохранено на этом компьютере.'); return visit;
}
async function operation(action) {
  if (busy) return;
  busy = true; const controls = [...form.querySelectorAll('input,textarea,select,button')]; controls.forEach(el => el.disabled = true);
  try { await action(); } catch (error) { message(error.message, true); }
  finally { busy = false; controls.forEach(el => el.disabled = false); }
}
form.addEventListener('input',markDirty);
$('#diagnostic-file').onchange = () => {
  const file = $('#diagnostic-file').files[0];
  if (!file) return;
  operation(async () => {
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('PDF диагностики должен быть не больше 10 МБ');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (new TextDecoder().decode(bytes.subarray(0,5)) !== '%PDF-') throw new Error('Выберите файл в формате PDF');
      const data = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = () => reject(new Error('Не удалось прочитать файл')); reader.readAsDataURL(file); });
      diagnosticPdf = { name: file.name, size: file.size, data }; diagnosticChanged = true; diagnosticText=null; markDirty(); renderDiagnostic();
      try { await recognizeDiagnostic(); }
      catch(error){message(`PDF выбран, но распознавание не завершено: ${error.message}. Можно повторить распознавание или сохранить оригинал.`,true);}
    } finally { $('#diagnostic-file').value = ''; }
  });
};
$('#remove-diagnostic').onclick = () => { diagnosticPdf = null; diagnosticText=null; diagnosticChanged = true; markDirty(); renderDiagnostic(); message('Сохраните посещение, чтобы убрать прикреплённый PDF.'); };
form.onsubmit = event => { event.preventDefault(); if(workspaceUi.validate()) operation(save); };
$('#add').onclick = () => { addIssue(); markDirty(); };
$('#new').onclick = () => load(null);
$('#search').oninput = renderList;
$('#journal-model').onchange=()=>{journalModel=$('#journal-model').value;try{localStorage.setItem('bmsport-journal-model',journalModel);}catch{}renderList();};
$('#pdf').onclick = () => {
  if (!workspaceUi.validate()) return;
  operation(async () => {
    const visit = await save(); if (!visit) return;
    const response = await fetch(`/api/visits/${visit.id}/pdf`);
    if (!response.ok) throw new Error('Не удалось сформировать PDF. Посещение сохранено.');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a'); link.href = url; link.download = `BMSPORT-${visit.date}.pdf`; link.click();
    setTimeout(() => URL.revokeObjectURL(url),30000); message('PDF сформирован и передан браузеру для скачивания.');
  });
};
window.addEventListener('beforeunload', event => { if(dirty) {event.preventDefault(); event.returnValue = '';} });
load(null);
try { const [service, saved, models] = await Promise.all([api('/api/service'),api('/api/visits'),api('/models.json')]); modelCatalog = models; $('#service').textContent = [service.city,service.instagram].filter(Boolean).join(' · '); visits = saved; renderList(); } catch (error) { message(`Не удалось загрузить данные: ${error.message}. Обновите страницу перед работой.`,true); form.querySelectorAll('button').forEach(el => el.disabled = true); }
