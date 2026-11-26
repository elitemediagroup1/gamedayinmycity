import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDay = /^\d{4}-\d{2}-\d{2}$/;
const platforms = ['PC', 'Xbox', 'PlayStation', 'Nintendo', 'Mobile', 'Cross-platform'];
const styles = ['Casual', 'Competitive', 'Learning together'];
const statuses = ['Playing', 'Available as a sub', 'Out this week'];
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const clean = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max && !/[\u0000-\u001f\u007f]/.test(value);

function response(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}

function validDay(day) {
  if (!isoDay.test(day)) return false;
  const date = new Date(day + 'T00:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0,10) === day;
}

function validateRoom(input) {
  const { title, game, platform, style, time, zone, firstDay, target } = input;
  if (!clean(title, 64) || !clean(game, 48) || !platforms.includes(platform) || !styles.includes(style)) {
    throw fail('Enter a group name, game, platform and play style.');
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !validDay(firstDay) || !clean(zone, 80)) throw fail('Choose a valid first date, time and time zone.');
  try { new Intl.DateTimeFormat('en', { timeZone: zone }); } catch { throw fail('Choose a valid time zone.'); }
  const daysAhead = (Date.parse(firstDay + 'T00:00:00Z') - Date.now()) / 86400000;
  if (daysAhead < -2 || daysAhead > 366) throw fail('Choose a first night in the coming year.');
  if (!Number.isInteger(target) || target < 2 || target > 32) throw fail('Choose a target between 2 and 32 players.');
  return { title: title.trim(), game: game.trim(), platform, style, time, zone, firstDay, target };
}

function validateOccurrence(room, day) {
  if (!validDay(day)) throw fail('Choose a valid session.');
  const elapsedDays = (Date.parse(day+'T00:00:00Z') - Date.parse(room.firstDay+'T00:00:00Z')) / 86400000;
  if (elapsedDays < 0 || elapsedDays % 7 !== 0 || Date.parse(day+'T00:00:00Z') > Date.now()+370*86400000) throw fail('Choose an upcoming session for this room.');
}

function voterKey(room, secret) {
  if (!uuid.test(secret)) throw fail('Reopen this invite in the same browser to update your RSVP.');
  return createHash('sha256').update(room + '/' + secret).digest('hex');
}

async function getRoom(store, id) {
  const room = await store.get(id + '/room', { type: 'json' });
  if (!room) throw fail('This invite is unavailable. Check the link with the host.', 404);
  return room;
}

function publicInfo(room) {
  const { ownerHash, ...info } = room;
  return info;
}

async function publicDirectory(store, after) {
  if (after && !uuid.test(after)) throw fail('Invalid directory page.');
  const entries = await store.list({prefix:'directory/'});
  const keys = entries.blobs.map(e=>e.key.slice('directory/'.length)).filter(id=>uuid.test(id) && (!after || id>after)).sort();
  const batch = keys.slice(0,40);
  const docs = await Promise.all(batch.map(id=>store.get('directory/'+id,{type:'json'})));
  return { rooms:docs.filter(doc=>doc?.listed===true).map(({listed,...room})=>room), after:keys.length>batch.length?batch[batch.length-1]:null };
}

const standingsKey = id => id+'/standings';
async function standingTable(store,id) {
  const existing=await store.getWithMetadata(standingsKey(id),{type:'json'});
  return existing?{rows:existing.data,version:existing.etag}:{rows:[],version:null};
}

function checkedScores(list) {
  if (!Array.isArray(list) || list.length>32) throw fail('Enter at most 32 standings.');
  const names=new Set();
  return list.map(entry=>{
    if (!entry || !clean(entry.alias,32) || !Number.isInteger(entry.points) || entry.points<0 || entry.points>999999) {
      throw fail('Use a display name and a whole number from 0 to 999999 for each score.');
    }
    const alias=entry.alias.trim();
    const canonical=alias.toLowerCase();
    if (names.has(canonical)) throw fail('Give each player or team a distinct display name.');
    names.add(canonical);
    return {alias,points:entry.points};
  }).sort((a,b)=>b.points-a.points || a.alias.localeCompare(b.alias));
}

async function roster(store, id, day) {
  const votes = await store.list({ prefix: id + '/' + day + '/' });
  const people = await Promise.all(votes.blobs.map(({key}) => store.get(key,{type:'json'})));
  return people.filter(Boolean).map(({alias, status}) => ({alias, status})).sort((a,b) => a.alias.localeCompare(b.alias));
}

// Each browser's response is its own object. A second player can never overwrite it.
async function serve(req, context, openStore = getStore) {
  try {
    const method = req.method;
    if (!['GET','POST','PUT','PATCH'].includes(method)) return response({error:'Unsupported request.'},405);
    const params = new URL(req.url).searchParams;
    let input = {};
    if (method !== 'GET') {
      if (!req.headers.get('content-type')?.startsWith('application/json')) throw fail('Expected JSON.',415);
      const origin = req.headers.get('origin');
      if (origin && origin !== new URL(req.url).origin) throw fail('Open GameDay to update a game night.',403);
      const raw = await req.text();
      if (raw.length>2500) throw fail('Request too large.',413);
      try { input=JSON.parse(raw); } catch { throw fail('Invalid request.'); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail('Invalid request.');
    }
    const id = method==='GET' ? params.get('id') : input.id;
    const contextTag = context.deploy?.context;
    const production = contextTag === 'production';
    const storeName = production ? 'game-nights-v1' : 'game-nights-preview-v1';
    const store = openStore({name:storeName, consistency:'strong'});
    if (method==='GET' && params.has('directory')) {
      return response(await publicDirectory(store,params.get('after')));
    }
    if (!uuid.test(id)) throw fail('Invalid game night link.');
    if (method==='POST') {
      const room = validateRoom(input);
      if (!uuid.test(input.hostToken)) throw fail('Create the invite from this browser again.');
      const stored = {...room,ownerHash:voterKey(id,input.hostToken)};
      const result = await store.setJSON(id+'/room',stored,{onlyIfNew:true});
      // The browser reuses the id when it retries after losing the response.
      if (!result.modified) {
        const existing = await getRoom(store,id);
        if (Object.keys(stored).some(key=>stored[key]!==existing[key])) throw fail('This group ID is already in use.',409);
      }
      if (input.listed===true) {
        await store.setJSON('directory/'+id,{id,...room,listed:true},{onlyIfNew:true});
      }
      return response({room},201);
    }
    const storedRoom = await getRoom(store,id);
    const room = publicInfo(storedRoom);
    if (method==='PATCH') {
      if (!uuid.test(input.hostToken) || voterKey(id,input.hostToken)!==storedRoom.ownerHash) throw fail('Only this room’s organizer can change these settings.',403);
      if (input.action==='standings') {
        const rows=checkedScores(input.rows);
        if (input.version!==null && !clean(input.version,150)) throw fail('Reload the standings and retry.');
        const guard=input.version===null?{onlyIfNew:true}:{onlyIfMatch:input.version};
        const write=await store.setJSON(standingsKey(id),rows,guard);
        if (!write.modified) {
          const latest = await standingTable(store,id);
          if (JSON.stringify(latest.rows)===JSON.stringify(rows)) return response({standings:latest});
          throw fail('The standings have changed. Reload the saved table before editing.',409);
        }
        return response({standings:{rows,version:write.etag}});
      }
      if (typeof input.listed!=='boolean') throw fail('Choose a listing setting.');
      await store.setJSON('directory/'+id,input.listed?{id,...room,listed:true}:{listed:false});
      return response({listed:input.listed});
    }
    const day = method==='GET' ? params.get('day') : input.day;
    if (method==='GET' && !day) {
      const listing = await store.get('directory/'+id,{type:'json'});
      return response({room,listed:listing?.listed===true,standings:await standingTable(store,id)});
    }
    validateOccurrence(room,day);
    if (method==='PUT') {
      if (Date.parse(day+'T00:00:00Z') < Date.now()-2*86400000) throw fail('This session is in the past.');
      if (!clean(input.alias,32) || !statuses.includes(input.status)) throw fail('Enter a display name and choose an RSVP.');
      const key = voterKey(id,input.token);
      await store.setJSON(id+'/'+day+'/'+key,{alias:input.alias.trim(),status:input.status});
    }
    return response({room,people:await roster(store,id,day)});
  } catch (error) {
    return response({error:error.status ? error.message : 'Shared game nights are unavailable right now. Please retry.'},error.status || 503);
  }
}

export default async function handler(req, context) { return serve(req, context); }
export { serve };
