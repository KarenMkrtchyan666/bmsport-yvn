const brands = [
  'Abarth','Acura','Alfa Romeo','Alpina','Alpine','Aston Martin','Audi','Aurus','Avatr',
  'BAIC','Bentley','BMW','Brilliance','Bugatti','Buick','BYD',
  'Cadillac','Changan','Chery','Chevrolet','Chrysler','Citroën','Cupra',
  'Dacia','Daewoo','Daihatsu','Datsun','Deepal','Denza','Dodge','Dongfeng','DS',
  'Evolute','EXEED','FAW','Ferrari','Fiat','Fisker','Ford','Forthing','Foton',
  'GAC','Geely','Genesis','GMC','Great Wall','Haval','HiPhi','Honda','Hongqi','Hummer','Hyundai',
  'IM Motors','Infiniti','Iran Khodro','Isuzu','IVECO','JAC','Jaecoo','Jaguar','Jeep','Jetour','Jetta',
  'Kaiyi','KGM','Kia','Lada','Lamborghini','Lancia','Land Rover','Leapmotor','Lexus','Li Auto','Lifan','Lincoln','Lotus','Lucid','Luxgen',
  'Lynk & Co','M-Hero','Maserati','Maybach','Mazda','McLaren','Mercedes-Benz','MG','MINI','Mitsubishi','Moskvich',
  'Neta','NIO','Nissan','Omoda','Opel','Ora','Peugeot','Polestar','Pontiac','Porsche','Proton',
  'RAM','Ravon','Renault','Rivian','Roewe','Rolls-Royce','Rover','Saab','SAIC','Saturn','Scion','SEAT','Seres',
  'Škoda','Skywell','Smart','Solaris','Soueast','SsangYong','Subaru','Suzuki','SWM',
  'Tank','Tata','Tesla','Toyota','UAZ','Venucia','Volkswagen','Volvo','Voyah','Wey','Wuling','XPeng','Zeekr','Zotye',
  'ВАЗ','ГАЗ','ЗАЗ','ЗИЛ','ИЖ','Москвич','УАЗ'
].sort((a,b) => a.localeCompare(b));
const aliases = { BMW:'бмв', 'Mercedes-Benz':'мерседес мерседес-бенц', Volkswagen:'фольксваген', Toyota:'тойота', Lexus:'лексус', Kia:'киа', Hyundai:'хендай хундай', Renault:'рено', Peugeot:'пежо', 'Škoda':'шкода skoda', Chevrolet:'шевроле', Nissan:'ниссан', Mazda:'мазда', Mitsubishi:'митсубиси мицубиси', Audi:'ауди', Ford:'форд', Porsche:'порше', Volvo:'вольво', Honda:'хонда', Subaru:'субару', Suzuki:'сузуки', Lada:'лада', 'Land Rover':'ленд ровер', 'Li Auto':'лисян', Geely:'джили', Chery:'чери', Haval:'хавал', Zeekr:'зикр' };
const normalize = value => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();

export function setupBrandPicker(input, list, onChange, getItems = () => brands, emptyText = 'Марка не найдена. Можно указать свою.', options = {}) {
  let matches = [], active = -1;
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant'); active = -1; };
  const select = name => { input.value = name; if (onChange(name) === false) { input.focus(); open(); return; } close(); input.focus(); close(); };
  function highlight() {
    [...list.querySelectorAll('[role="option"]')].forEach((option,index) => option.setAttribute('aria-selected',String(index === active)));
    if (active >= 0) { input.setAttribute('aria-activedescendant',`${input.id}-option-${active}`); list.querySelectorAll('[role="option"]')[active].scrollIntoView({block:'nearest'}); }
    else input.removeAttribute('aria-activedescendant');
  }
  function open() {
    if (input.disabled) return;
    const query = normalize(input.value);
    matches = getItems().filter(name => [name,...(input.id === 'brand' ? aliases[name] || '' : '').split(' '),...(options.searchTerms?.(name) || [])].some(value => normalize(value).startsWith(query)));
    active = -1; list.replaceChildren(); input.removeAttribute('aria-activedescendant');
    const header = options.header?.();
    if (header) {
      const back = document.createElement('button'); back.type = 'button'; back.className = 'picker-back'; back.textContent = `← Все модели · ${header}`;
      back.onpointerdown = event => event.preventDefault();
      back.onclick = () => { options.back(); input.focus(); open(); }; list.append(back);
    }
    for (const [index,name] of matches.entries()) {
      const option = document.createElement('div'); option.id = `${input.id}-option-${index}`; option.setAttribute('role','option'); option.setAttribute('aria-selected','false'); option.textContent = name;
      if (options.hasChildren?.(name)) { const arrow = document.createElement('span'); arrow.className = 'picker-arrow'; arrow.textContent = '›'; arrow.setAttribute('aria-hidden','true'); option.append(arrow); }
      option.onpointerdown = event => event.preventDefault();
      option.onclick = () => select(name); list.append(option);
    }
    if (!matches.length) { const empty = document.createElement('p'); empty.textContent = emptyText; list.append(empty); }
    list.hidden = false; input.setAttribute('aria-expanded','true');
  }
  input.addEventListener('focus',open); input.addEventListener('click',open); input.addEventListener('input',open);
  input.addEventListener('keydown',event => {
    if (event.key === 'Escape') { close(); return; }
    if (event.key === 'Tab') { close(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); if (list.hidden) open();
      if (matches.length) { active = (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length; highlight(); }
    } else if (event.key === 'Enter' && !list.hidden && active >= 0) { event.preventDefault(); select(matches[active]); }
  });
  input.addEventListener('blur',close);
  document.addEventListener('pointerdown',event => { if (!input.parentElement.contains(event.target)) close(); });
  return close;
}
