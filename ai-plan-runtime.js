"use strict";

async function handleAiPlan(req, res, requestUrl) {
  if (requestUrl.pathname !== "/api/ai/quick-plan") return false;
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "method not allowed" });
    return true;
  }
  const apiKey = process.env.deepseek || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, { ok: false, error: "missing deepseek api key" });
    return true;
  }
  try {
    const body = JSON.parse(await readBody(req));
    const text = String(body.text || "").trim();
    if (text.length < 4) {
      sendJson(res, 400, { ok: false, error: "请输入要解析的行程文本" });
      return true;
    }
    const trip = body.trip || {};
    const prompt = buildPrompt(text, trip);
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "你是严谨的旅行行程结构化助手。你只输出可解析 JSON，不输出 markdown。" },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) throw new Error(`deepseek ${response.status}`);
    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    const plan = normalizePlan(parsed.plan || parsed);
    if (!plan.days.length) throw new Error("no days parsed");
    sendJson(res, 200, { ok: true, plan });
    return true;
  } catch (error) {
    sendJson(res, 502, { ok: false, error: "ai quick plan failed", detail: error.message });
    return true;
  }
}

function buildPrompt(text, trip) {
  return [
    "请把用户输入的自然语言行程严格转成结构化 JSON。",
    "不要自动覆盖已有行程，只生成计划对象。",
    "必须根据文本中的天数创建准确数量的 days。例如“内罗毕玩3天”必须生成 3 个 day。",
    "如果文本写了第几天/第二天/第三天，事项必须放到对应 day；如果只写城市+天数但没有细节，则每天至少给一个空 activities 数组并保留 location。",
    "不要编造用户没有暗示的必去景点；可以把不确定内容放进 note。",
    "时间不确定时 time 为空字符串。地点尽量写具体 place；当天城市写 location。住宿不确定时 stay 为空。",
    "交通 type 只能是 plane/train/bus/boat/car 或空字符串。预算不确定时 budget 为 null。",
    "返回格式：{\"plan\":{\"title\":\"\",\"originCity\":\"\",\"days\":[{\"location\":\"\",\"stay\":\"\",\"activities\":[{\"time\":\"\",\"title\":\"\",\"place\":\"\",\"note\":\"\",\"transport\":{\"type\":\"\",\"from\":\"\",\"to\":\"\",\"depart\":\"\",\"arrive\":\"\"},\"budget\":null}]}]}}",
    `当前行程标题：${trip.tripTitle || ""}`,
    `当前出发城市：${trip.originCity || ""}`,
    "用户输入：",
    text,
  ].join("\n");
}

function normalizePlan(input = {}) {
  const days = Array.isArray(input.days) ? input.days : [];
  return {
    title: clean(input.title),
    originCity: clean(input.originCity),
    days: days.map(normalizeDay).filter(Boolean).slice(0, 60),
  };
}

function normalizeDay(day = {}) {
  const activities = Array.isArray(day.activities) ? day.activities : [];
  return {
    location: clean(day.location || day.city),
    stay: clean(day.stay || day.hotel),
    activities: activities.map(normalizeActivity).filter(Boolean).slice(0, 30),
  };
}

function normalizeActivity(activity = {}) {
  const title = clean(activity.title || activity.name || activity.activity);
  const place = clean(activity.place || activity.location || activity.poi);
  const note = clean(activity.note || activity.description || activity.reason);
  const time = normalizeTime(activity.time || activity.startTime || "");
  if (!title && !place && !note) return null;
  return {
    time,
    title: title || place || "待安排事项",
    place,
    note,
    transport: normalizeTransport(activity.transport),
    budget: normalizeBudget(activity.budget),
  };
}

function normalizeTransport(value) {
  if (!value || typeof value !== "object") return null;
  const type = ["plane", "train", "bus", "boat", "car"].includes(value.type) ? value.type : "";
  const result = { type, from: clean(value.from), to: clean(value.to), depart: normalizeTime(value.depart), arrive: normalizeTime(value.arrive) };
  return Object.values(result).some(Boolean) ? result : null;
}

function normalizeBudget(value) {
  if (!value || typeof value !== "object") return null;
  const amount = Number(value.amount ?? value.cost ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const currency = clean(value.currency || "CNY").toUpperCase().slice(0, 3) || "CNY";
  return { amount, currency, category: clean(value.category || "other") || "other" };
}

function normalizeTime(value) {
  const text = clean(value);
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hour = Math.max(0, Math.min(23, Number(match[1])));
  const minute = Math.max(0, Math.min(59, Number(match[2])));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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
