'use strict';

(() => {
  // Retain links shared before the new homepage went live.
  const legacyAnchors = new Set(['hub','gameday','live','explore','gaming','shop','states','coach','coach-chat','partners','panel-sports','panel-betting','panel-gaming','panel-gear']);
  if (legacyAnchors.has(location.hash.slice(1))) {
    location.replace('explore.html' + location.search + location.hash);
    return;
  }

  const dialog = document.querySelector('#panel');
  const body = document.querySelector('#panel-body');
  const resources = FIELD_GUIDE;
  const localCities = new Set(['Manahawkin, NJ','Lakewood, NJ','Toms River, NJ']);
  const defaultFilter = () => ({kind:'All', sport:'All', area:'All', level:'All', query:''});
  const storeKey = 'gameday-clubhouse-v1';
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => [d.getFullYear(), pad(d.getMonth()+1), pad(d.getDate())].join('-');
  const localDay = key => new Date(key + 'T12:00:00');
  const plusDays = (date,count) => {const d = new Date(date); d.setDate(d.getDate()+count); return d;};
  const stamp = (d,opts) => d.toLocaleDateString('en-US',opts);
  const dateLabel = d => stamp(d,{weekday:'short',month:'short',day:'numeric'});
  const clock = d => d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const weekStart = d => plusDays(d,-((d.getDay()+6)%7));
  const atTime = (key,hhmm) => new Date(key + 'T' + hhmm);
  const emptyState = () => ({events:[], saves:[], discoveries:[], outcomes:[]});
  const initialDate = dayKey(now);
  let selected = initialDate;
  let filter = defaultFilter();
  let view = '';
  let draft = {};
  let backView = 'week';
  let discoverySlot = null;
  let noticeTimer;
  let savedOkay = true;

  function readState() {
    try {
      const raw = JSON.parse(localStorage.getItem(storeKey) || '{}');
      const discoveries = Array.isArray(raw.discoveries) ? raw.discoveries.filter(r=>r && typeof r.title==='string' && /^https:\/\//.test(r.url)) : [];
      const validUrls = new Set([...resources, ...discoveries].map(r=>r.url));
      return {
        discoveries,
        outcomes: Array.isArray(raw.outcomes) ? raw.outcomes.filter(url=>validUrls.has(url)) : [],
        events:Array.isArray(raw.events) ? raw.events.filter(e => e && typeof e.id === 'string' && typeof e.title === 'string' && Number.isFinite(e.start) && Number.isFinite(e.end) && e.end>e.start) : [],
        saves:Array.isArray(raw.saves) ? raw.saves.filter(url => validUrls.has(url)) : []
      };
    } catch { return emptyState(); }
  }
  let state = readState();
  function commit(edit) {
    const next = savedOkay ? readState() : state;
    edit(next);
    state = next;
    try { localStorage.setItem(storeKey,JSON.stringify(next)); savedOkay=true; }
    catch { savedOkay=false; }
    home();
  }
  function notify(message) {
    const note=document.querySelector('#notice');
    note.textContent=savedOkay ? message : message + ' Available for this visit only.';
    clearTimeout(noticeTimer);
    noticeTimer=setTimeout(()=>{note.textContent='';},3400);
  }
  function weekDates(date) {
    const start = weekStart(localDay(date));
    return Array.from({length:7},(_,i)=>plusDays(start,i));
  }
  function rangeLabel(days) {
    return stamp(days[0],{month:'short',day:'numeric'})+' – '+stamp(days[6],{month:'short',day:'numeric',year:'numeric'});
  }
  function eventsOn(key) {
    const start=atTime(key,'00:00').getTime();
    const end=atTime(dayKey(plusDays(localDay(key),1)),'00:00').getTime();
    return state.events.filter(e => e.start<end && e.end>start).sort((a,b)=>a.start-b.start);
  }
  function dayButtons(date,scope) {
    return weekDates(date).map(d=>{
      const key=dayKey(d);
      return '<button class="day '+(eventsOn(key).length?'has-events':'')+'" data-day="'+key+'" data-scope="'+scope+'" aria-label="'+esc(dateLabel(d))+'" aria-pressed="'+(key===date)+'"><span>'+stamp(d,{weekday:'short'}).slice(0,2)+'</span>'+d.getDate()+'</button>';
    }).join('');
  }
  function home(){
    const shown = weekDates(initialDate).some(d=>dayKey(d)===selected) ? selected : initialDate;
    document.querySelector('#home-range').textContent=rangeLabel(weekDates(initialDate));
    document.querySelector('#home-days').innerHTML=dayButtons(shown,'home');
    const ev=eventsOn(shown);
    const agenda=document.querySelector('#home-agenda');
    if(ev.length) {
      agenda.innerHTML='<b>'+esc(clock(new Date(ev[0].start)))+' · '+esc(ev[0].title)+'</b><p>'+esc(ev.length>1 ? (ev.length-1)+' more on the lineup' : ev[0].place || dateLabel(localDay(shown)))+'</p>';
    } else {
      agenda.innerHTML='<b>'+dateLabel(localDay(shown))+'</b><p>Your lineup is open. <button class="inline" data-open="event" data-when="'+shown+'">Add a game or practice</button></p>';
    }
    document.querySelector('#saved-count').textContent=String(state.saves.length);
  }
  const action = (label,opts) => '<button class="'+(opts.cls||'inline')+'" '+opts.attr+'>'+esc(label)+'</button>';
  const option = (v,label,active) => '<option value="'+esc(v)+'"'+(active===v?' selected':'')+'>'+esc(label)+'</option>';
  function panel(name,title) {
    view=name;
    document.querySelector('#panel-title').textContent=title;
    if(!dialog.open) dialog.showModal();
    dialog.scrollTop=0;
  }
  function resourceCard(r) {
    const idx=allResources().findIndex(item=>item.url===r.url);
    const saved=state.saves.includes(r.url);
    return '<article class="resource"><div class="meta">'+esc(r.city)+' · '+esc(r.sport)+'</div><h3>'+esc(r.title)+'</h3><p>'+esc(r.detail)+'</p><div class="row-actions"><a href="'+esc(r.url)+'" target="_blank" rel="noopener">Official site</a>'+action(saved?'Unsave':'Save to locker',{attr:'data-save="'+idx+'" aria-pressed="'+saved+'"'})+action('Add to my week',{attr:'data-plan="'+idx+'"'})+
      (view==='locker' ? action(state.outcomes.includes(r.url)?'Marked as tried · undo':r.kind==='Play'?'I tried this':'I went',{attr:'data-outcome="'+idx+'" aria-pressed="'+state.outcomes.includes(r.url)+'"'}) : '')+'</div></article>';
  }
  function showResults(){
    const query=filter.query.trim().toLowerCase();
    const rows=resources.filter(r=>(filter.kind==='All'||r.kind===filter.kind)
      &&(filter.sport==='All'||r.sport.split(' / ').includes(filter.sport))
      &&(filter.level==='All'||r.level===filter.level||r.level==='All ages')
      &&(filter.area==='All'||(filter.area==='Jersey Shore'?localCities.has(r.city):r.city===filter.area))
      &&(!query||[r.title,r.city,r.sport,r.detail,r.level].join(' ').toLowerCase().includes(query)));
    document.querySelector('#hits').textContent=rows.length+' resource'+(rows.length===1?'':'s');
    document.querySelector('#results').innerHTML=rows.length?rows.map(resourceCard).join(''):'<div class="empty">No matching resources. <button class="inline" data-reset>Clear filters</button></div>';
  }
  function discover() {
    panel('discover','Field guide');
    const sports=[...new Set(resources.flatMap(r=>r.sport.split(' / ')))].sort();
    const areas=['Jersey Shore',...[...new Set(resources.map(r=>r.city))].sort()];
    const slotNote = discoverySlot ? '<p class="empty">Choose a place for <b>'+esc(dateLabel(new Date(discoverySlot.start)))+' · '+esc(clock(new Date(discoverySlot.start)))+'</b> ('+discoverySlot.minutes+' minutes). Check opening times with the organizer.</p>' : '';
    body.innerHTML=slotNote+'<div class="chips">'+['All','Play','Venue','Watch'].map(k=>action(k==='Venue'?'Venues':k,{cls:'chip',attr:'data-filter="'+k+'" aria-pressed="'+(filter.kind===k)+'"'})).join('')+'</div><div class="filters">'+
      '<label class="field wide">Search resources<input type="search" id="query" value="'+esc(filter.query)+'" placeholder="Sport, club, venue or city"></label>'+
      '<label class="field">Sport<select id="sport">'+option('All','All sports',filter.sport)+sports.map(s=>option(s,s,filter.sport)).join('')+'</select></label>'+
      '<label class="field">Area<select id="area">'+option('All','All areas',filter.area)+areas.map(s=>option(s,s,filter.area)).join('')+'</select></label>'+
      '<label class="field">Participant<select id="level">'+['All','Youth','Adult'].map(s=>option(s,s==='All'?'Everyone':s,filter.level)).join('')+'</select></label></div>'+
      '<p class="fine" id="hits" aria-live="polite"></p><div id="results"></div>';
    showResults();
  }
  function overlaps(e) { return state.events.some(other=>other.id!==e.id && e.start<other.end && other.start<e.end); }
  function eventCard(e) {
    return '<article class="entry"><div class="meta">'+esc(clock(new Date(e.start)))+' – '+esc(clock(new Date(e.end)))+' · '+esc(e.type)+'</div><h3>'+esc(e.title)+'</h3>'+
      (e.place?'<p>'+esc(e.place)+'</p>':'')+(overlaps(e)?'<p class="conflict">Overlaps another item in your week.</p>':'')+
      '<div class="row-actions">'+action('Edit',{attr:'data-edit="'+esc(e.id)+'"'})+action('Remove',{attr:'data-remove="'+esc(e.id)+'"'})+
      (allResources().some(r=>r.url===e.url)?'<a target="_blank" rel="noopener" href="'+esc(e.url)+'">Official details</a>':'')+'</div></article>';
  }
  function week(){
    panel('week','My sports week');
    const dates=weekDates(selected),keySet=new Set(dates.map(dayKey));
    const count=state.events.filter(e=>keySet.has(dayKey(new Date(e.start)))).length;
    const ev=eventsOn(selected);
    body.innerHTML='<div class="week-controls"><button aria-label="Previous week" data-step="-7">‹</button><b>'+rangeLabel(dates)+'</b><button aria-label="Next week" data-step="7">›</button></div><div class="days panel-days">'+dayButtons(selected,'panel')+'</div><h3 class="small-heading">'+dateLabel(localDay(selected))+'</h3>'+
      (ev.length?ev.map(eventCard).join(''):'<p class="empty">No plans on this day yet.</p>')+
      '<div class="row-actions">'+action('Add a plan',{cls:'dark-button',attr:'data-open="event"'})+action('Find an open window',{attr:'data-open="windows"'})+
      (count?action('Export week to calendar',{attr:'data-export'}):'')+'</div><p class="fine">Your plans and saved places stay in this browser. Times use your device’s time zone.</p>';
  }
  function minutesFree(key,minLength){
    const lower=atTime(key,'08:00').getTime(), upper=atTime(key,'21:00').getTime();
    const occupied=eventsOn(key).map(e=>[Math.max(e.start,lower),Math.min(e.end,upper)]).filter(span=>span[0]<span[1]);
    const windows=[];
    let cursor=lower;
    for(const [start,end] of occupied){
      if(start-cursor>=minLength*60000) windows.push([cursor,start]);
      cursor=Math.max(cursor,end);
    }
    if(upper-cursor>=minLength*60000) windows.push([cursor,upper]);
    return windows;
  }
  function windowList() {
    const key=document.querySelector('#window-day').value, duration=Number(document.querySelector('#window-length').value);
    const el=document.querySelector('#windows');
    if(!key){el.textContent='Choose a day.';return;}
    const available=minutesFree(key,duration);
    el.innerHTML=available.length?available.map(([start,end])=>'<div class="window"><strong>'+clock(new Date(start))+' – '+clock(new Date(end))+'</strong>'+action('Find local options',{attr:'data-match="'+start+'" data-duration="'+duration+'"'})+' '+action('Add my own',{attr:'data-window="'+start+'" data-duration="'+duration+'"'})+'</div>').join(''):'<p class="empty">No window that long. Try a shorter visit or another day.</p>';
  }
  function windows(){
    panel('windows','Find an open window');
    body.innerHTML='<p>Find time between 8 a.m. and 9 p.m. around the activities you’ve added. Check venue hours separately.</p><div class="form-grid"><label class="field">Day<input id="window-day" type="date" value="'+selected+'"></label><label class="field">Time needed<select id="window-length">'+[30,60,90,120].map(n=>option(String(n),n+' minutes','60')).join('')+'</select></label></div><div id="windows"></div><button class="inline" data-open="week">Back to my week</button>';
    windowList();
  }
  function eventForm(params={},back='week'){
    draft=params;backView=back;panel('event',params.id?'Edit plan':'Add to my week');
    const start=params.start?new Date(params.start):atTime(selected,'12:00');
    const dur=params.end?Math.round((params.end-start.getTime())/60000):60;
    const type=params.type||'Game';
    body.innerHTML='<form id="event-form"><div class="form-grid">'+
      '<label class="field wide">Plan name<input name="title" required maxlength="100" placeholder="Saturday soccer practice" value="'+esc(params.title||'')+'"></label>'+
      '<label class="field">Date<input name="date" type="date" required value="'+dayKey(start)+'"></label>'+
      '<label class="field">Start time<input name="time" type="time" required value="'+pad(start.getHours())+':'+pad(start.getMinutes())+'"></label>'+
      '<label class="field">Duration in minutes<input name="duration" type="number" min="5" max="1440" required value="'+dur+'"></label>'+
      '<label class="field">Type<select name="type">'+['Game','Practice','Open play','Outing','Watch'].map(k=>option(k,k,type)).join('')+'</select></label>'+
      '<label class="field wide">Place or team <small>(optional)</small><input name="place" maxlength="120" value="'+esc(params.place||'')+'"></label></div>'+
      '<p class="fine">Times use your device’s time zone. Saving a plan doesn’t reserve a place.</p><button type="submit" class="dark-button">Save plan</button> <button type="button" class="outline" data-cancel>Cancel</button></form>';
  }
  function allResources() {
    return [...resources, ...state.discoveries.filter(item=>!resources.some(r=>r.url===item.url))];
  }
  function locker(){
    panel('locker','My locker');
    const rows=allResources().filter(r=>state.saves.includes(r.url));
    body.innerHTML='<p>Keep the leagues, venues and schedules you use most in one place.</p>'+
      (rows.length?rows.map(resourceCard).join(''):'<p class="empty">No saved resources yet. Save a local club, a venue guide or a league schedule from the field guide.</p>')+
      '<div class="row-actions">'+action('Explore resources',{cls:'dark-button',attr:'data-open="discover"'})+action('Open my week',{attr:'data-open="week"'})+'</div>';
  }
  function exportWeek(){
    const dates=weekDates(selected);
    const first=atTime(dayKey(dates[0]),'00:00').getTime();
    const last=atTime(dayKey(plusDays(dates[6],1)),'00:00').getTime();
    const list=state.events.filter(e=>e.start>=first&&e.start<last);
    if(!list.length)return;
    const icsText=s=>String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,c=>'\\'+c);
    const utc=ts=>new Date(ts).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//GameDay In My City//Sports Week//EN','CALSCALE:GREGORIAN'];
    list.forEach(e=>lines.push('BEGIN:VEVENT','UID:'+e.id+'@gamedayinmycity.com','DTSTAMP:'+utc(Date.now()),'DTSTART:'+utc(e.start),'DTEND:'+utc(e.end),'SUMMARY:'+icsText(e.title),'LOCATION:'+icsText(e.place||''),'END:VEVENT'));
    lines.push('END:VCALENDAR');
    const fold=line=>{let out='',octets=0;for(const ch of line){const n=new TextEncoder().encode(ch).length;if(octets+n>75){out+='\r\n ';octets=1;}out+=ch;octets+=n;}return out;};
    const url=URL.createObjectURL(new Blob([lines.map(fold).join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}));
    const a=document.createElement('a'); a.href=url;a.download='gameday-week-'+dayKey(dates[0])+'.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function credits(){
    panel('credits','Photo credits');
    const photos=[['Football','Henry Lösing','oEVOqvX12NQ'],['Basketball','Olya Brunelli','n8wgIZxlM_o'],['Baseball','Gurdaas Malik','OLBctbqI3YY'],['Stadium','Tanya Barrow','ZOJg4CtbKwk'],['Gaming','Javier Martínez','hUD0PUczwJQ'],['Glove','Diana Polekhina','w1sYdquxs-I']];
    body.innerHTML=photos.map(([sport,author,id])=>'<p>'+sport+' · <a href="https://unsplash.com/photos/'+id+'" target="_blank" rel="noopener">'+esc(author)+'</a></p>').join('')+'<p class="fine">Photography used under the Unsplash License.</p>';
  }
  function openTool(name, subject = '') {
    const render = window.GameDayTools[name];
    if (!Object.hasOwn(SPORTS_EXPERIENCES, name) || typeof render !== 'function') return;
    panel(name, SPORTS_EXPERIENCES[name]);
    body.innerHTML = '<div id="tool-body"></div>';
    render({sport: subject});
  }

  window.GameDayTools.addPlan = params => eventForm(params, view);
  window.GameDayTools.remember = item => {
    if (!item || typeof item.title !== 'string' || !/^https:\/\//.test(item.url)) return false;
    const discovery = {};
    for (const field of ['title','url','city','detail','sport','kind']) discovery[field] = String(item[field] || '');
    commit(s => {
      if (!resources.some(r=>r.url===item.url) && !s.discoveries.some(r=>r.url===item.url)) s.discoveries.push(discovery);
      if (!s.saves.includes(item.url)) s.saves.push(item.url);
    });
    notify('Saved to your locker.');
    return true;
  };

  const featuredSports = ['Football', 'Basketball', 'Baseball', 'Hockey', 'Soccer', 'Pickleball', 'Esports'];
  let sportsCatalog;
  function sportHub(sport) {
    panel('sports', sport);
    body.innerHTML = '<div class="hub-links"></div>';
    const container = body.querySelector('.hub-links');
    const digital = ['Gaming', 'Esports', 'Sim racing'].includes(sport);
    const choices = digital
      ? [['gaming', 'Organize a game night'], ['gear', 'Open my gear locker']]
      : [['play', 'Find places to play'], ['attend', 'Explore outings'], ['gear', 'Open my gear locker']];
    for (const [tool, label] of choices) {
      const button = document.createElement('button');
      button.textContent = label;
      button.dataset.tool = tool;
      button.dataset.subject = sport;
      container.append(button);
    }
    const back = document.createElement('button');
    back.className = 'inline';
    back.dataset.open = 'sports';
    back.textContent = 'Browse all sports';
    body.append(back);
  }
  async function browseSports() {
    panel('sports','Browse sports');
    body.innerHTML = '<label class="field">Find a sport<input type="search" id="sport-lookup" placeholder="Try hockey or sim racing"></label><p class="fine">Choose a sport to explore available tools.</p><div class="sport-choices"></div>';
    const list = body.querySelector('.sport-choices');
    const input = body.querySelector('#sport-lookup');
    function draw() {
      list.replaceChildren();
      const term = input.value.trim().toLowerCase();
      const sports = (sportsCatalog || featuredSports).filter(name=>name.toLowerCase().includes(term));
      for (const sport of sports) {
        const button = document.createElement('button');
        button.dataset.sportHub = sport;
        button.textContent = sport;
        list.append(button);
      }
      if (!sports.length && term) {
        const button = document.createElement('button');
        button.dataset.sportHub = input.value.trim().slice(0,70);
        button.textContent = 'Explore ' + button.dataset.sportHub;
        list.append(button);
      }
    }
    input.addEventListener('input', draw);
    draw();
    if (!sportsCatalog) {
      try {
        const res = await fetch('data/sports.json');
        if (!res.ok) return;
        const data = await res.json();
        sportsCatalog = [...new Set([...data.sports.map(sport=>sport.name), ...resources.flatMap(r=>r.sport.split(' / ')), 'Sim racing', 'Curling', 'Wheelchair basketball'])].filter(s=>s!=='Multi-sport').sort();
        if (list.isConnected) draw();
      } catch { /* Featured sports and free-text search remain usable offline. */ }
    }
  }
  const views={week,discover,windows,locker,credits,sports:browseSports,event:()=>eventForm(),...Object.fromEntries(Object.keys(SPORTS_EXPERIENCES).map(name=>[name,()=>openTool(name)]))};
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(!b)return;
    const d=b.dataset;
    if (d.tool) {openTool(d.tool,d.subject || '');return;}
    if (d.sportHub) {sportHub(d.sportHub);return;}
    if (b.closest('#tool-body')) return;
    if(d.open){if(d.open==='discover')discoverySlot=null;if(d.when)selected=d.when;views[d.open]?.();return;}
    if(d.day){selected=d.day;home();if(d.scope==='panel')week();return;}
    if(d.kind||b.id==='open-local'){discoverySlot=null;filter=defaultFilter();if(d.kind)filter.kind=d.kind;else filter.area='Jersey Shore';discover();return;}
    if(d.filter){filter.kind=d.filter;discover();return;}
    if('reset' in d){filter=defaultFilter();discover();return;}
    if ('outcome' in d) {
      const item = allResources()[Number(d.outcome)];
      if (item) commit(s=>{s.outcomes = s.outcomes.includes(item.url) ? s.outcomes.filter(url=>url!==item.url) : [...s.outcomes,item.url];});
      locker();
      return;
    }
    if('save' in d){
      const r=allResources()[Number(d.save)];
      commit(s=>{s.saves=s.saves.includes(r.url)?s.saves.filter(url=>url!==r.url):s.saves.concat(r.url);});
      if(view==='locker')locker();else showResults();
      notify(state.saves.includes(r.url)?'Saved to your locker.':'Removed from your locker.');
      return;
    }
    if('match' in d){discoverySlot={start:Number(d.match),minutes:Number(d.duration)};filter=defaultFilter();filter.area='Jersey Shore';discover();return;}
    if('plan' in d){const r=allResources()[Number(d.plan)];const slot=view==='discover'&&discoverySlot?{start:discoverySlot.start,end:discoverySlot.start+discoverySlot.minutes*60000}:{};eventForm({...slot,title:r.title,place:r.city==='Nationwide'?'':r.city,url:r.url,type:r.kind==='Play'?'Open play':r.kind==='Watch'?'Watch':'Outing'},view);return;}
    if(d.step){selected=dayKey(plusDays(localDay(selected),Number(d.step)));week();return;}
    if(d.window){const start=Number(d.window);eventForm({start,end:start+Number(d.duration)*60000,type:'Open play'},'windows');return;}
    if(d.edit){const ev=state.events.find(item=>item.id===d.edit);if(ev)eventForm(ev);return;}
    if(d.remove){const item=state.events.find(ev=>ev.id===d.remove);if(!item)return;panel('confirm','Remove plan?');body.innerHTML='<p>'+esc(item.title)+' · '+dateLabel(new Date(item.start))+'</p>'+action('Remove plan',{cls:'dark-button',attr:'data-confirm="'+esc(item.id)+'"'})+' '+action('Keep plan',{cls:'outline',attr:'data-open="week"'});return;}
    if(d.confirm){commit(s=>{s.events=s.events.filter(ev=>ev.id!==d.confirm);});week();notify('Plan removed.');return;}
    if('cancel' in d){(views[backView]||week)();return;}
    if('export' in d){exportWeek();return;}
    if(b.id==='close-panel')dialog.close();
  });
  body.addEventListener('input',e=>{if(e.target.id==='query'){filter.query=e.target.value;showResults();}});
  body.addEventListener('change',e=>{
    if(e.target.closest('#tool-body'))return;
    if(['sport','area','level'].includes(e.target.id)){filter[e.target.id]=e.target.value;showResults();}
    if(['window-day','window-length'].includes(e.target.id))windowList();
  });
  body.addEventListener('submit',e=>{
    if(e.target.id!=='event-form')return;e.preventDefault();
    const form=e.target, data=new FormData(form);
    const title=String(data.get('title')).trim();
    if(!title){form.elements.title.setCustomValidity('Enter a plan name.');form.elements.title.reportValidity();form.elements.title.setCustomValidity('');return;}
    const start=atTime(data.get('date'),data.get('time')).getTime();
    if(!Number.isFinite(start))return;
    const item={id:draft.id||crypto.randomUUID(),title,type:String(data.get('type')),place:String(data.get('place')).trim(),url:draft.url||'',start,end:start+Number(data.get('duration'))*60000};
    selected=dayKey(new Date(start));
    commit(s=>{s.events=s.events.filter(ev=>ev.id!==item.id).concat(item);});
    week();notify('Plan saved.');
  });
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const box=dialog.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)dialog.close();});
  window.addEventListener('storage',e=>{if(e.key===storeKey||e.key===null){state=readState();home();if(dialog.open&&['week','locker','discover','windows'].includes(view))views[view]();}});
  const shortcutBar = document.querySelector('#sport-shortcuts');
  for (const sport of featuredSports) {
    const button = document.createElement('button');
    button.dataset.sportHub = sport;
    button.textContent = sport;
    shortcutBar.append(button);
  }
  document.querySelector('#today').textContent=stamp(now,{weekday:'long',month:'short',day:'numeric'});
  const leagues=resources.filter(r=>r.kind==='Watch'&&r.city==='Nationwide');
  document.querySelector('#league-links').innerHTML=leagues.map(r=>'<a href="'+esc(r.url)+'" target="_blank" rel="noopener" aria-label="'+esc(r.title)+'">'+esc(r.title.split(' ')[0])+'</a>').join('');
  const localPicks=['Stafford Township Recreation','Winding River Ice Rink',resources.find(r=>localCities.has(r.city)&&r.kind==='Watch')?.title];
  document.querySelector('#local-picks').innerHTML=localPicks.map(t=>resources.find(r=>r.title===t)).filter(Boolean).map(r=>'<article class="local-pick"><div class="eyebrow dark">'+esc(r.city)+'</div><a class="inline" href="'+esc(r.url)+'" target="_blank" rel="noopener">'+esc(r.title)+'</a><p>'+esc(r.detail)+'</p></article>').join('');
  home();
  const incoming = new URLSearchParams(location.search);
  if (incoming.has('night')) openTool('gaming');
  else if (Object.hasOwn(SPORTS_EXPERIENCES, incoming.get('tool'))) openTool(incoming.get('tool'), incoming.get('sport') || '');
})();
