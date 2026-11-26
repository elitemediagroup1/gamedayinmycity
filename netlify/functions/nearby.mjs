// Only the server calls paid providers. Set provider keys in the Netlify environment.
const RADII = [5, 10, 20, 30];
export const config = {
  path: "/api/discover-nearby",
  rateLimit: { windowLimit: 12, windowSize: 60, aggregateBy: ["ip", "domain"] }
};

function reply(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

function milesBetween(lat, lon, lat2, lon2) {
  const rad = Math.PI / 180;
  const chord = Math.sin((lat2 - lat) * rad / 2) ** 2
    + Math.cos(lat * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon) * rad / 2) ** 2;
  return 7917.52 * Math.asin(Math.sqrt(Math.min(1, chord)));
}

async function googlePlaces({lat, lon, miles, mode, sport}) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return { status: "unconfigured", rows: [] };
  const circle = { center: { latitude: lat, longitude: lon }, radius: miles * 1609.344 };
  const typed = Boolean(sport);
  const requestBody = typed
    ? { textQuery: sport + (mode === "play" ? " facilities or clubs" : " arenas or sports venues"), locationBias: { circle }, pageSize: 12 }
    : { includedTypes: mode === "play" ? ["sports_complex", "sports_club", "sports_activity_location", "sports_coaching", "golf_course", "ice_skating_rink", "tennis_court"] : ["stadium", "arena"], locationRestriction: { circle }, rankPreference: "DISTANCE", maxResultCount: 12 };
  const method = typed ? "searchText" : "searchNearby";
  const response = await fetch("https://places.googleapis.com/v1/places:" + method, {
    method: "POST", signal: AbortSignal.timeout(6000),
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.displayName,places.location,places.formattedAddress,places.googleMapsUri,places.attributions" },
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) throw Error("Places unavailable");
  const { places = [] } = await response.json();
  const rows = places.filter(p => p.displayName?.text && p.googleMapsUri && p.location)
    .map(p => ({
      name: p.displayName.text, address: p.formattedAddress || "", url: p.googleMapsUri,
      providerPoint: [p.location.latitude,p.location.longitude], miles: milesBetween(lat, lon, p.location.latitude, p.location.longitude),
      credits: (p.attributions || []).filter(a => a.provider).map(a => ({ name: a.provider, url: a.providerUri || "" }))
    })).filter(p => p.miles <= miles).sort((a,b) => a.miles - b.miles);
  return { status: "ready", rows };
}

async function ticketEvents({lat, lon, miles, sport, day}) {
  const key = process.env.TICKETMASTER_DISCOVERY_API_KEY;
  if (!key) return { status: "unconfigured", rows: [] };
  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  const start = day ? new Date(day + "T00:00:00Z") : new Date();
  // Extend UTC bounds to include all US venue-local time zones, then compare the event's localDate.
  if (day) start.setUTCDate(start.getUTCDate() - 1);
  const stop = new Date(start);
  stop.setUTCDate(stop.getUTCDate() + (day ? 3 : 60));
  const stamp = d => d.toISOString().replace(/\.\d{3}/, "");
  const params = { apikey: key, countryCode: "US", classificationName: "sports", latlong: lat + "," + lon, radius: miles, unit: "miles", size: 40, sort: "date,asc", startDateTime: stamp(start), endDateTime: stamp(stop) };
  if (sport) params.keyword = sport;
  url.search = new URLSearchParams(params);
  const response = await fetch(url, {signal: AbortSignal.timeout(6000)});
  if (!response.ok) throw Error("Events unavailable");
  const data = await response.json();
  const rows = [];
  for (const event of data._embedded?.events || []) {
    const venue = event._embedded?.venues?.[0], date = event.dates?.start;
    if (!venue?.location || !date?.localDate || (day && date.localDate !== day) || ["canceled","cancelled","postponed"].includes(event.dates?.status?.code)) continue;
    const distance = milesBetween(lat, lon, Number(venue.location.latitude), Number(venue.location.longitude));
    if (!Number.isFinite(distance) || distance > miles) continue;
    const price = event.priceRanges?.find(p => p.currency === "USD" && Number.isFinite(p.min));
    rows.push({ name: event.name, place: venue.name, city: venue.city?.name || "", sport: event.classifications?.[0]?.genre?.name || "Sports", providerPoint: [Number(venue.location.latitude),Number(venue.location.longitude)], miles: distance, date: date.localDate, time: date.timeTBA || date.noSpecificTime ? "" : (date.localTime || ""), start: date.dateTime || "", url: event.url, lowPrice: price?.min ?? null });
  }
  return { status: "ready", rows };
}

export default async function handler(request) {
  if (request.method !== "POST") return reply({ error: "POST required" }, 405);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply({error:"Origin mismatch"},403);
  let input;
  try { input = await request.json(); } catch { return reply({ error: "Invalid request" }, 400); }
  if (!input || typeof input !== "object") return reply({ error: "Invalid request" }, 400);
  const {lat, lon, miles, mode, sport = "", day = ""} = input;
  if (!Number.isFinite(lat) || Math.abs(lat)>90 || !Number.isFinite(lon) || Math.abs(lon)>180 || !RADII.includes(miles)
      || !["play","attend"].includes(mode) || typeof sport !== "string" || sport.length>60
      || typeof day !== "string" || (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day))))) return reply({error:"Invalid search settings"},400);
  const params={lat,lon,miles,mode,sport,day};
  const fallback=()=>({status:"unavailable",rows:[]});
  const [places, events]=await Promise.all([
    googlePlaces(params).catch(fallback),
    mode==="attend" ? ticketEvents(params).catch(fallback) : Promise.resolve({status:"unused",rows:[]})
  ]);
  return reply({places,events});
}
