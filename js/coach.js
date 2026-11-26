'use strict';

const GameDayCoach = (() => {
  const topics = {
    attend: { match:/\b(watch|attend|tickets?|outing|stadium|spectate)\b/i, label:'Build an outing', answer:'Choose a date and group size to compare nearby games. Each outing links to the organizer so you can check the details before heading out.' },
    gaming: { match:/\b(esports?|gaming|video games?|game night|xbox|playstation|rocket league|fortnite)\b/i, label:'Find a game night', answer:'Pick your game, platform and weekly availability. You can join a listed group or invite friends to a private room.' },
    gear: { match:/\b(gear|equipment|gloves?|bat|jersey|cards?|collectibles?|locker|memorabilia)\b/i, label:'Open gear & collectibles', answer:'Use the locker to record equipment, sizes and trade plans, or attach a game-day memory to a collectible.' },
    betting: { match:/\b(bet|bets|betting|wager|spread|parlay|moneyline)\b/i, label:'Explore betting rules · 21+', answer:'If you’re 21 or older, pick a hypothetical scenario to see how a change in the game affects settlement.' },
    play: { match:/\b(play|try|learn|leagues?|practice|clinics?|courts?|rinks?|train|join|lessons?|camps?)\b/i, label:'Find a place to play', answer:'Start with your ZIP and choose how far you want to travel. Compare first-session details and check the organizer’s link for current times.' }
  };
  const sports = [...new Set([...FIELD_GUIDE.flatMap(row=>row.sport.split(' / ')), 'Disc golf','Pickleball','Figure skating','Tennis','Hockey','Basketball','Baseball','Soccer','Fishing'])].sort((a,b)=>b.length-a.length);
  const history = [];
  const element = (tag,text,cls) => {
    const node=document.createElement(tag);
    if(text) node.textContent=text;
    if(cls) node.className=cls;
    return node;
  };
  function help(name) {
    const section=element('details',null,'coach-help');
    section.append(element('summary','Coach’s tip'),element('p',topics[name].answer));
    return section;
  }
  function respond(question) {
    const sport=sports.find(name=>question.toLowerCase().includes(name.toLowerCase())) || '';
    const topic=Object.keys(topics).find(key=>topics[key].match.test(question));
    if(topic) return {question,answer:topics[topic].answer,choices:[topic],sport};
    if(sport) return {question,answer:'Do you want to play '+sport+' or go see a game?',choices:['play','attend'],sport};
    return {question,answer:'Which part would you like a hand with? Choose a starting point below.',choices:Object.keys(topics),sport:''};
  }
  function choices(turn) {
    const row=element('div',null,'coach-choices');
    for(const key of turn.choices) {
      const button=element('button',topics[key].label,'outline');
      button.dataset.tool=key;
      button.dataset.subject=turn.sport;
      row.append(button);
    }
    return row;
  }
  function chat(body,initial) {
    body.replaceChildren();
    const log=element('div',null,'coach-thread');
    log.setAttribute('role','log');
    function draw(turn) {
      const reply=element('div',null,'coach-turn');
      reply.append(element('strong','Coach'),element('p',turn.answer),choices(turn));
      if(turn.question) log.append(element('p',turn.question,'coach-you'));
      log.append(reply);
    }
    function ask(question) {
      const turn=respond(question);
      history.push(turn);
      draw(turn);
    }
    if(!history.length && !initial) draw({answer:'What are you looking to do today?',choices:['play','attend','gaming'],sport:''});
    history.forEach(draw);
    const form=element('form',null,'coach-input');
    const input=element('input');
    input.setAttribute('aria-label','Ask Coach a question');
    input.placeholder='Ask about a sport or activity';
    input.maxLength=260;
    input.required=true;
    form.append(input,element('button','Ask'));
    form.addEventListener('submit',event=>{
      event.preventDefault();
      if(!input.value.trim()) return;
      ask(input.value.trim());
      input.value='';
      input.focus();
      form.scrollIntoView({block:'nearest'});
    });
    body.append(log,form);
    if(initial) ask(initial);
    input.focus();
  }
  return {chat,help};
})();
