"use strict";

const TRANSPORT_TYPES = new Set(["plane", "train", "bus", "boat", "car"]);

async function handleAiPlan(req, res, requestUrl) {
  if (requestUrl.pathname !== "/api/ai/quick-plan") return false;
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method not allowed" });

  try {
    const body = JSON.parse(await readBody(req));
    const text = String(body.text || "").trim();
    if (text.length < 4) return sendJson(res, 400, { ok: false, error: "请输入要解析的行程文本" });

    const hints = inferPlanHints(text);
    const fallback = buildDeterministicPlan(text, hints);
    const apiKey = process.env.deepseek || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return sendJson(res, 200, { ok: true, plan: fallback, source: "deterministic", warning: "missing deepseek api key", hints: publicHints(hints, fallback) });
    }

    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "你是严谨的旅行行程结构化助手。你只输出可解析 JSON，不输出 markdown。" },
            { role: "user", content: buildPrompt(text, body.trip || {}, hints, fallback) },
          ],
        }),
      });
      if (!response.ok) throw new Error(`deepseek ${response.status}`);
      const data = await response.json();
      const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
      const plan = normalizePlan(parsed.plan || parsed, hints, fallback);
      if (!plan.days.length) throw new Error("no days parsed");
      return sendJson(res, 200, { ok: true, plan, source: "deepseek", hints: publicHints(hints, plan) });
    } catch (error) {
      return sendJson(res, 200, { ok: true, plan: fallback, source: "deterministic-fallback", warning: error.message, hints: publicHints(hints, fallback) });
    }
  } catch (error) {
    return sendJson(res, 502, { ok: false, error: "ai quick plan failed", detail: error.message });
  }
}

function buildPrompt(text, trip, hints, fallback) {
  return [
    "请把用户输入的自然语言行程严格转成结构化 JSON。",
    "不要自动覆盖已有行程，只生成计划对象。",
    "必须根据文本中的天数创建准确数量的 days。例如“内罗毕玩3天”必须生成 3 个 day。",
    hints.expectedDays ? `后端已解析到目标天数：${hints.expectedDays} 天；你必须返回正好 ${hints.expectedDays} 个 day。` : "如果文本没有总天数，请根据第几天和城市段推断最小天数。",
    hints.locationSequence.length ? `城市天数序列：${hints.locationSequence.map((item) => `${item.location || "未指定"} ${item.days}天`).join("，")}。` : "",
    fallback?.days?.length ? `后端规则解析草案如下；必须保持天数和第几天归属，可以补充字段，但不要删除或弱化这些明确事项：${JSON.stringify(fallback)}` : "",
    "如果文本写了第几天/第二天/第三天，事项必须放到对应 day。",
    "不要编造用户没有暗示的必去景点；可以把不确定内容放进 note。",
    "时间不确定时 time 为空字符串。地点尽量写具体 place；当天城市写 location。住宿不确定时 stay 为空。",
    "交通 type 只能是 plane/train/bus/boat/car 或空字符串。预算不确定时 budget 为 null。",
    "返回格式：{\"plan\":{\"title\":\"\",\"originCity\":\"\",\"days\":[{\"location\":\"\",\"stay\":\"\",\"activities\":[{\"time\":\"\",\"title\":\"\",\"place\":\"\",\"note\":\"\",\"transport\":{\"type\":\"\",\"from\":\"\",\"to\":\"\",\"depart\":\"\",\"arrive\":\"\"},\"budget\":null}]}]}}",
    `当前行程标题：${trip.tripTitle || ""}`,
    `当前出发城市：${trip.originCity || ""}`,
    "用户输入：",
    text,
  ].filter(Boolean).join("\n");
}

function normalizePlan(input = {}, hints = {}, fallback = null) {
  const rawDays = Array.isArray(input.days) ? input.days : [];
  let days = rawDays.map(normalizeDay).filter(Boolean).slice(0, 60);
  const expected = Number.isFinite(hints.expectedDays) ? Math.max(1, Math.min(60, hints.expectedDays)) : 0;
  if (expected) {
    days = days.slice(0, expected);
    while (days.length < expected) days.push(makePlaceholderDay(days.length, hints));
    days = applyLocationHints(days, hints.locationSequence);
  }
  if (fallback?.days?.length) days = mergeFallbackDays(days, fallback.days);
  return { title: clean(input.title), originCity: clean(input.originCity), days };
}

