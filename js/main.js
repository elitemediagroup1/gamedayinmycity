(function(){
  "use strict";
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Mobile menu */
  var burger = document.getElementById('burger'), navMobile = document.getElementById('navMobile');
  burger.addEventListener('click', function(){ var o = navMobile.classList.toggle('open'); burger.setAttribute('aria-expanded', o); });
  navMobile.addEventListener('click', function(e){ if(e.target.tagName==='A'){ navMobile.classList.remove('open'); burger.setAttribute('aria-expanded', false); } });

  /* Ticker */
  var tickerData = [
    ['🏈 NFL','Eagles','24','Cowboys','20','up'],['⚾ MLB','Phillies','5','Mets','3','up'],
    ['🏀 NBA','Sixers','98','Celtics','101','dn'],['🏒 NHL','Flyers','2','Rangers','2',''],
    ['🎮 City Cup','Phantoms','2','Nightfall','1','up'],['🏆 HS FB','Northside','21','Westgate','17','up'],
    ['⚽ MLS','Union','1','NYCFC','1',''],['🥎 12U','Sluggers','7','Bandits','4','up']
  ];
  var track = document.getElementById('ticker'), html='';
  for(var p=0;p<2;p++){ tickerData.forEach(function(d){
    var cls = d[5]==='up'?'up':(d[5]==='dn'?'dn':'');
    html += '<span class="item">'+d[0]+' <b>'+d[1]+'</b> '+d[2]+' — <b>'+d[3]+'</b> '+d[4]+
            ' <span class="'+cls+'">'+(d[5]==='up'?'▲':(d[5]==='dn'?'▼':'•'))+'</span></span>';
  }); }
  track.innerHTML = html;

  /* Count-up */
  function countUp(el){ var t=+el.getAttribute('data-count'),dur=1400,t0=null;
    function step(ts){ if(!t0)t0=ts; var pr=Math.min((ts-t0)/dur,1),e=1-Math.pow(1-pr,3);
      el.textContent=Math.floor(e*t).toLocaleString(); if(pr<1)requestAnimationFrame(step); }
    if(reduce){ el.textContent=t.toLocaleString(); } else requestAnimationFrame(step);
  }
  var counted=false;
  window.addEventListener('load', function(){ setTimeout(function(){ if(counted)return; counted=true;
    document.querySelectorAll('[data-count]').forEach(countUp); }, 350); });

  /* Reveal */
  if('IntersectionObserver' in window && !reduce){
    var io=new IntersectionObserver(function(es){ es.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } }); },{threshold:.12,rootMargin:'0px 0px -8% 0px'});
    document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
  } else { document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('in'); }); }

  /* Search focus + rotating placeholder */
  var search=document.getElementById('hero-search'), si=document.getElementById('searchInput');
  si.addEventListener('focus',function(){ search.classList.add('focus'); });
  si.addEventListener('blur',function(){ search.classList.remove('focus'); });
  var ph=['Find teams, leagues, games, facilities, tickets, gear…','Try "12U baseball tournaments near me"…','Try "Eagles tickets under $150"…','Try "livestream tonight\'s game"…','Try "best youth catcher\'s mitt"…'], pi=0;
  if(!reduce){ si.style.transition='opacity .25s';
    setInterval(function(){ if(document.activeElement===si)return; pi=(pi+1)%ph.length; si.style.opacity='0';
      setTimeout(function(){ si.placeholder=ph[pi]; si.style.opacity='1'; },220); },3600);
  }

  /* Live score card */
  var aE=document.getElementById('awayScore'),hE=document.getElementById('homeScore'),
      bug=document.getElementById('bugClock'),lbl=document.getElementById('leagueLabel');
  var games=[{l:'HS Football · Q3',a:21,h:17,an:'Northside',hn:'Westgate'},{l:'12U Baseball · T6',a:7,h:4,an:'Sluggers',hn:'Bandits'},
             {l:'NBA · Q4',a:98,h:101,an:'Sixers',hn:'Celtics'},{l:'City Cup · Map 3',a:2,h:1,an:'Phantoms',hn:'Nightfall'}];
  function flash(el){ el.classList.add('flash'); setTimeout(function(){ el.classList.remove('flash'); },600); }
  if(!reduce){
    setInterval(function(){ if(Math.random()>.5){ aE.textContent=(+aE.textContent+(Math.random()>.6?3:1)); flash(aE); }
      else { hE.textContent=(+hE.textContent+(Math.random()>.6?2:1)); flash(hE); } },4200);
    var gi=0; setInterval(function(){ gi=(gi+1)%games.length; var g=games[gi];
      lbl.textContent=g.l; document.getElementById('awayName').textContent=g.an; document.getElementById('homeName').textContent=g.hn;
      aE.textContent=g.a; hE.textContent=g.h; flash(aE); flash(hE); },9000);
  }

  /* Viewer count */
  var vc=document.getElementById('viewerCount'), viewers=1284;
  if(!reduce){ setInterval(function(){ viewers+=Math.floor(Math.random()*40)-14; if(viewers<800)viewers=800+Math.floor(Math.random()*60); vc.textContent=viewers.toLocaleString(); },2500); }

  /* Clock */
  if(!reduce){ var secs=7*60+42; setInterval(function(){ secs-=13; if(secs<0)secs=11*60+30; var m=Math.floor(secs/60),s=secs%60; bug.textContent=(m<10?'0':'')+m+':'+(s<10?'0':'')+s+' Q3'; },1000); }

  /* Odds flicker */
  var ov=document.getElementById('oddsVal'), os=['-135','-130','-142','-128'], oi=0;
  if(!reduce){ setInterval(function(){ oi=(oi+1)%os.length; ov.textContent=os[oi]; },3800); }

  /* Tabs */
  var tabs=document.querySelectorAll('.tab');
  tabs.forEach(function(tab){ tab.addEventListener('click',function(){
    tabs.forEach(function(t){ t.setAttribute('aria-selected','false'); }); tab.setAttribute('aria-selected','true');
    document.querySelectorAll('.tabpanel').forEach(function(pn){ pn.classList.remove('active'); });
    document.getElementById('panel-'+tab.getAttribute('data-tab')).classList.add('active');
  }); });

  /* Cities */
  var cities=[{n:'Philadelphia',p:'pn-stadium',teams:42,leagues:128,fac:310},{n:'New York',p:'pn-arena',teams:88,leagues:240,fac:620},
    {n:'Dallas',p:'pn-court',teams:51,leagues:160,fac:410},{n:'Los Angeles',p:'pn-field',teams:74,leagues:205,fac:540},
    {n:'Boston',p:'pn-stadium',teams:38,leagues:112,fac:280},{n:'Chicago',p:'pn-arena',teams:60,leagues:178,fac:470}];
  var tagSet=['Teams','Leagues','Facilities','Live','Tickets','Gear'];
  document.getElementById('cityGrid').innerHTML = cities.map(function(c){
    var tags=tagSet.map(function(t){ return '<span class="badge">'+t+'</span>'; }).join('');
    var nameColor = c.p==='pn-field' ? 'var(--ink)' : '#fff';
    return '<article class="card city"><div class="panel '+c.p+' top sweep">'+
      '<span class="badge live live"><span class="dot"></span> '+(2+Math.floor(Math.random()*9))+' LIVE</span>'+
      '<div class="name" style="color:'+nameColor+'">'+c.n+'</div></div>'+
      '<div class="body"><div class="stats">'+
      '<div><b>'+c.teams+'</b><span>Teams</span></div><div><b>'+c.leagues+'</b><span>Leagues</span></div><div><b>'+c.fac+'</b><span>Facilities</span></div>'+
      '</div><div class="tags">'+tags+'</div></div></article>';
  }).join('');

  /* Coach chat */
  var chatBody=document.getElementById('chatBody'),chatForm=document.getElementById('chatForm'),chatInput=document.getElementById('chatInput');
  var answers={
    'find 12u baseball tournaments near me':{t:"Found 4 sanctioned 12U tournaments near Philadelphia this month:",links:[['Spring Slam Classic · Sat 9AM','3 mi'],['River City Showcase · Sun','12 mi'],['Liberty Bell 12U Open','18 mi']]},
    'best glove for a 10-year-old shortstop':{t:"For a 10-year-old shortstop, go 11\"–11.5\" with a quick-close web. Top picks:",links:[['Youth Infield Glove 11.25"','$89'],['Pro Series 11.5" I-Web','$129'],['Lightweight Trainer 11"','$64']]},
    'where can i livestream tonight\'s game?':{t:"Tonight in your city, 3 games are streaming live on GameDay Live:",links:[['Northside vs Westgate · Football','LIVE'],['Sixers vs Celtics · Watch party','7:30 PM'],['City Cup Finals · Esports','LIVE']]},
    'create a highlight reel from last weekend':{t:"On it ✨ I pulled 9 AI-tagged plays from Saturday's 12U game. Building your reel:",links:[['Top 9 plays · 1:42 reel','Render'],['Add player name overlay','Edit'],['Share to recruiting page','Send']]},
    'find eagles tickets under $150':{t:"Found 6 verified Eagles seats under $150, compared across box offices:",links:[['Upper Level · 2 together','$118'],['End Zone · aisle','$134'],['Lower corner · single','$149']]}
  };
  function addMsg(text,who,links){
    var div=document.createElement('div'); div.className='msg '+who; div.textContent=text;
    if(links){ var res=document.createElement('div'); res.className='res';
      links.forEach(function(l){ var a=document.createElement('a'); a.href='#'; a.innerHTML='<span>'+l[0]+'</span><span class="tag">'+l[1]+'</span>'; res.appendChild(a); });
      div.appendChild(res); }
    chatBody.appendChild(div); chatBody.scrollTop=chatBody.scrollHeight; return div;
  }
  function botReply(q){
    var ans=answers[q.toLowerCase().trim()];
    var typing=document.createElement('div'); typing.className='msg bot'; typing.innerHTML='<span class="typing"><i></i><i></i><i></i></span>';
    chatBody.appendChild(typing); chatBody.scrollTop=chatBody.scrollHeight;
    setTimeout(function(){ chatBody.removeChild(typing);
      if(ans){ addMsg(ans.t,'bot',ans.links); }
      else { addMsg("Great question! In the live product, Coach searches your city's teams, schedules, gear deals and tickets to answer that instantly. Try one of the suggested prompts above 👆",'bot'); }
    }, reduce?200:950);
  }
  function ask(q){ if(!q)return; addMsg(q,'user'); botReply(q); }
  document.getElementById('prompts').addEventListener('click',function(e){
    var b=e.target.closest('.prompt'); if(b){ ask(b.getAttribute('data-q'));
      document.getElementById('coach-chat').scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'}); } });
  chatForm.addEventListener('submit',function(){ var v=chatInput.value.trim(); if(!v)return; chatInput.value=''; ask(v); });
})();


/* ===================== ELEVATION LAYER: live energy + Coach presence ===================== */
(function(){
  "use strict";
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // staggered reveals on key grids
  ['hub-grid','shop-grid','city-grid','partner-grid','win-grid','game-strip','live-feats'].forEach(function(c){
    document.querySelectorAll('.'+c+'.reveal').forEach(function(el){ el.classList.add('stg'); });
  });

  // live kickoff countdown to tonight 8:00 PM (loops to next day)
  var kc = document.getElementById('kickoffCount');
  if(kc){
    var pad=function(n){ return (n<10?'0':'')+n; };
    var tick=function(){
      var now=new Date(), t=new Date(); t.setHours(20,0,0,0);
      if(t<=now) t.setDate(t.getDate()+1);
      var d=Math.max(0,Math.floor((t-now)/1000));
      kc.textContent = Math.floor(d/3600)+':'+pad(Math.floor((d%3600)/60))+':'+pad(d%60);
    };
    tick(); setInterval(tick,1000);
  }

  // Coach floating tip — small, rotating, dismissible
  var fab=document.getElementById('coachFab'), tip=document.getElementById('cfTip'), x=document.getElementById('cfX');
  if(fab && tip && x){
    var tips=[
      "Northside is 5–0 at home this season.",
      "New: 9 AI highlights from Saturday's 12U game.",
      "Eagles ML is best-priced at -135 right now.",
      "3 games near you are streaming live tonight.",
      "Found Eagles seats under $150 — want them?",
      "12U Spring Slam tournament is just 3 miles away."
    ];
    var i=0, dismissed=false;
    setTimeout(function(){ if(!dismissed) fab.hidden=false; }, 3000);
    setInterval(function(){
      if(dismissed || fab.hidden) return;
      i=(i+1)%tips.length;
      if(reduce){ tip.textContent=tips[i]; return; }
      tip.style.opacity='0';
      setTimeout(function(){ tip.textContent=tips[i]; tip.style.opacity='1'; }, 300);
    }, 9000);
    x.addEventListener('click', function(){ dismissed=true; fab.hidden=true; });
  }
})();


/* ===================== TOP STATES EXPLORER ===================== */
(function(){
  "use strict";
  var STATES = window.GDIMC_STATES || [];
  var rail = document.getElementById('stateRail');
  var detail = document.getElementById('stateDetail');
  if(!rail || !detail) return;

  function dotColor(c){ return c==='legal' ? 'var(--neon)' : (c==='limited' ? 'var(--amber)' : '#cf6b6b'); }
  function betClass(c){ return c==='legal' ? 'bet-legal' : (c==='limited' ? 'bet-limited' : 'bet-no'); }
  function facet(ic,label,n,txt){
    return '<div class="facet-card"><div class="fc-h"><span class="fc-ic">'+ic+'</span>'+label+
      (n ? '<span class="fc-n">'+n+'</span>' : '')+'</div><p>'+txt+'</p></div>';
  }
  function facetBet(b){
    return '<div class="facet-card facet-bet '+betClass(b.cls)+'"><div class="fc-h"><span class="fc-ic">\uD83D\uDCB0</span>Sports Betting'+
      '<span class="fc-pill">'+b.label+'</span></div><p>'+b.note+'</p></div>';
  }
  function renderDetail(s){
    var html = '<div class="sd-head">'
      + '<div class="sd-flag">'+s.ab+'</div>'
      + '<div class="sd-titles"><h3>'+s.name+'</h3><div class="sd-tag">'+s.tag+'</div></div>'
      + '<span class="badge '+betClass(s.bet.cls)+' sd-bet">\u25CF '+s.bet.label+'</span>'
      + '</div>'
      + '<div class="sd-coach"><span class="sd-cav">C</span><span><b>Coach:</b> '+s.coach+'</span></div>'
      + '<div class="sd-cities">'+ s.cities.map(function(c){ return '<span class="chip-city">\uD83D\uDCCD '+c+'</span>'; }).join('') +'</div>'
      + '<div class="sd-facets">'
      + facet('\uD83C\uDFDF','Pro Teams', s.pro.n, s.pro.txt)
      + facet('\uD83C\uDF93','College', null, s.college)
      + facet('\uD83C\uDFEB','High School', null, s.hs)
      + facetBet(s.bet)
      + facet('\uD83C\uDFAE','Gaming & EA Sports', null, s.gaming)
      + '</div>';
    detail.classList.remove('sd-in');
    detail.innerHTML = html;
    void detail.offsetWidth;
    detail.classList.add('sd-in');
  }

  rail.innerHTML = STATES.map(function(s,i){
    return '<button class="state-btn" role="tab" aria-selected="'+(i===0)+'" data-i="'+i+'">'
      + '<span class="ab">'+s.ab+'</span>'
      + '<span class="nm-wrap"><span class="nm">'+s.name+'</span><span class="sub">'+s.tag+'</span></span>'
      + '<span class="bdot" style="background:'+dotColor(s.bet.cls)+'"></span></button>';
  }).join('');

  rail.addEventListener('click', function(e){
    var b = e.target.closest('.state-btn'); if(!b) return;
    rail.querySelectorAll('.state-btn').forEach(function(x){ x.setAttribute('aria-selected','false'); });
    b.setAttribute('aria-selected','true');
    renderDetail(STATES[+b.getAttribute('data-i')]);
  });

  renderDetail(STATES[0]);
})();
