"use strict";

const mapPlanCache = new Map();
const CACHE_LIMIT = 120;

async function handleMapRuntime(req, res, pathname) {
  if (pathname === "/api/map-config" && req.method === "GET") {
    sendJson(res, 200, { ok: true, ...getMapConfig() });
    return true;
  }
  if (pathname === "/api/map/plan" && req.method === "POST") {
    await handleMapPlan(req, res);
    return true;
  }
  if (pathname === "/api/map/plan") {
    sendJson(res, 405, { ok: false, error: "method not allowed" });
    return true;
  }
  return false;
}

function getMapConfig() {
  const amapKey = process.env.gaodemap_key || process.env.GAODEMAP_KEY || process.env.AMAP_KEY || "";
  const amapSecurityCode = process.env.gaodemap_securitycode || process.env.GAODEMAP_SECURITYCODE || process.env.AMAP_SECURITY_CODE || "";
  const googleKey = process.env.googlemap || process.env.GOOGLEMAP || process.env.GOOGLE_MAPS_API_KEY || "";
  return { defaultProvider: amapKey ? "amap" : googleKey ? "google" : "none", providers: { amap: { configured: Boolean(amapKey), key: amapKey, securityCode: amapSecurityCode }, google: { configured: Boolean(googleKey), key: googleKey } } };
}

async function handleMapPlan(req, res) {
  try {
    const body = JSON.parse(await readBody(req));
    const config = getMapConfig();
    const provider = chooseProvider(body.provider, config);
    if (provider === "none") return sendJson(res, 503, { ok: false, error: "missing map api key" });
    const entries = (Array.isArray(body.entries) ? body.entries : []).slice(0, 40).map((entry, index) => ({
      query: String(entry?.query || "").trim(),
      label: String(entry?.label || entry?.query || "").trim(),
      day: String(entry?.day || "").trim(),
      dayId: String(entry?.dayId || "").trim(),
      activityId: String(entry?.activityId || "").trim(),
      mode: normalizeMode(entry?.mode || entry?.transport || ""),
      order: index + 1,
    })).filter((entry) => entry.query && entry.label);
    if (!entries.length) return sendJson(res, 400, { ok: false, error: "missing itinerary points" });
    const cacheKey = `${provider}:${JSON.stringify(entries)}`;
    const cached = mapPlanCache.get(cacheKey);
    if (cached) return sendJson(res, 200, { ok: true, cached: true, ...cached });
    const points = [];
    for (const entry of entries) {
      try {
        const point = await geocodeEntry(provider, entry, config);
        if (point) points.push(point);
      } catch {
        points.push({ ...entry, located: false, lat: null, lng: null });
      }
    }
    const locatedPoints = points.filter((point) => point.located !== false && Number.isFinite(point.lat) && Number.isFinite(point.lng));
    const segments = [];
    for (let index = 1; index < locatedPoints.length; index += 1) {
      const from = locatedPoints[index - 1];
      const to = locatedPoints[index];
      const mode = normalizeMode(to.mode || "car");
      segments.push(await routeSegment(provider, from, to, mode, config));
    }
    const summary = segments.reduce((acc, segment) => { acc.distance += Number(segment.distance || 0); acc.duration += Number(segment.duration || 0); return acc; }, { distance: 0, duration: 0, pointCount: locatedPoints.length, segmentCount: segments.length });
    const plan = { provider, points, segments, summary };
    remember(cacheKey, plan);
    sendJson(res, 200, { ok: true, cached: false, ...plan });
  } catch (error) {
    sendJson(res, 502, { ok: false, error: "map plan failed", detail: error.message });
  }
}

function chooseProvider(requested, config) {
  const provider = String(requested || "auto").toLowerCase();
  if (provider === "amap" && config.providers.amap.configured) return "amap";
  if (provider === "google" && config.providers.google.configured) return "google";
  return config.defaultProvider || "none";
}