function mergeFallbackDays(days, fallbackDays) {
  const length = Math.max(days.length, fallbackDays.length);
  const merged = [];
  for (let index = 0; index < length; index += 1) {
    const day = days[index] || { location: "", stay: "", activities: [] };
    const fallback = fallbackDays[index] || { location: "", stay: "", activities: [] };
    merged.push({
      location: day.location || fallback.location || "",
      stay: day.stay || fallback.stay || "",
      activities: reconcileActivities(day.activities || [], fallback.activities || []),
    });
  }
  return merged;
}

function reconcileActivities(primaryActivities, fallbackActivities) {
  if (!primaryActivities.length) return fallbackActivities.map(normalizeActivity).filter(Boolean);
  const normalizedPrimary = primaryActivities.map(normalizeActivity).filter(Boolean);
  const normalizedFallback = fallbackActivities.map(normalizeActivity).filter(Boolean);
  const output = normalizedPrimary.map((activity, index) => {
    const fallback = normalizedFallback[index];
    if (!fallback) return activity;
    const next = { ...activity };
    if (isMoreSpecific(fallback.title, activity.title)) next.title = fallback.title;
    if (!next.place || isMoreSpecific(fallback.place, next.place)) next.place = fallback.place;
    if (!next.note && fallback.note) next.note = fallback.note;
    return next;
  });
  for (const fallback of normalizedFallback) {
    if (!output.some((activity) => sameActivity(activity, fallback))) output.push(fallback);
  }
  return dedupeActivities(output);
}

function isMoreSpecific(candidate, current) {
  const next = clean(candidate);
  const prev = clean(current);
  return Boolean(next && (!prev || (next.length > prev.length && next.includes(prev))));
}

function sameActivity(left, right) {
  const a = clean(left.title || left.place);
  const b = clean(right.title || right.place);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function normalizeDay(day = {}) {
  const activities = Array.isArray(day.activities) ? day.activities : [];
  return { location: clean(day.location || day.city), stay: clean(day.stay || day.hotel), activities: activities.map(normalizeActivity).filter(Boolean).slice(0, 30) };
}

function normalizeActivity(activity = {}) {
  const title = clean(activity.title || activity.name || activity.activity);
  const place = clean(activity.place || activity.location || activity.poi);
  const note = clean(activity.note || activity.description || activity.reason);
  const time = normalizeTime(activity.time || activity.startTime || "");
  if (!title && !place && !note) return null;
  return { time, title: title || place || "待安排事项", place, note, transport: normalizeTransport(activity.transport), budget: normalizeBudget(activity.budget) };
}

function buildDeterministicPlan(text, hints = {}) {
  const expected = Number.isFinite(hints.expectedDays) ? Math.max(1, Math.min(60, hints.expectedDays)) : Math.max(1, inferMentionedOrdinalDays(text) || hints.locationSequence.reduce((sum, item) => sum + item.days, 0) || 1);
  const days = Array.from({ length: expected }, (_, index) => makePlaceholderDay(index, hints));
  const segments = splitByOrdinalDays(text);
  const preamble = segments.preamble ? extractActivities(segments.preamble, hints) : [];
  if (preamble.length) days[0].activities.push(...preamble);
  for (const segment of segments.days) {
    const index = Math.max(0, Math.min(days.length - 1, segment.dayNumber - 1));
    days[index].activities.push(...extractActivities(segment.text, hints));
  }
  if (!segments.days.length && !preamble.length) days[0].activities.push(...extractActivities(stripPlanningClauses(text), hints));
  return { title: hints.defaultLocation && expected ? `${hints.defaultLocation}${expected}天行程` : "", originCity: "", days: days.map((day) => ({ ...day, activities: dedupeActivities(day.activities) })) };
}

function splitByOrdinalDays(text) {
  const source = String(text || "");
  const pattern = /第\s*([0-9]{1,2}|[一二两三四五六七八九十]{1,4})\s*天/g;
  const matches = Array.from(source.matchAll(pattern));
  if (!matches.length) return { preamble: source, days: [] };
  const days = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? source.length;
    const dayNumber = parseChineseNumber(match[1]);
    if (dayNumber > 0) days.push({ dayNumber, text: source.slice(start, end) });
  }
  return { preamble: source.slice(0, matches[0].index), days };
}

