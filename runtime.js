"use strict";

const http = require("http");
const { handleMapRuntime } = require("./map-runtime");
const { hydrateDiskFromGithub, startGithubDiskSync, getGithubDiskSyncStatus } = require("./github-disk-sync");

const deepSeekKey = process.env.DEEPSEEK_API_KEY || process.env.deepseek || process.env.DEEPSEEK;
if (deepSeekKey && !process.env.DEEPSEEK_API_KEY) {
  process.env.DEEPSEEK_API_KEY = deepSeekKey;
}
if (!process.env.DEEPSEEK_MODEL) {
  process.env.DEEPSEEK_MODEL = "deepseek-chat";
}

const aiLimit = clampInteger(process.env.AI_RATE_LIMIT, 1, 100, 12);
const aiWindowMs = clampInteger(process.env.AI_RATE_WINDOW_MS, 60_000, 86_400_000, 10 * 60_000);
const aiConcurrencyLimit = clampInteger(process.env.AI_CONCURRENCY_LIMIT, 1, 20, 3);
const requestBuckets = new Map();
let activeAiRequests = 0;
let lastCleanupAt = 0;
let authRuntime = null;
let authLoadPromise = null;
let aiPlanHandler = null;

const nativeCreateServer = http.createServer.bind(http);
http.createServer = function createGuardedServer(optionsOrListener, maybeListener) {
  if (typeof optionsOrListener === "function") {
    return nativeCreateServer(wrapRequestListener(optionsOrListener));
  }
  if (typeof maybeListener === "function") {
    return nativeCreateServer(optionsOrListener, wrapRequestListener(maybeListener));
  }
  return nativeCreateServer(optionsOrListener);
};

function wrapRequestListener(listener) {
  return async function guardedRequestListener(req, res) {
    let requestUrl;
    let pathname = "";
    try {
      requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      pathname = requestUrl.pathname;
    } catch {
      requestUrl = new URL("/", "http://localhost");
      pathname = req.url || "";
    }

    if (pathname === "/api/cloud-storage-status") {
      return sendJson(res, 200, { ok: true, storage: getGithubDiskSyncStatus() });
    }

    if (pathname.startsWith("/api/auth/")) {
      return handleAuthRequest(req, res, requestUrl);
    }

    try {
      if (await handleMapRuntime(req, res, pathname)) return;
    } catch (error) {
      if (!res.headersSent) {
        return sendJson(res, 500, { error: "服务器处理地图请求时出现错误。" });
      }
      res.destroy(error);
      return;
    }

    if (pathname === "/api/ai/quick-plan" && req.method === "POST") {
      return handleRateLimitedAi(req, res, () => handleQuickPlanRequest(req, res, requestUrl));
    }

    if (pathname !== "/api/travel-recommendations" || req.method !== "POST") {
      return listener(req, res);
    }

    return handleRateLimitedAi(req, res, () => listener(req, res));
  };
}

async function handleAuthRequest(req, res, requestUrl) {
  try {
    const runtime = await getAuthRuntime();
    return runtime.handle(req, res, requestUrl);
  } catch (error) {
    return sendJson(res, 503, { ok: false, error: "账号服务暂时不可用", detail: error.message });
  }
}

async function getAuthRuntime() {
  if (!authRuntime) {
    const { createAuthRuntime } = require("./auth-runtime");
    authRuntime = createAuthRuntime();
  }
  if (!authLoadPromise) {
    authLoadPromise = authRuntime.load().catch((error) => {
      authLoadPromise = null;
      throw error;
    });
  }
  await authLoadPromise;
  return authRuntime;
}

async function handleQuickPlanRequest(req, res, requestUrl) {
  try {
    if (!aiPlanHandler) aiPlanHandler = require("./ai-plan-runtime").handleAiPlan;
    return aiPlanHandler(req, res, requestUrl);
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: "AI 快速行程服务暂时不可用", detail: error.message });
  }
}

async function handleRateLimitedAi(req, res, action) {
  const now = Date.now();
  cleanupBuckets(now);
  const clientKey = getClientKey(req);
  const bucket = requestBuckets.get(clientKey);
  const recent = bucket?.timestamps?.filter((timestamp) => now - timestamp < aiWindowMs) || [];

  if (recent.length >= aiLimit) {
    const retryAfterMs = Math.max(1_000, aiWindowMs - (now - recent[0]));
    return sendJson(res, 429, {
      error: "AI 推荐请求过于频繁，请稍后再试。",
      retryAfterSeconds: Math.ceil(retryAfterMs / 1_000),
    }, Math.ceil(retryAfterMs / 1_000));
  }

  if (activeAiRequests >= aiConcurrencyLimit) {
    return sendJson(res, 503, {
      error: "AI 推荐正在处理其他请求，请稍后重试。",
    }, 8);
  }

  recent.push(now);
  requestBuckets.set(clientKey, { timestamps: recent, touchedAt: now });
  activeAiRequests += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeAiRequests = Math.max(0, activeAiRequests - 1);
  };
  res.once("finish", release);
  res.once("close", release);

  try {
    return await action();
  } catch (error) {
    release();
    if (!res.headersSent) {
      return sendJson(res, 500, { error: "服务器处理 AI 请求时出现错误。" });
    }
    res.destroy(error);
  }
}

function getClientKey(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

function cleanupBuckets(now) {
  if (now - lastCleanupAt < aiWindowMs) return;
  lastCleanupAt = now;
  for (const [key, bucket] of requestBuckets.entries()) {
    if (now - (bucket.touchedAt || 0) > aiWindowMs * 2) requestBuckets.delete(key);
  }
}

function sendJson(res, status, payload, retryAfterSeconds = 0) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
  if (retryAfterSeconds) headers["Retry-After"] = String(retryAfterSeconds);
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

function clampInteger(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

bootstrap();

async function bootstrap() {
  await hydrateDiskFromGithub();
  startGithubDiskSync();
  require("./prepare-seed");
}