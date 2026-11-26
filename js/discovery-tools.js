/* Location and participation discovery. Event dates, general venue guides and provider
   results are rendered separately so a venue match cannot imply a bookable event. */
(() => {
  'use strict';
  const gameDay = window.GameDayTools = window.GameDayTools || {};
  const zipCenters = {
    '08050': [39.705, -74.2604, 'Manahawkin, NJ'], '08008': [39.6411,-74.1922,'Long Beach Island, NJ'],
    '08753': [39.9771,-74.1565,'Toms River, NJ'], '08701': [40.085,-74.2042,'Lakewood, NJ']
  };
  const source = title => FIELD_GUIDE.find(r => r.title === title);
  const doc = source('Doc Cramer Sports Complex');
  const rink = source('Winding River Ice Rink');
  const field = (title, sports, city, point, audience, fit, first, url) => ({title,sports,city,point,audience,fit,first,url});
  const oceanAcres = [39.739655,-74.265662];
  const docCramer = [39.699159,-74.279958];
  const shoreTown = [40.0751,-74.1870];
  const shore5k = [39.569149,-74.236305];
  const play = [
    field('Ocean Acres basketball & tennis courts',['Basketball','Tennis'],'Manahawkin, NJ',oceanAcres,'All ages','Drop in','Bring a ball or racquet. Check court access with the township before heading out.','https://www.staffordnj.gov/facilities/facility/details/Ocean-Acres-Lake-Park-7'),
    field('Stafford seasonal youth tennis',['Tennis'],'Manahawkin, NJ',oceanAcres,'Youth','Learn','The township describes age-appropriate balls and kid-sized racquets provided. Check the next session and the assigned court with the program.','https://www.staffordnj.gov/621/Fall-Tennis'),
    field(doc.title,['Baseball','Softball','Football','Soccer'],doc.city,docCramer,'All ages','Team play','Compare the available fields. The township lists baseball and softball diamonds, soccer and football fields. Ask about access or reservations.',doc.url),
    field('Doc Cramer disc golf',['Disc golf'],'Manahawkin, NJ',[39.7,-74.2818],'All ages','Drop in','Bring a disc and use the course listing for first-tee directions.','https://www.dgcoursereview.com/courses/doc-cramer-dgc.6896'),
    field(rink.title,['Hockey','Skating','Figure skating'],rink.city,[39.9883,-74.2159],'All ages','Learn','Compare public skating and learn-to-play hockey. The township publishes schedules and a fee flyer.',rink.url)
  ];
  const schoolCalendar = 'https://southernregionalathletics.digitalsports.com/pages/schedule/schedule.php';
  const venues = [
    {title:'Southern Regional athletics',sports:['Football','Basketball','Wrestling','Baseball','Softball','Lacrosse','Tennis','Volleyball','Soccer','Track & Field','Swimming','Bowling','Hockey'],city:'Manahawkin, NJ',point:[39.712,-74.254],url:schoolCalendar,detail:'Browse school matchups. Distance is to the high-school campus. Check the venue listed for each home or away event.'},
    {title:'ShoreTown Ballpark',sports:['Baseball'],city:'Lakewood, NJ',point:shoreTown,url:source('Jersey Shore BlueClaws schedule').url,detail:'Official BlueClaws game schedule and ticket links.'}
  ];
  const venuePoints = {'MetLife Stadium':[40.8135,-74.0745], 'Lincoln Financial Field':[39.9008,-75.1675], 'Fenway Park':[42.3467,-71.0972], 'Dodger Stadium':[34.0739,-118.2400], 'United Center':[41.8807,-87.6742], 'Madison Square Garden':[40.7505,-73.9934], 'Mercedes-Benz Stadium':[33.7554,-84.4008], 'T-Mobile Park':[47.5914,-122.3325]};
  for (const item of FIELD_GUIDE.filter(r=>Object.hasOwn(venuePoints,r.title))) {
    venues.push({...item,sports:item.sport.split(' / '),point:venuePoints[item.title]});
  }
  // Dated organizer publications. Hide expired events and distinguish the runner entry fee from admission.
  const events = [
    {name:'Sleigh the Shore 5K',sport:'Running',place:'Ship Bottom Brewery',city:'Beach Haven, NJ',point:shore5k,date:'2026-12-12',time:'15:00',start:'2026-12-12T15:00:00-05:00',price:45,priceNote:'Posted runner entry',detail:'LBI Athletic Club lists check-in at 1:30 p.m., a 3 p.m. start and awards at 4:15 p.m. Spectator pricing is unconfirmed.',url:'https://runsignup.com/Race/NJ/BeachHaven/SleighTheShore5K'},
    {name:'BlueClaws opening night',sport:'Baseball',place:'ShoreTown Ballpark',city:'Lakewood, NJ',point:shoreTown,date:'2027-04-02',time:'18:35',start:'2027-04-02T18:35:00-04:00',price:null,detail:'Jersey Shore opens its home season against Winston-Salem. Confirm tickets and availability with the team.',url:'https://www.milb.com/jersey-shore/news/blueclaws-announce-2027-game-times'}
  ];

  const escape = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  function link(label,url) {
    try { if(new URL(url).protocol!=='https:') return ''; } catch {return '';}
    return '<a href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">'+escape(label)+'</a>';
  }
  const options = (items,selected) => items.map(([v,label])=>'<option value="'+escape(v)+'"'+(v===selected?' selected':'')+'>'+escape(label)+'</option>').join('');
  const opt = value => [value,value];
  const category = (a,b) => a.localeCompare(b,undefined,{sensitivity:'base'})===0;
  function matchesSport(sports,selected){
    return !selected || sports.some(s=>category(s,selected));
  }
  function milesFrom(from,point) {
    const radians = Math.PI/180;
    const a=Math.sin((point[0]-from[0])*radians/2)**2
      + Math.cos(from[0]*radians)*Math.cos(point[0]*radians)*Math.sin((point[1]-from[1])*radians/2)**2;
    return 7917.52*Math.asin(Math.sqrt(Math.min(1,a)));
  }
  let lastZip = '08050', lastRadius = '20';
  function nearby(rows,center,radius) {
    return rows.map(r=>({...r,miles:milesFrom(center,r.point)})).filter(r=>r.miles<=radius).sort((a,b)=>a.miles-b.miles);
  }
  const meta = text => '<p class="meta">'+escape(text)+'</p>';
  const empty = text => '<p class="empty">'+escape(text)+'</p>';
  const heading = text => '<h3 class="small-heading">'+escape(text)+'</h3>';
  function card(title,info,detail,links) {
    return '<article class="resource">'+meta(info)+'<h3>'+escape(title)+'</h3><p>'+escape(detail)+'</p><div class="row-actions">'+links+'</div></article>';
  }
  function selectField(name,title,items,selected='') {
    return '<label class="field">'+escape(title)+'<select name="'+name+'">'+options(items,selected)+'</select></label>';
  }
  const startingPoints = {
    'Ocean Acres basketball & tennis courts': ['One visit', 'Bring a basketball or a racquet and balls.'],
    'Stafford seasonal youth tennis': ['Seasonal lessons', 'The program lists kid-sized racquets.'],
    'Doc Cramer Sports Complex': ['Field access varies', 'Check the field and team requirements before buying gear.'],
    'Doc Cramer disc golf': ['One round', 'Start with one disc.'],
    'Winding River Ice Rink': ['Single skate or lessons', 'Check skate rentals and the rink’s current fees.']
  };
  function formatDay(date) {
    return new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date(date+'T12:00:00'));
  }
  function formatClock(time) {
    if (!time) return 'Start time unconfirmed';
    const [hour,minute]=time.split(':');
    return (Number(hour)%12||12)+':'+minute+' '+(Number(hour)<12?'a.m.':'p.m.')+' local';
  }
  function localYmd() {
    const date = new Date();
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  }
  async function resolveZip(zip,signal) {
    if (Object.hasOwn(zipCenters,zip)) return zipCenters[zip];
    const reply=await fetch('https://api.zippopotam.us/us/'+zip,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if (reply.status===404) throw Error('That ZIP code could not be found. Check the number or use your location.');
    if (!reply.ok) throw Error('ZIP lookup is unavailable. Try device location or a Jersey Shore ZIP such as 08050.');
    const place=(await reply.json()).places?.[0];
    if (!place || !Number.isFinite(Number(place.latitude)) || !Number.isFinite(Number(place.longitude))) throw Error('That ZIP code has no usable location.');
    return [Number(place.latitude),Number(place.longitude),place['place name']+', '+place['state abbreviation']];
  }
  function getDevicePoint(){
    return new Promise((resolve,reject)=>{
      if (!navigator.geolocation) {reject(Error('Location is unavailable in this browser. Enter a ZIP code instead.')); return;}
      navigator.geolocation.getCurrentPosition(
        position=>resolve([position.coords.latitude,position.coords.longitude,'your device']),
        ()=>reject(Error('Device location was unavailable. Enter a ZIP code to continue.')),
        {enableHighAccuracy:false,maximumAge:600000,timeout:8000}
      );
    });
  }
  function startTool(mode,settings = {}) {
    const isPlay=mode==='play';
    const mount=document.getElementById('tool-body');
    if(!mount)return;
    const root=document.createElement('section');
    mount.replaceChildren(root);
    const prefill=typeof settings.sport==='string' ? settings.sport.trim() : '';
    const allSports = [...new Set([...play.flatMap(r=>r.sports),...venues.flatMap(r=>r.sports),...FIELD_GUIDE.flatMap(r=>r.sport.split(' / ')),'Running','Disc golf','Adaptive sports',prefill].filter(Boolean))].sort();
    root.innerHTML='<p>'+(isPlay?'Compare ways to start playing near you. Pick an activity style and explore across sports.':'Compare upcoming outings by distance, start time and group budget. Venue guides are available separately.')+'</p>'+
      '<form class="discovery-form"><div class="form-grid"><label class="field">US ZIP code<input name="zip" aria-label="US ZIP code" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" value="'+escape(lastZip)+'"></label>'+
      selectField('radius','Search radius',[5,10,20,30].map(n=>[String(n),n+' miles']),lastRadius)+
      '<label class="field">Sport <small>Optional</small><input name="sport" list="discovery-sports" placeholder="Any sport" maxlength="60" value="'+escape(prefill)+'"><datalist id="discovery-sports">'+allSports.map(s=>'<option value="'+escape(s)+'">').join('')+'</datalist></label>'+
      (isPlay?selectField('audience','Who is playing?',[['','Everyone'],opt('Youth'),opt('Adult')])+selectField('fit','What sounds good?',[['','Show every style'],['Learn','Try a sport or learn'],['Drop in','Drop in on my own'],['Team play','Play on a team']]):
      '<label class="field">Outing date <small>Optional</small><input name="day" type="date" min="'+localYmd()+'"></label>'+
      selectField('when','Start time',[['','Any time'],['early','Before noon'],['day','Noon to 5 p.m.'],['night','5 p.m. or later']])+
      '<label class="field">Number attending<input name="people" type="number" required min="1" max="100" step="1" value="2"></label><label class="field">Group admission budget, USD <small>Optional</small><input name="budget" type="number" min="0" max="100000" step="0.01" placeholder="Any budget"></label>')+
      '</div><div class="row-actions"><button type="submit" class="dark-button">Search nearby</button><button type="button" class="outline" data-locate>Use my location</button></div>'+
      '<p class="fine">Distance is straight-line from the ZIP center or your device. ZIP lookup uses Zippopotam.us. Nearby search can send a rounded location to listing providers.</p></form>'+
      '<section aria-label="Search results"><p class="fine" data-summary role="status"></p><div data-results></div><div data-providers></div></section>';
    const form=root.querySelector('form'), output=root.querySelector('[data-results]'), providerOutput=root.querySelector('[data-providers]'), summary=root.querySelector('[data-summary]');
    let serial=0, device=null, controller=null, choices=[], bookmarks=[];
    form.elements.zip.addEventListener('input',()=>{device=null;});
    const compareSet=new Set();
    function compareButton(r) {
      return '<button type="button" class="inline" data-compare="'+escape(r.title)+'" aria-pressed="'+compareSet.has(r.title)+'">'+(compareSet.has(r.title)?'Remove comparison':'Compare')+'</button>';
    }
    function updateCompare() {
      const box=root.querySelector('[data-comparisons]');
      if(!box)return;
      const picks=play.filter(r=>compareSet.has(r.title));
      box.innerHTML=picks.length?heading('Your comparison')+
        '<div style="overflow-x:auto"><table style="border-spacing:0.6rem;text-align:left"><caption class="fine">Compare up to three ways to play</caption><thead><tr><th>Option</th><th>Commitment</th><th>First equipment check</th></tr></thead><tbody>'+
        picks.map(r=>'<tr><th scope="row">'+escape(r.title)+' <button type="button" class="inline" data-remove-comparison="'+escape(r.title)+'">Remove</button></th><td>'+escape(startingPoints[r.title][0])+'</td><td>'+escape(startingPoints[r.title][1])+'</td></tr>').join('')+'</tbody></table></div>':'';
    }
    function planAction(item) {
      if(typeof gameDay.addPlan!=='function')return '';
      const i=choices.push(item)-1;
      return '<button class="inline" type="button" data-plan-index="'+i+'">Plan a visit</button>';
    }
    function saveAction(item) {
      if(typeof gameDay.remember!=='function')return '';
      const i=bookmarks.push(item)-1;
      return '<button class="inline" type="button" data-save-result="'+i+'">Save to locker</button>';
    }
    function section(title,rows,html) {
      return rows.length?heading(title)+rows.map(html).join(''):'';
    }
    function playResults(s,center) {
      const found=nearby(play,center,s.miles).filter(r=>matchesSport(r.sports,s.sport)&&(!s.audience||s.audience===r.audience||r.audience==='All ages')&&(!s.fit||r.fit===s.fit));
      const local=section('Ways to play',found,r=>card(r.title,r.miles.toFixed(1)+' mi · '+r.city+' · '+r.sports.join(' / '),r.fit+' · '+r.audience+'. '+r.first,link('Organizer or facility',r.url)+compareButton(r)+saveAction({title:r.title,url:r.url,kind:'Play',city:r.city,detail:r.first,sport:r.sports.join(' / ')})+planAction({title:r.title,place:r.city,url:r.url,type:'Open play'})));
      const finders=FIELD_GUIDE.filter(r=>r.kind==='Play'&&r.city==='Nationwide'&&matchesSport(r.sport.split(' / '),s.sport)&&(!s.audience||r.level==='All ages'||r.level===s.audience));
      const fallback=finders.length?'<details><summary>National sport finders ('+finders.length+')</summary><p class="fine">Search these directories separately for programs in your area.</p>'+finders.map(r=>card(r.title,r.sport+' · '+r.level,r.detail,link('Open directory',r.url))).join('')+'</details>':'';
      return '<div data-comparisons aria-live="polite"></div>'+(local||empty('No GameDay field-guide entries match these settings. Try another sport or a wider radius.'))+fallback;
    }
    function eventTimeFits(r,s){
      if(!s.when)return true;
      if(!r.time)return false;
      const hour=Number(r.time.split(':')[0]);
      return s.when==='early'?hour<12:s.when==='day'?hour>=12&&hour<17:hour>=17;
    }
    function outingCards(rows,s) {
      const confirmed=[], unknown=[];
      for(const r of rows){
        if(r.date<localYmd()||r.start&&new Date(r.start)<new Date()||s.day&&s.day!==r.date)continue;
        if(s.when && r.time && !eventTimeFits(r,s))continue;
        const cost=r.price ?? r.lowPrice;
        if(s.budget!==''&&cost!=null&&cost*s.people>Number(s.budget))continue;
        const incomplete=(s.budget!==''&&(cost==null||r.lowPrice!=null)) || (s.when&&!r.time);
        const groupCost=cost==null?'Admission price unconfirmed.':(r.priceNote||'Listed starting ticket price')+' $'+cost+' each; '+s.people+' × $'+cost+' = $'+(s.people*cost).toFixed(2)+' before any additional fees. Recheck the provider price.';
        const act=card(r.name,r.miles.toFixed(1)+' mi · '+r.city+' · '+formatDay(r.date)+' · '+formatClock(r.time),[r.detail,groupCost].filter(Boolean).join(' '),link('Event details',r.url)+ (r.point?saveAction({title:r.name,url:r.url,kind:'Watch',city:r.city,detail:r.detail,sport:r.sport}):'')+
          planAction({title:r.name,place:r.place,url:r.url,type:'Outing',...(r.start?{start:Date.parse(r.start)}:{})}));
        (incomplete?unknown:confirmed).push(act);
      }
      return (confirmed.length?heading('Upcoming outings')+confirmed.join(''):'')+(unknown.length?heading('Check details before deciding')+unknown.join(''):'');
    }
    function attendResults(s,center) {
      const listings=nearby(events,center,s.miles).filter(r=>matchesSport([r.sport],s.sport));
      const dated=outingCards(listings,s);
      const guides=nearby(venues,center,s.miles).filter(r=>matchesSport(r.sports,s.sport));
      return (dated||empty('No curated dated outings match these settings.'))+
        section('Venues & schedules to check',guides,r=>card(r.title,r.miles.toFixed(1)+' mi · '+r.city,r.detail,link('Official guide or schedule',r.url)+saveAction({title:r.title,url:r.url,kind:'Watch',city:r.city,detail:r.detail,sport:r.sports.join(' / ')})));
    }
    function providerPlaces(data) {
      if (!data.rows.length)return '';
      return heading('Nearby venues from Google Maps')+'<p class="fine">Venue matches only. Check session times, participant eligibility and prices directly.</p>'+data.rows.map(r=>{
        const attribution=(r.credits||[]).map(a=>a.url ? link(a.name,a.url):escape(a.name)).join(' · ');
        return card(r.name,r.miles.toFixed(1)+' mi',r.address,link('View place',r.url)+'<span translate="no" style="font:400 12px Roboto,Arial,sans-serif;letter-spacing:normal;color:#5e5e5e;white-space:nowrap">Google Maps</span>'+attribution);
      }).join('');
    }
    async function search(useDevice=false,requestProviders=true) {
      if(!useDevice&&!device&&!/^\d{5}$/.test(form.elements.zip.value)){form.elements.zip.setCustomValidity('Enter a five-digit US ZIP code.');form.reportValidity();form.elements.zip.setCustomValidity('');return;}
      if(useDevice)form.elements.zip.disabled=true;
      const valid=form.reportValidity();
      if(useDevice)form.elements.zip.disabled=false;
      if(!valid)return;
      controller?.abort();
      const searchId=++serial;
      const currentController=new AbortController();
      controller=currentController;
      const active=()=>serial===searchId&&root.isConnected;
      const values=Object.fromEntries(new FormData(form));
      const s={...values,sport:values.sport.trim(),miles:Number(values.radius),people:Number(values.people)||1,day:values.day||''};
      output.replaceChildren();providerOutput.replaceChildren();choices=[];bookmarks=[];
      summary.textContent=useDevice?'Requesting your location…':'Finding your area…';
      let center;
      try {
        center=useDevice?await getDevicePoint():device||await resolveZip(values.zip,AbortSignal.any([currentController.signal,AbortSignal.timeout(8500)]));
      } catch (error) {if(active())summary.textContent=error.name==='TimeoutError'?'ZIP lookup timed out. Try device location or another ZIP.':error.message;return;}
      if(!active())return;
      if(useDevice){device=center;form.elements.zip.value='';} else if(!device)lastZip=values.zip;
      lastRadius=s.radius;
      summary.textContent='Within '+s.miles+' miles of '+center[2]+'.';
      output.innerHTML=isPlay?playResults(s,center):attendResults(s,center);updateCompare();
      if(!requestProviders)return;
      providerOutput.textContent='Checking additional listings…';
      try {
        const reply=await fetch('/api/discover-nearby',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([currentController.signal,AbortSignal.timeout(9000)]),
          body:JSON.stringify({mode,lat:Number(center[0].toFixed(3)),lon:Number(center[1].toFixed(3)),miles:s.miles,sport:s.sport,day:s.day})});
        if(!reply.ok)throw Error(reply.status===429?'Search limit reached. Retry in a minute.':'Live listings are unavailable.');
        const d=await reply.json();
        if(!active())return;
        const p=d.places||{},e=d.events||{};
        const fromCenter=rows=>rows.map(r=>({...r,miles:milesFrom(center,r.providerPoint)})).filter(r=>r.miles<=s.miles);
        let extra='';
        if(!isPlay&&e.status==='ready'&&e.rows.length)extra+=outingCards(fromCenter(e.rows),s);
        if(p.status==='ready')extra+=providerPlaces({...p,rows:fromCenter(p.rows).sort((a,b)=>a.miles-b.miles)});
        if(!extra)extra='<p class="fine">'+((p.status==='ready'||e.status==='ready')?'No additional provider matches.':'Showing the curated field guide. Live provider listings are unavailable.')+'</p>';
        providerOutput.innerHTML=extra;
      }catch(error){if(active())providerOutput.textContent=error.message==='Search limit reached. Retry in a minute.'?error.message:'Showing the curated field guide. Live listings are unavailable.';}
    }
    form.addEventListener('submit',e=>{e.preventDefault();search();});
    form.querySelector('[data-locate]').addEventListener('click',()=>search(true));
    root.addEventListener('click',e=>{
      const removal=e.target.closest('[data-remove-comparison]');
      if(removal){
        const title=removal.dataset.removeComparison;
        compareSet.delete(title);
        const button=[...root.querySelectorAll('[data-compare]')].find(b=>b.dataset.compare===title);
        if(button){button.textContent='Compare';button.setAttribute('aria-pressed','false');}
        updateCompare();
        return;
      }
      const comparison=e.target.closest('[data-compare]');
      if(comparison){
        const title=comparison.dataset.compare;
        if(compareSet.has(title))compareSet.delete(title);
        else if(compareSet.size<3)compareSet.add(title);
        else {summary.textContent='Choose up to three. Remove one comparison to make room.';return;}
        comparison.textContent=compareSet.has(title)?'Remove comparison':'Compare';
        comparison.setAttribute('aria-pressed',String(compareSet.has(title)));
        updateCompare();
        return;
      }
      const b=e.target.closest('[data-plan-index]');
      if(b&&root.contains(b))gameDay.addPlan?.(choices[Number(b.dataset.planIndex)]);
      const save=e.target.closest('[data-save-result]');
      if(save&&root.contains(save)){
        const item=bookmarks[Number(save.dataset.saveResult)];
        if(item)gameDay.remember?.(item);
      }
    });
    search(false,false);
  }
  gameDay.play=settings=>startTool('play',settings);
  gameDay.attend=settings=>startTool('attend',settings);
})();