function extractActivities(text, hints = {}) {
  const normalized = stripPlanningClauses(text)
    .replace(/(然后|之后|随后|接着|再去|再到|再前往|并且|并|以及|和|、)/g, "，")
    .replace(/(上午|中午|下午|晚上|早上|傍晚)(?=[^，,。；;]{1,20})/g, "，$1");
  return normalized.split(/[，,。；;\n]+/).map(cleanActivityText).filter(Boolean).map((part) => phraseToActivity(part, hints)).filter(Boolean).slice(0, 30);
}

function stripPlanningClauses(text) {
  return String(text || "")
    .replace(/第\s*([0-9]{1,2}|[一二两三四五六七八九十]{1,4})\s*天/g, "")
    .replace(/(?:在|去|到|前往)?\s*[^，,。；;\s]{1,24}(?:玩|游玩|停留|待|住)?\s*([0-9]{1,2}|[一二两三四五六七八九十]{1,4})\s*[天日]/g, "")
    .trim();
}

function cleanActivityText(value) {
  return clean(value)
    .replace(/^(?:先|可|可以|安排|计划|去|到|前往|参观|游览|打卡|逛|看|体验)\s*/g, "")
    .replace(/^(?:上午|中午|下午|晚上|早上|傍晚)\s*/g, "")
    .replace(/^(?:，|,|。|；|;)+/, "")
    .replace(/(?:，|,|。|；|;)+$/, "")
    .trim();
}

function phraseToActivity(phrase, hints = {}) {
  const title = cleanActivityText(phrase);
  if (!title) return null;
  if (/^(玩|游玩|停留|待|住)?\s*([0-9]{1,2}|[一二两三四五六七八九十]{1,4})\s*[天日]$/.test(title)) return null;
  if (title === hints.defaultLocation) return null;
  return { time: "", title, place: inferActivityPlace(title, hints), note: "", transport: null, budget: null };
}

function inferActivityPlace(title, hints = {}) {
  const text = clean(title);
  const hotel = text.match(/入住(.{0,20}?)(酒店|旅店|民宿|住宿|营地)/);
  if (hotel) return clean(hotel[0].replace(/^入住/, ""));
  const arrive = text.match(/^抵达(.{1,24})$/);
  if (arrive) return clean(arrive[1]);
  if (/出发|离开|返程|准备出发/.test(text)) return hints.defaultLocation || "";
  return text;
}

