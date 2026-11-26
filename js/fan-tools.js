'use strict';

(() => {
  const tools = window.GameDayTools ||= {};
  const html = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
  const getRoot = () => document.getElementById('tool-body');
  const rulesUrl = 'https://policies.fanduel.com/SB/NJ/2026-08-27T12-13-39.html';
  const cases = [
    {
      sport:'Hockey', market:'60-minute result', selection:'Harbor to win in regulation',
      score:'2 – 2', phase:'End of regulation', replay:'Harbor scores in overtime and wins the game 3–2.',
      answers:['Win','Loss','Push'], correct:1,
      reason:'The draw was a separate outcome in this three-way market. Harbor needed to lead after 60 minutes. The overtime goal came too late for this selection.',
      alternate:{market:'Full-game moneyline',selection:'Harbor to win, including overtime',correct:0,reason:'This two-way market includes overtime. Harbor’s winning goal settles the selection as a win.'}
    },
    {
      sport:'Football', market:'Full-game point spread', selection:'Harbor −3',
      score:'24 – 21', phase:'Final score', replay:'Harbor wins by three. The quoted spread gives the opposing team a three-point head start.',
      answers:['Win','Loss','Push'], correct:2,
      reason:'Subtract three from Harbor’s 24 points. The adjusted score is 21–21. In this two-way spread market, a push returns the stake.',
      alternate:{market:'Full-game point spread',selection:'Harbor −3.5',correct:1,reason:'Subtract 3.5 from Harbor’s 24. The adjusted score is 20.5–21, so Harbor falls half a point short.'}
    },
    {
      sport:'Baseball', market:'Pregame batter home-run prop', selection:'The listed batter to hit a home run',
      score:'BENCH', phase:'Starting lineup', replay:'The batter begins on the bench, enters as a pinch hitter, and hits a home run. The selected pregame market requires the batter to start.',
      answers:['Win','Loss','Void'], correct:2,
      reason:'The starting-lineup condition was never met. The selection is void even though the batter later homered.',
      alternate:{market:'Pregame batter home-run prop',selection:'Same batter, this time in the starting lineup',replay:'The batter starts the game, then hits a home run in the seventh inning.',score:'STARTER',correct:0,reason:'The starting-lineup condition is satisfied and the batter homers. Both requirements are met.'}
    }
  ];
  let ageConfirmed = false;
  function showLesson(root, lesson, changed = false) {
    const current = changed ? {...lesson,...lesson.alternate} : lesson;
    root.innerHTML = '<div class="fan-tool"><p>Make a call on a fictional play, then change one condition and see what happens.</p>'+
      '<div class="chips" aria-label="Choose a scenario">'+cases.map(item =>
        '<button class="chip" data-case="'+item.sport+'" aria-pressed="'+(item===lesson)+'">'+item.sport+'</button>').join('')+'</div>'+
      '<article class="fan-replay"><p class="eyebrow">'+html(current.market)+'</p><strong class="fan-score">'+html(current.score)+'</strong><p>'+html(current.phase)+'</p><p>'+html(current.replay)+'</p></article>'+
      '<h3 class="small-heading">How does this selection settle?</h3><p>'+html(current.selection)+'</p>'+
      '<div class="fan-answers">'+current.answers.map((answer,i)=>'<button class="outline" data-answer="'+i+'">'+answer+'</button>').join('')+'</div>'+
      '<div id="fan-feedback" aria-live="polite"></div>'+
      '<p class="fine">Examples follow the linked house rules. Market wording and operator rules can differ. <a target="_blank" rel="noopener" href="'+rulesUrl+'">Read the New Jersey house rules</a>.</p></div>';
    root.querySelectorAll('[data-case]').forEach(button=>button.onclick=()=>showLesson(root,cases.find(item=>item.sport===button.dataset.case)));
    root.querySelectorAll('[data-answer]').forEach(button=>button.onclick=()=>{
      const right=Number(button.dataset.answer)===current.correct;
      root.querySelectorAll('[data-answer]').forEach(option=>option.setAttribute('aria-pressed',String(option===button)));
      const feedback=root.querySelector('#fan-feedback');
      feedback.innerHTML='<div class="fan-response"><strong>'+html((right?'Correct. The result is ':'The result is ')+current.answers[current.correct].toLowerCase()+'.')+'</strong><p>'+html(current.reason)+'</p>'+
        '<button class="dark-button" data-variant>'+ (changed?'Replay original scenario':'Change one condition')+'</button></div>';
      feedback.querySelector('[data-variant]').onclick=()=>showLesson(root,lesson,!changed);
    });
  }
  tools.betting = () => {
    const root=getRoot();
    if(ageConfirmed){showLesson(root,cases[0]);return;}
    root.innerHTML='<div class="fan-tool"><h3 class="small-heading">Sports rules replay</h3><p>Practice grading fictional sports outcomes. This learning tool is for adults 21 and older.</p>'+
      '<button class="dark-button" id="fan-age">I am 21 or older</button> <button class="outline" id="fan-exit">Go back</button></div>';
    root.querySelector('#fan-age').onclick=()=>{ageConfirmed=true;showLesson(root,cases[0]);};
    root.querySelector('#fan-exit').onclick=()=>{const dialog=root.closest('dialog');if(dialog?.open)dialog.close();else root.innerHTML='<p>Rules replay closed.</p>';};
  };

  const prefix='gameday-fan-item-v1.';
  const memory=new Map();
  const types={
    gear:{
      tab:'Equipment', singular:'gear item', empty:'Keep track of fit, season and which items need attention.',
      fields:[
        ['title','Item name','text',true],['sport','Sport','text',true],['size','Current size','text'],
        ['season','Season','text'],['status','Next step',['Keep using','Check fit','Replace','Ready to trade','Traded']],
        ['note','Fit or trade notes','textarea']
      ]
    },
    collection:{
      tab:'Collections', singular:'collectible', empty:'Connect a ticket stub, jersey or card to a game you attended, or add something you want to find.',
      fields:[
        ['title','Collectible name','text',true],['sport','Sport','text',true],
        ['status','Collection status',['In my collection','Wishlist']],['event','Game or event','text'],
        ['date','Event date','date'],['note','Memory or wishlist notes','textarea']
      ]
    }
  };
  let volatile=false;
  function records() {
    try {
      if(!volatile){
        for(const id of [...memory.keys()]){if(!localStorage.getItem(prefix+id))memory.delete(id);}
        for(let i=0;i<localStorage.length;i++){
          const key=localStorage.key(i);
          if(!key?.startsWith(prefix))continue;
          const id=key.slice(prefix.length);
          try {
            const item=JSON.parse(localStorage.getItem(key));
            if(item&&Object.hasOwn(types,item.kind)&&typeof item.title==='string'&&typeof item.sport==='string'){
              memory.set(id,{...item,id});
            }
          } catch { /* Ignore incomplete entries from interrupted local storage. */ }
        }
      }
    } catch {volatile=true;}
    return [...memory.values()].sort((a,b)=>Number(b.updated)-Number(a.updated));
  }
  function persist(id,item) {
    try {
      if(item)localStorage.setItem(prefix+id,JSON.stringify(item));
      else localStorage.removeItem(prefix+id);
    } catch {volatile=true;}
    if(item)memory.set(id,item);else memory.delete(id);
  }
  function field([name,label,input,required],item) {
    const value=item[name]||'';
    let markup;
    if(Array.isArray(input))markup='<select name="'+name+'">'+input.map(opt=>'<option'+(value===opt?' selected':'')+'>'+html(opt)+'</option>').join('')+'</select>';
    else if(input==='textarea')markup='<textarea rows="3" name="'+name+'" maxlength="450">'+html(value)+'</textarea>';
    else markup='<input name="'+name+'" type="'+input+'" maxlength="100" value="'+html(value)+'"'+(required?' required':'')+'>';
    return '<label class="field'+(name==='note'?' wide':'')+'">'+label+(required||name==='status'?'':' <small>(optional)</small>')+markup+'</label>';
  }
  function edit(root,kind,item={}) {
    const cfg=types[kind];
    root.innerHTML='<div class="fan-tool"><h3 class="small-heading">'+(item.id?'Edit ':'Add ')+cfg.singular+'</h3><form><div class="form-grid">'+cfg.fields.map(f=>field(f,item)).join('')+'</div>'+
      '<div class="row-actions"><button class="dark-button" type="submit">Save '+cfg.singular+'</button><button type="button" class="outline" data-back>Cancel</button></div></form></div>';
    const form=root.querySelector('form');
    form.querySelector('[data-back]').onclick=()=>shelf(root,kind);
    form.onsubmit=e=>{
      e.preventDefault();
      const fields=Object.fromEntries([...new FormData(form)].map(([name,value])=>[name,value.trim()]));
      const missing=cfg.fields.find(([key,,,required])=>required&&!fields[key]);
      if(missing){const input=form.elements[missing[0]];input.setCustomValidity('Enter a value.');input.reportValidity();input.setCustomValidity('');return;}
      const id=item.id||crypto.randomUUID();
      persist(id,{...fields,id,kind,updated:Date.now()});
      shelf(root,kind,item.id?'Item updated.':'Item saved.');
    };
  }
  function shelf(root,kind,feedback='') {
    const items=records().filter(item=>item.kind===kind);
    const cfg=types[kind];
    const article=item=>{
      const labels=[item.sport,item.size&&'Size '+item.size,item.season,item.event,item.date].filter(Boolean);
      return '<article class="resource"><div class="meta">'+html(item.status)+'</div><h3>'+html(item.title)+'</h3>'+
        '<p>'+labels.map(html).join(' · ')+'</p>'+(item.note?'<p class="fan-note">'+html(item.note)+'</p>':'')+
        '<div class="row-actions"><button data-fan-edit="'+html(item.id)+'">Edit</button><button data-delete="'+html(item.id)+'">Remove</button></div></article>';
    };
    root.innerHTML='<div class="fan-tool"><div class="chips" aria-label="Locker sections">'+Object.entries(types).map(([id,meta])=>'<button class="chip" aria-pressed="'+(id===kind)+'" data-shelf="'+id+'">'+meta.tab+'</button>').join('')+'</div>'+
      '<p>'+cfg.empty+'</p><button class="dark-button" data-add>Add '+cfg.singular+'</button><p role="status" class="fine">'+html(feedback)+'</p>'+
      items.map(article).join('')+'<p class="fine">'+(volatile?'Browser storage is unavailable. Changes last for this visit.':'Saved in this browser on this device.')+'</p></div>';
    root.querySelectorAll('[data-shelf]').forEach(b=>b.onclick=()=>shelf(root,b.dataset.shelf));
    root.querySelector('[data-add]').onclick=()=>edit(root,kind);
    root.querySelectorAll('[data-fan-edit]').forEach(b=>b.onclick=()=>edit(root,kind,memory.get(b.dataset.fanEdit)));
    root.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{
      const item=memory.get(b.dataset.delete);
      const entry=b.closest('article');
      entry.innerHTML='<p>Remove <strong>'+html(item.title)+'</strong> from this device?</p><button class="dark-button" data-fan-confirm>Remove item</button> <button class="outline" data-back>Keep item</button>';
      entry.querySelector('[data-fan-confirm]').onclick=()=>{persist(item.id,null);shelf(root,kind,'Item removed.');};
      entry.querySelector('[data-back]').onclick=()=>shelf(root,kind);
    });
  }
  tools.gear=()=>shelf(getRoot(),'gear');
})();
