const normalize=value=>(value || '').replace(/\s/g,'').toUpperCase();
export function setupWorkspaceUI({form,getContext,onOpen}){
  const sidebar=document.querySelector('main>aside'),mobile=matchMedia('(max-width:900px)');
  sidebar.id='service-journal';
  const sortLabel=document.createElement('label');sortLabel.className='journal-sort';sortLabel.textContent='Модель автомобиля';
  const sort=document.createElement('select');sort.id='journal-model';
  const allModels=document.createElement('option');allModels.value='';allModels.textContent='Все модели';sort.append(allModels);
  sortLabel.append(sort);sidebar.querySelector('.search-label').after(sortLabel);
  const journalButton=document.createElement('button');journalButton.type='button';journalButton.id='journal-toggle';journalButton.className='journal-toggle';journalButton.setAttribute('aria-controls',sidebar.id);journalButton.setAttribute('aria-expanded','false');
  const journalLabel=document.createElement('span');journalLabel.textContent='Журнал сервиса';const chevron=document.createElement('span');chevron.className='journal-chevron';chevron.textContent='⌄';chevron.setAttribute('aria-hidden','true');journalButton.append(journalLabel,chevron);sidebar.before(journalButton);
  function closeJournal(){journalButton.setAttribute('aria-expanded','false');sidebar.classList.remove('journal-open');}
  journalButton.onclick=()=>{const open=journalButton.getAttribute('aria-expanded')!=='true';journalButton.setAttribute('aria-expanded',String(open));sidebar.classList.toggle('journal-open',open);};
  sidebar.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobile.matches){closeJournal();journalButton.focus();}});
  mobile.addEventListener('change',()=>{if(sidebar.contains(document.activeElement)&&mobile.matches)journalButton.focus();closeJournal();});
  const tabs=[...document.querySelectorAll('[data-tab]')],panels=[...document.querySelectorAll('[role="tabpanel"]')];
  function activate(name,focus=false){
    for(const tab of tabs){const selected=tab.dataset.tab===name;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;if(selected&&focus)tab.focus();}
    for(const panel of panels)panel.hidden=panel.id!==`panel-${name}`;
    if(name==='history')renderHistory();
  }
  function renderHistory(){
    const {visits,vin,currentId}=getContext(),container=document.querySelector('#vehicle-history');container.replaceChildren();
    if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalize(vin))){empty(container,'История появится после ввода VIN','Введите полный VIN автомобиля, чтобы найти его сохранённые посещения.');return;}
    const matches=visits.filter(visit=>normalize(visit.vin)===normalize(vin)).sort((a,b)=>b.date.localeCompare(a.date));
    if(!matches.length){empty(container,'Первое посещение этого автомобиля','Сохраните отчёт — он появится здесь вместе со следующими визитами.');return;}
    for(const visit of matches){
      const button=document.createElement('button');button.type='button';button.className='history-card'+(visit.id===currentId?' current':'');
      const date=document.createElement('span');date.className='history-date';date.textContent=visit.date.split('-').reverse().join('.');
      const body=document.createElement('span');body.className='history-body';
      const title=document.createElement('strong');title.textContent=visit.vehicle;
      const detail=document.createElement('span');detail.textContent=`${visit.client} · Ошибок: ${visit.issues?.length || 0}${visit.id===currentId?' · Текущее посещение':''}`;
      body.append(title,detail);const arrow=document.createElement('span');arrow.className='history-arrow';arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');
      button.append(date,body,arrow);button.onclick=()=>onOpen(visit);container.append(button);
    }
  }
  function empty(container,title,description){const block=document.createElement('div');block.className='empty-state';const heading=document.createElement('h3');heading.textContent=title;const p=document.createElement('p');p.textContent=description;block.append(heading,p);container.append(block);}
  function update(){
    const count=document.querySelector('#issues').children.length;document.querySelector('#diagnostic-empty').hidden=count>0;document.querySelector('#diagnostic-count').textContent=count;
    document.querySelector('#visits-count').textContent=getContext().visits.length;
    const state=document.querySelector('#state');state.dataset.mode=['Сохранено','Saved'].includes(state.textContent)?'saved':'draft';
    if(!document.querySelector('#panel-history').hidden)renderHistory();
  }
  function revealField(field){const panel=field.closest('[role="tabpanel"]');if(panel)activate(panel.id.replace('panel-',''));}
  function validate(){const field=[...form.querySelectorAll('input,textarea,select')].find(field=>field.willValidate&&!field.validity.valid);if(!field)return true;revealField(field);field.reportValidity();return false;}
  for(const tab of tabs){
    tab.onclick=()=>activate(tab.dataset.tab);
    tab.onkeydown=event=>{const index=tabs.indexOf(tab);let target;if(event.key==='ArrowRight')target=(index+1)%tabs.length;else if(event.key==='ArrowLeft')target=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')target=0;else if(event.key==='End')target=tabs.length-1;else return;event.preventDefault();activate(tabs[target].dataset.tab,true);};
  }
  document.querySelector('[data-open-documents]').onclick=()=>{activate('documents');document.querySelector('#diagnostic-file').focus();};
  form.addEventListener('invalid',event=>revealField(event.target),true);
  activate('visit');return {activate,update,validate,closeJournal};
}
