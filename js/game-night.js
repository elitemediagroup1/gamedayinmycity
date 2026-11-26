(() => {
  'use strict';
  const API = '/.netlify/functions/game-night';
  const LIBRARY = 'gameday-night-invites-v1';
  const PLAYER = 'gameday-night-player-v1';
  const ORGANIZER = 'gameday-night-host-v1';
  const platforms = ['PC','Xbox','PlayStation','Nintendo','Mobile','Cross-platform'];
  const styles = ['Casual','Competitive','Learning together'];
  const statuses = ['Playing','Available as a sub','Out this week'];
  const games = ['EA Sports FC','NBA 2K','Madden NFL','NHL','Rocket League','iRacing','Gran Turismo','MLB The Show','F1','Street Fighter','Super Smash Bros.'];
  const validID = s => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
  const text = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const options = (items,current) => items.map(s=>'<option'+(s===current?' selected':'')+'>'+text(s)+'</option>').join('');
  const get = (key,fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const put = (key,value) => { try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch { return false; } };
  const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const clockPattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
  const oneDay = 86400000;
  function civil(d = new Date(), zone = localZone()) {
    const p = new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);
    const fields=Object.fromEntries(p.map(part=>[part.type,part.value]));
    return { day:[fields.year,fields.month,fields.day].join('-'), time:fields.hour+':'+fields.minute };
  }
  // Weekly game nights stay at the host's local hour when daylight saving changes.
  function instant(day,time,zone) {
    const asUTC = (date,clock) => Date.parse(date+'T'+clock+':00Z');
    const requested = asUTC(day,time);
    let guess = requested;
    for(let i=0;i<4;i++) {
      const local = civil(new Date(guess),zone);
      const diff = requested - asUTC(local.day,local.time);
      if(diff===0) return guess;
      guess += diff;
    }
    return null;  // This local time does not exist during a daylight-saving transition.
  }
  function nextSessions(room) {
    const today = civil(new Date(),room.zone).day;
    const base = Date.parse(room.firstDay+'T00:00:00Z');
    const gap = Date.parse(today+'T00:00:00Z')-base;
    const start = Math.max(0,Math.floor(gap/(7*oneDay)));
    const dates=[];
    for(let i=start;dates.length<4 && i<start+8;i++) {
      const day = new Date(base + i*7*oneDay).toISOString().slice(0,10);
      const at = instant(day,room.time,room.zone);
      if(at!==null && at>=Date.now()-60*60000) dates.push({day,at});
    }
    return dates;
  }
  function formatSession(at) {
    return new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(at);
  }
  function invite(id) {
    const url=new URL(location.href);
    url.search=''; url.hash=''; url.searchParams.set('night',id);
    return url.href;
  }
  function replaceInvite(id) {
    const url=new URL(location.href);
    if(id) url.searchParams.set('night',id); else url.searchParams.delete('night');
    history.replaceState(history.state,'',url);
  }
  function library() {
    const saved=get(LIBRARY,[]);
    return Array.isArray(saved)?saved.filter(n=>n && validID(n.id) && typeof n.title==='string'):[];
  }
  function remember(id,room) {
    put(LIBRARY,[{id,title:room.title},...library().filter(n=>n.id!==id)].slice(0,30));
  }
  async function request(method,id,data) {
    const url=new URL(API,location.origin);
    const config={method,headers:{accept:'application/json'},credentials:'same-origin'};
    if(method==='GET') {
      if(id) url.searchParams.set('id',id);
      if(data?.day) url.searchParams.set('day',data.day);
      if(data?.directory) url.searchParams.set('directory','1');
      if(data?.after) url.searchParams.set('after',data.after);
    } else {
      config.headers['content-type']='application/json';
      config.body=JSON.stringify({...data,id});
    }
    const result=await fetch(url,config);
    if (!result.headers.get('content-type')?.includes('application/json')) throw new Error('The shared game-night service is unavailable here. Retry from the deployed GameDay site.');
    const payload=await result.json();
    if(!result.ok)throw new Error(payload.error||'Game nights could not load. Please retry.');
    return payload;
  }
  function message(err) { return err instanceof TypeError?'Couldn’t connect. Check your connection and retry.':String(err.message || 'Please retry.'); }
  function datestring(day,format){return new Intl.DateTimeFormat(undefined,{...format,timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));}
  function tool(){
    const host = document.querySelector('#tool-body');
    if(!host) return;
    const block = document.createElement('div');
    block.className='night-room fan-tool'; host.replaceChildren(block);
    let roomId=null, room=null, sessionDay=null, rosterVersion=0;
    const active=()=>block.isConnected;
    const tell=(selector,msg)=>{const output=block.querySelector(selector);if(output)output.textContent=msg;};
    function directory(){
      const section=block.querySelector('[data-directory]');
      const rows=section.querySelector('[data-matches]');
      const filters=section.querySelector('form');
      const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      let rooms=[], cursor=null, loaded=false, pending=false;
      function results(){
        const f=Object.fromEntries(new FormData(filters));
        const matches=rooms.flatMap(item=>{
          const next=nextSessions(item)[0];
          if(!next) return [];
          const start=new Date(next.at);
          const hhmm=civil(start).time;
          const query=f.game.trim().toLowerCase();
          if(query && ![item.game,item.title].some(t=>t.toLowerCase().includes(query)))return [];
          if(f.platform && item.platform!==f.platform && item.platform!=='Cross-platform')return [];
          if(f.style && item.style!==f.style)return [];
          if(f.day && weekdays[start.getDay()]!==f.day)return [];
          const okayTime = f.from && f.to && f.from>f.to ? hhmm>=f.from || hhmm<=f.to : (!f.from || hhmm>=f.from) && (!f.to || hhmm<=f.to);
          return okayTime?[{item,start:next.at}]:[];
        }).sort((a,b)=>a.start-b.start);
        rows.innerHTML=matches.length?matches.map(({item,start})=>'<article class="resource"><div class="meta">'+text(item.game)+' · '+text(item.platform)+' · '+text(item.style)+'</div><h3>'+text(item.title)+'</h3><p>Weekly · Next '+text(formatSession(start))+'</p><button type="button" class="inline" data-night-id="'+text(item.id)+'">View game night</button></article>').join(''):
          '<p class="empty">'+(loaded && !rooms.length && !cursor?'No public game nights are listed yet. Start the first group for your game.':'No matching groups in the loaded rooms. Adjust your filters or start a night.')+'</p>';
        rows.querySelectorAll('[data-night-id]').forEach(b=>b.onclick=()=>open(b.dataset.nightId));
        if(cursor) {
          const next=document.createElement('button');next.type='button';next.className='outline';next.textContent='Load more public rooms';
          next.onclick=load;rows.append(next);
        }
      }
      async function load(){
        if(pending)return;
        pending=true;
        const note=section.querySelector('[data-discovery-note]');
        note.textContent='Checking public rooms…';
        try {
          const data=await request('GET',null,{directory:true,after:cursor});
          if(!section.isConnected)return;
          rooms.push(...data.rooms);cursor=data.after;loaded=true;
          note.textContent=cursor?rooms.length+' public rooms loaded. More may be available.':'Times shown in '+localZone()+'.';
          results();
        }catch(err){
          if(!section.isConnected)return;
          note.textContent='Couldn’t load public rooms. Please retry.';
          const retry=document.createElement('button');retry.type='button';retry.className='outline';retry.textContent='Retry room search';retry.onclick=load;
          rows.replaceChildren(retry);
        }finally{pending=false;}
      }
      filters.oninput=()=>{if(loaded)results();};
      filters.onsubmit=e=>{e.preventDefault();if(loaded)results();else load();};
      load();
    }
    function chooser(){
      roomId=null; room=null; rosterVersion++; replaceInvite(null);
      const saved=library();
      block.innerHTML='<p>Organize a weekly session for a game, platform and play style. Players can confirm or volunteer as substitutes for individual nights.</p>'+
        '<button type="button" class="dark-button" data-new>Start a game night</button>'+
        '<section data-directory><h3 class="small-heading">Find a weekly group</h3><form class="form-grid">'+
        '<label class="field wide">Search game or room<input type="search" name="game" placeholder="Rocket League, sim racing…"></label>'+
        '<label class="field">Platform<select name="platform"><option value="">Any platform</option>'+options(platforms)+'</select></label>'+
        '<label class="field">Play style<select name="style"><option value="">Any style</option>'+options(styles)+'</select></label>'+
        '<label class="field">Available day<select name="day"><option value="">Any day</option>'+options(['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'])+'</select></label>'+
        '<label class="field">Earliest local start<input type="time" name="from"></label><label class="field">Latest local start<input type="time" name="to"></label></form>'+
        '<p class="fine" role="status" data-discovery-note></p><div data-matches></div></section>'+
        (saved.length?'<h3 class="small-heading">Your recent rooms</h3>'+saved.map(n=>'<div class="window"><b>'+text(n.title)+'</b><button type="button" class="inline" data-room="'+text(n.id)+'">Open room</button></div>').join(''):'')+
        '<details class="resource"><summary>Open an invite</summary><form data-invite><label class="field">GameDay invite link<input type="url" name="url" required></label><div class="form-footer"><button class="outline" type="submit">Open room</button></div><p class="error" role="status"></p></form></details>';
      directory();
      block.querySelector('[data-new]').onclick=create;
      block.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>open(b.dataset.room));
      block.querySelector('[data-invite]').onsubmit=e=>{
        e.preventDefault();
        const url = new URL(new FormData(e.currentTarget).get('url'));
        const id=url.searchParams.get('night');
        if(url.origin!==location.origin || !validID(id)){tell('.error','Paste a room link from this GameDay site.');return;}
        open(id);
      };
    }
    function create(){
      const id=crypto.randomUUID();
      const hostToken=crypto.randomUUID();
      const zone=localZone();
      const zones=[...new Set([zone,'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','Europe/Berlin','Asia/Tokyo','Australia/Sydney','UTC'])];
      const firstDay=civil(new Date(Date.now()+oneDay)).day;
      block.innerHTML='<form data-create><div class="form-grid">'+
        '<label class="field wide">Room name<input name="title" required maxlength="64" placeholder="Tuesday night racing"></label>'+
        '<label class="field">Game<input name="game" list="night-games" required maxlength="48" placeholder="Choose or enter a game"></label><datalist id="night-games">'+options(games)+'</datalist>'+
        '<label class="field">Platform<select name="platform">'+options(platforms)+'</select></label>'+
        '<label class="field">Play style<select name="style">'+options(styles)+'</select></label>'+
        '<label class="field">Target players<input name="target" type="number" min="2" max="32" value="4" required></label>'+
        '<label class="field">First night<input name="firstDay" type="date" min="'+civil().day+'" value="'+firstDay+'" required></label>'+
        '<label class="field">Weekly start time<input name="time" type="time" value="20:00" required></label>'+
        '<label class="field wide">Time zone<select name="zone">'+options(zones,zone)+'</select></label></div>'+
        '<p><label><input type="checkbox" name="listed"> List this room in GameDay’s public game-night finder</label></p>'+
        '<p class="fine">Rooms start invite-only. Anyone who opens a room can see the RSVP display names. You can change public listing from this browser.</p>'+
        '<div class="row-actions"><button type="submit" class="dark-button">Create invite</button><button type="button" class="outline" data-back>Back</button></div><p class="error" role="status"></p></form>';
      block.querySelector('[data-back]').onclick=chooser;
      block.querySelector('form').onsubmit=async e=>{
        e.preventDefault();const form=e.currentTarget;
        const submit=form.querySelector('[type=submit]');if(submit.disabled)return;
        const data=Object.fromEntries(new FormData(form));data.target=Number(data.target);
        data.listed=form.elements.listed.checked;
        data.hostToken=hostToken;
        if(!put(ORGANIZER+id,hostToken)){tell('.error','Enable browser storage so you can manage this room’s listing.');return;}
        if(!data.title.trim()||!data.game.trim()){tell('.error','Enter a room name and a game.');return;}
        if(!dayPattern.test(data.firstDay)||!clockPattern.test(data.time)||instant(data.firstDay,data.time,data.zone)===null){tell('.error','Choose a local date and time that exists in this time zone.');return;}
        submit.disabled=true;tell('.error','Creating invite…');
        try {
          const payload=await request('POST',id,data);
          if(active()&&form.isConnected)await open(id,{room:payload.room,listed:data.listed});
        } catch(err){if(form.isConnected)tell('.error',message(err));}
        finally{submit.disabled=false;}
      };
    }
    function renderStandings(id,table){
      const region=block.querySelector('[data-standings]');
      if(!region)return;
      const isHost=validID(get(ORGANIZER+id,null));
      if(!table.rows.length && !isHost){region.replaceChildren();return;}
      const rows=table.rows.map((r,i,all)=>{
        const rank=all.findIndex(other=>other.points===r.points)+1;
        return '<tr><td>'+rank+'</td><td>'+text(r.alias)+'</td><td>'+r.points+'</td></tr>';
      }).join('');
      region.innerHTML='<h3 class="small-heading">Organizer-reported standings</h3>'+
        (rows?'<table><thead><tr><th>Rank</th><th>Player or team</th><th>Points</th></tr></thead><tbody>'+rows+'</tbody></table>':'<p class="fine">Publish the group’s points after a game night.</p>')+
        (isHost?'<details class="resource"><summary>Edit points</summary><form><label class="field">One player or team per line, followed by a comma and points<textarea name="scores" rows="5" maxlength="1600" placeholder="Player name, 3"></textarea></label><div class="row-actions"><button type="submit" class="dark-button">Save standings</button><button type="button" class="inline" data-reload>Reload saved table</button></div><p role="status" class="fine"></p></form></details>':'');
      if(!isHost)return;
      const form=region.querySelector('form');
      const note=form.querySelector('[role=status]');
      const editor=form.elements.scores;
      editor.value=table.rows.map(r=>r.alias+', '+r.points).join('\n');
      form.querySelector('[data-reload]').onclick=async()=>{
        try {const info=await request('GET',id);if(region.isConnected && id===roomId)renderStandings(id,info.standings);}
        catch(err){note.textContent=message(err);}
      };
      form.onsubmit=async e=>{
        e.preventDefault();const lines=editor.value.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
        const entries=[];
        for(const line of lines){
          const match=/^(.{1,32}),\s*(\d{1,6})$/.exec(line);
          if(!match){note.textContent='Use a display name, a comma, and whole points on each line.';return;}
          entries.push({alias:match[1].trim(),points:Number(match[2])});
        }
        const submit=form.querySelector('[type=submit]');submit.disabled=true;note.textContent='Saving…';
        try{
          const result=await request('PATCH',id,{action:'standings',hostToken:get(ORGANIZER+id,null),version:table.version,rows:entries});
          if(region.isConnected && id===roomId)renderStandings(id,result.standings);
        }catch(err){note.textContent=message(err);}
        finally{submit.disabled=false;}
      };
    }
    async function open(id,known){
      const revision=++rosterVersion;
      roomId=id;
      replaceInvite(id);
      block.innerHTML='<p role="status">Opening game night…</p>';
      try {
        const info=known || await request('GET',id);
        const current=info.room;
        if(!active()||rosterVersion!==revision)return;
        room=current;remember(id,current);
        const sessions=nextSessions(room);
        sessionDay=sessions[0].day;
        const rows=sessions.map(({day,at})=>'<option value="'+day+'">'+text(formatSession(at))+'</option>').join('');
        const day=datestring(room.firstDay,{weekday:'long'});
        block.innerHTML='<article class="resource"><div class="meta">'+text(room.platform)+' · '+text(room.style)+'</div>'+
          '<h3>'+text(room.title)+'</h3><p>'+text(room.game)+' · '+room.target+' players wanted</p><p>Every '+day+' at '+text(room.time)+' ('+text(room.zone)+').</p>'+
          '<label class="field">Invite link<input type="url" name="share" readonly value="'+text(invite(id))+'"></label><div class="row-actions"><button type="button" class="outline" data-copy>Copy invite</button><button type="button" class="inline" data-back>All my rooms</button></div><p data-share-note role="status" class="fine"></p></article>'+
          (validID(get(ORGANIZER+id,null))?'<details class="resource"><summary>Organizer settings</summary><p class="fine" data-visibility></p><button class="outline" type="button" data-toggle-listing></button></details>':'')+
          '<label class="field">Session in your time zone<select name="session">'+rows+'</select></label>'+
          '<div data-roster aria-live="polite"></div><section data-standings></section>';
        renderStandings(id,info.standings||{rows:[],version:null});
        const toggle=block.querySelector('[data-toggle-listing]');
        if(toggle) {
          let listed=Boolean(info.listed);
          const state=()=>{tell('[data-visibility]',listed?'Anyone can find this room in the public finder.':'Only people with the invite link can find this room.');toggle.textContent=listed?'Remove public listing':'List room publicly';};
          state();
          toggle.onclick=async()=>{
            toggle.disabled=true;
            try{const result=await request('PATCH',id,{hostToken:get(ORGANIZER+id,null),listed:!listed});listed=result.listed;state();}
            catch(err){tell('[data-visibility]',message(err));}finally{toggle.disabled=false;}
          };
        }
        block.querySelector('[data-copy]').onclick=async()=>{
          const input=block.querySelector('[name=share]');
          try{await navigator.clipboard.writeText(input.value);tell('[data-share-note]','Invite copied.');}
          catch{input.select();tell('[data-share-note]','Select and copy the invite link.');}
        };
        block.querySelector('[data-back]').onclick=chooser;
        block.querySelector('[name=session]').onchange=e=>{sessionDay=e.target.value;refresh();};
        await refresh();
      } catch(err){
        if(active()&&roomId===id) {
          block.innerHTML='<p class="error" role="status">'+text(message(err))+'</p><div class="row-actions"><button class="outline" data-retry>Retry</button><button class="inline" data-back>All my rooms</button></div>';
          block.querySelector('[data-retry]').onclick=()=>open(id);
          block.querySelector('[data-back]').onclick=chooser;
        }
      }
    }
    async function refresh(){
      const revision=++rosterVersion;
      const dest=block.querySelector('[data-roster]');
      dest.innerHTML='<p role="status">Loading this session’s lineup…</p>';
      try{
        const {people}=await request('GET',roomId,{day:sessionDay});
        if(active()&&revision===rosterVersion)lineup(people);
      }catch(err){
        if(active()&&revision===rosterVersion) {
          dest.innerHTML='<p class="error" role="status">'+text(message(err))+'</p><button class="outline" data-refresh>Reload lineup</button>';
          dest.querySelector('button').onclick=refresh;
        }
      }
    }
    function lineup(people){
      const dest=block.querySelector('[data-roster]');
      const playing=people.filter(p=>p.status==='Playing').length;
      const subs=people.filter(p=>p.status==='Available as a sub').length;
      const memory=get(PLAYER+roomId,{}) || {};
      const day=sessionDay, id=roomId;
      dest.innerHTML='<h3 class="small-heading">Session lineup</h3><p><strong>'+playing+' of '+room.target+' target players</strong> · '+subs+' available as '+(subs===1?'a sub':'subs')+'</p>'+
        (people.length?'<ul>'+people.map(p=>'<li>'+text(p.alias)+' · '+text(p.status)+'</li>').join('')+'</ul>':'<p>No one has responded for this session yet.</p>')+
        '<form data-rsvp class="resource"><div class="form-grid"><label class="field">Display name<input required maxlength="32" name="alias" autocomplete="off" value="'+text(memory.alias||'')+'"></label>'+
        '<label class="field">Your response<select name="status">'+options(statuses,memory.days?.[day])+'</select></label></div>'+
        '<div class="row-actions"><button type="submit" class="dark-button">Save my RSVP</button><button class="inline" data-refresh type="button">Refresh lineup</button></div><p class="fine">Update your response from this browser. The group can see your display name and response.</p><p role="status" data-vote-note></p></form>';
      dest.querySelector('[data-refresh]').onclick=refresh;
      dest.querySelector('form').onsubmit=async e=>{
        e.preventDefault();
        const form=e.currentTarget,submit=form.querySelector('[type=submit]');
        if(submit.disabled)return;
        const data=Object.fromEntries(new FormData(form));
        if(!data.alias.trim()){tell('[data-vote-note]','Enter a display name.');return;}
        let saved=get(PLAYER+id,{})||{};
        if(!validID(saved.token)){
          saved={token:crypto.randomUUID(),days:{}};
          if(!put(PLAYER+id,saved)){tell('[data-vote-note]','Enable browser storage so you can change your RSVP on this device.');return;}
        }
        submit.disabled=true;tell('[data-vote-note]','Saving…');
        const revision=++rosterVersion;
        try {
          const {people:nextPeople}=await request('PUT',id,{...data,day,token:saved.token});
          const fresh=get(PLAYER+id,saved)||saved;
          put(PLAYER+id,{...fresh,alias:data.alias.trim(),days:{...fresh.days,[day]:data.status}});
          if(active()&&revision===rosterVersion){lineup(nextPeople);tell('[data-vote-note]','RSVP saved for this session.');}
        } catch(err){if(active()&&revision===rosterVersion)tell('[data-vote-note]',message(err));}
        finally{submit.disabled=false;}
      };
    }
    const fromURL=new URL(location.href).searchParams.get('night');
    if(validID(fromURL))open(fromURL);else chooser();
  }
  window.GameDayTools.gaming=tool;
})();