function dedupeActivities(activities) {
  const seen = new Set();
  const result = [];
  for (const activity of activities || []) {
    const key = `${clean(activity.title)}|${clean(activity.place)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(activity);
  }
  return result;
}

function makePlaceholderDay(index, hints) {
  return { location: locationForDay(index, hints.locationSequence) || hints.defaultLocation || "", stay: "", activities: [] };
}

function applyLocationHints(days, sequence = []) {
  if (!Array.isArray(sequence) || !sequence.length) return days;
  return days.map((day, index) => day.location ? day : { ...day, location: locationForDay(index, sequence) || day.location });
}

function locationForDay(index, sequence = []) {
  let cursor = 0;
  for (const item of sequence) {
    const length = Math.max(0, Number(item.days) || 0);
    if (index >= cursor && index < cursor + length) return item.location || "";
    cursor += length;
  }
  return sequence[sequence.length - 1]?.location || "";
}

function inferPlanHints(text) {
  const source = String(text || "");
  const locationSequence = inferLocationSequence(source);
  const summedDays = locationSequence.reduce((sum, item) => sum + item.days, 0);
  const explicitTotals = [];
  const totalPattern = /(?<!第)(?:共|总共|一共|合计|安排|玩|游玩|停留|待|住)?\s*([0-9]{1,2}|[一二两三四五六七八九十]{1,4})\s*[天日]/g;
  let match;
  while ((match = totalPattern.exec(source))) {
    const count = parseChineseNumber(match[1]);
    if (count > 0 && count <= 60) explicitTotals.push(count);
  }
  const ordinalDays = inferMentionedOrdinalDays(source);
  const expectedDays = Math.max(summedDays, ...explicitTotals, ordinalDays, 0) || 0;
  return { expectedDays: expectedDays || null, locationSequence, defaultLocation: locationSequence[0]?.location || inferDefaultLocation(source) };
}

function inferLocationSequence(text) {
  const sequence = [];
  for (const piece of String(text || "").split(/[，,。；;\n]+/)) {
    const cleaned = piece.trim();
    if (!cleaned) continue;
    const pattern = /(?:在|去|到|前往)?\s*([^\s，,。；;0-9一二两三四五六七八九十天日]{1,24}?)(?:玩|游玩|停留|待|住)?\s*([0-9]{1,2}|[一二两三四五六七八九十]{1,4})\s*天/g;
    let match;
    while ((match = pattern.exec(cleaned))) {
      const days = parseChineseNumber(match[2]);
      const location = cleanLocation(match[1]);
      if (!location || location === "第" || location.endsWith("第")) continue;
      if (days > 0 && days <= 60) sequence.push({ location, days });
    }
  }
  return sequence.slice(0, 30);
}

function inferMentionedOrdinalDays(text) {
  let max = 0;
  const pattern = /第\s*([0-9]{1,2}|[一二两三四五六七八九十]{1,4})\s*天/g;
  let match;
  while ((match = pattern.exec(String(text || "")))) max = Math.max(max, parseChineseNumber(match[1]));
  return max;
}

function inferDefaultLocation(text) {
  const match = String(text || "").match(/(?:在|去|到|前往)\s*([^，,。；;\s]{1,24}?)(?:玩|游玩|停留|待|住|第|，|,|。|；|;|$)/);
  return match ? cleanLocation(match[1]) : "";
}

function parseChineseNumber(value) {
  const text = String(value || "").trim();
  if (/^\d+$/.test(text)) return Number(text);
  const digits = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (text === "十") return 10;
  if (text.includes("十")) {
    const [left, right] = text.split("十");
    return (left ? digits[left] || 0 : 1) * 10 + (right ? digits[right] || 0 : 0);
  }
  return digits[text] || 0;
}

function normalizeTransport(value) {
  if (!value || typeof value !== "object") return null;
  const type = TRANSPORT_TYPES.has(value.type) ? value.type : "";
  const result = { type, from: clean(value.from), to: clean(value.to), depart: normalizeTime(value.depart), arrive: normalizeTime(value.arrive) };
  return Object.values(result).some(Boolean) ? result : null;
}

function normalizeBudget(value) {
  if (!value || typeof value !== "object") return null;
  const amount = Number(value.amount ?? value.cost ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, currency: clean(value.currency || "CNY").toUpperCase().slice(0, 3) || "CNY", category: clean(value.category || "other") || "other" };
}

function normalizeTime(value) {
  const match = clean(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  return `${String(Math.max(0, Math.min(23, Number(match[1])))).padStart(2, "0")}:${String(Math.max(0, Math.min(59, Number(match[2])))).padStart(2, "0")}`;
}

function cleanLocation(value) {
  return clean(value).replace(/^(?:在|去|到|前往)/, "").replace(/(?:玩|游玩|停留|待|住)$/g, "").trim();
}

function publicHints(hints, plan) {
  return { expectedDays: hints.expectedDays || plan.days.length, defaultLocation: hints.defaultLocation || "" };
}

function clean(value) { return String(value || "").trim().slice(0, 300); }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 200000) {
        reject(new Error("request too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body || "{}"));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

module.exports = { handleAiPlan };