async function geocodeEntry(provider, entry, config) {
  const point = provider === "google" ? await geocodeGoogle(entry.query, config.providers.google.key) : await geocodeAmap(entry.query, config.providers.amap.key);
  if (!point) return { ...entry, located: false, lat: null, lng: null };
  return { ...entry, ...point, located: true };
}

async function geocodeAmap(query, key) {
  const url = new URL("https://restapi.amap.com/v3/geocode/geo");
  url.searchParams.set("key", key);
  url.searchParams.set("address", query);
  const json = await fetchJson(url);
  const first = Array.isArray(json.geocodes) ? json.geocodes[0] : null;
  if (json.status !== "1" || !first?.location) return null;
  const [lng, lat] = first.location.split(",").map(Number);
  return { lat, lng, address: first.formatted_address || query, city: normalizeCity(first.city || first.province || "") };
}

async function geocodeGoogle(query, key) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("key", key);
  url.searchParams.set("address", query);
  url.searchParams.set("language", "zh-CN");
  const json = await fetchJson(url);
  const first = Array.isArray(json.results) ? json.results[0] : null;
  const loc = first?.geometry?.location;
  if (!loc) return null;
  return { lat: Number(loc.lat), lng: Number(loc.lng), address: first.formatted_address || query, city: "" };
}

async function routeSegment(provider, from, to, mode, config) {
  if (mode === "plane" || mode === "boat") return estimateSegment(from, to, mode);
  try { return provider === "google" ? await routeGoogle(from, to, mode, config.providers.google.key) : await routeAmap(from, to, mode, config.providers.amap.key); }
  catch { return estimateSegment(from, to, mode); }
}

async function routeAmap(from, to, mode, key) {
  const origin = `${from.lng},${from.lat}`;
  const destination = `${to.lng},${to.lat}`;
  const endpoint = mode === "walk" ? "https://restapi.amap.com/v3/direction/walking" : mode === "train" || mode === "bus" ? "https://restapi.amap.com/v3/direction/transit/integrated" : "https://restapi.amap.com/v3/direction/driving";
  const url = new URL(endpoint);
  url.searchParams.set("key", key);
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  if (mode === "train" || mode === "bus") { url.searchParams.set("city", from.city || "全国"); url.searchParams.set("cityd", to.city || from.city || "全国"); }
  const json = await fetchJson(url);
  if (json.status !== "1") throw new Error(json.info || "amap route failed");
  if (mode === "train" || mode === "bus") {
    const transit = json.route?.transits?.[0];
    if (!transit) throw new Error("amap transit route empty");
    return makeSegment(from, to, mode, Number(transit.distance), Number(transit.duration), collectAmapTransitPolyline(transit), false);
  }
  const path = json.route?.paths?.[0];
  if (!path) throw new Error("amap route empty");
  return makeSegment(from, to, mode, Number(path.distance), Number(path.duration), collectAmapPathPolyline(path), false);
}

async function routeGoogle(from, to, mode, key) {
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("key", key);
  url.searchParams.set("origin", `${from.lat},${from.lng}`);
  url.searchParams.set("destination", `${to.lat},${to.lng}`);
  url.searchParams.set("language", "zh-CN");
  url.searchParams.set("mode", mode === "walk" ? "walking" : mode === "train" || mode === "bus" ? "transit" : "driving");
  const json = await fetchJson(url);
  const route = Array.isArray(json.routes) ? json.routes[0] : null;
  const leg = route?.legs?.[0];
  if (json.status !== "OK" || !leg) throw new Error(json.error_message || json.status || "google route failed");
  return makeSegment(from, to, mode, Number(leg.distance?.value || 0), Number(leg.duration?.value || 0), decodeGooglePolyline(route.overview_polyline?.points || ""), false);
}

function estimateSegment(from, to, mode) {
  const distance = haversineMeters(from, to);
  const speeds = { plane: 650, boat: 40, train: 180, bus: 70, car: 60, walk: 5 };
  const padding = mode === "plane" ? 7200 : mode === "train" ? 1800 : mode === "boat" ? 900 : 0;
  const duration = Math.round((distance / 1000) / (speeds[mode] || 60) * 3600 + padding);
  return makeSegment(from, to, mode, distance, duration, [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }], true);
}

function makeSegment(from, to, mode, distance, duration, polyline, estimated) {
  return { from: from.label, to: to.label, dayId: to.dayId || "", activityId: to.activityId || "", mode, distance: Math.max(0, Math.round(Number(distance || 0))), duration: Math.max(0, Math.round(Number(duration || 0))), polyline: Array.isArray(polyline) && polyline.length ? polyline : [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }], estimated: Boolean(estimated) };
}

function collectAmapPathPolyline(path) { const points = []; (path.steps || []).forEach((step) => pushAmapPolyline(points, step.polyline)); return points; }
function collectAmapTransitPolyline(transit) { const points = []; (transit.segments || []).forEach((segment) => { (segment.walking?.steps || []).forEach((step) => pushAmapPolyline(points, step.polyline)); (segment.bus?.buslines || []).forEach((line) => pushAmapPolyline(points, line.polyline)); pushAmapPolyline(points, segment.railway?.polyline); }); return points; }
function pushAmapPolyline(points, polyline) { String(polyline || "").split(";").forEach((pair) => { const [lng, lat] = pair.split(",").map(Number); if (Number.isFinite(lat) && Number.isFinite(lng)) points.push({ lat, lng }); }); }
function decodeGooglePolyline(encoded) { const points = []; let index = 0, lat = 0, lng = 0; while (index < encoded.length) { let shift = 0, result = 0, byte; do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20); lat += result & 1 ? ~(result >> 1) : result >> 1; shift = 0; result = 0; do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20); lng += result & 1 ? ~(result >> 1) : result >> 1; points.push({ lat: lat / 1e5, lng: lng / 1e5 }); } return points; }
function normalizeMode(value) { const text = String(value || "").trim().toLowerCase(); if (["plane","flight","air","飞机","航班"].includes(text)) return "plane"; if (["train","rail","火车","高铁","动车"].includes(text)) return "train"; if (["bus","coach","大巴","巴士","公交"].includes(text)) return "bus"; if (["boat","ship","ferry","船","轮渡"].includes(text)) return "boat"; if (["walk","walking","步行"].includes(text)) return "walk"; return "car"; }
function normalizeCity(value) { if (Array.isArray(value)) return value[0] || ""; return String(value || ""); }
function haversineMeters(a, b) { const radius = 6371000; const lat1 = a.lat * Math.PI / 180; const lat2 = b.lat * Math.PI / 180; const deltaLat = (b.lat - a.lat) * Math.PI / 180; const deltaLng = (b.lng - a.lng) * Math.PI / 180; const x = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2; return 2 * radius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }
async function fetchJson(url) { const response = await fetch(url, { headers: { "User-Agent": "TripDesigner/1.0" } }); const text = await response.text(); let json; try { json = JSON.parse(text); } catch { throw new Error("map provider returned non-json response"); } if (!response.ok) throw new Error(json.error_message || json.info || `map provider http ${response.status}`); return json; }
function remember(key, value) { if (mapPlanCache.size >= CACHE_LIMIT) mapPlanCache.delete(mapPlanCache.keys().next().value); mapPlanCache.set(key, value); }
function readBody(req, limit = 1024 * 1024) { return new Promise((resolve, reject) => { let size = 0, data = ""; req.setEncoding("utf8"); req.on("data", (chunk) => { size += chunk.length; if (size > limit) { reject(new Error("request body too large")); req.destroy(); return; } data += chunk; }); req.on("end", () => resolve(data || "{}")); req.on("error", reject); }); }
function sendJson(res, status, payload) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(payload)); }

module.exports = { handleMapRuntime };
