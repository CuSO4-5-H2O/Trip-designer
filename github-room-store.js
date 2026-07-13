"use strict";

const DEFAULT_REPO = "CuSO4-5-H2O/Trip-designer";
const DEFAULT_BRANCH = "trip-data";
const DEFAULT_PATH = "rooms.json";

function createGithubRoomStore() {
  const token = process.env.GITHUB_DATA_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  const repo = process.env.GITHUB_DATA_REPO || process.env.GITHUB_REPOSITORY || DEFAULT_REPO;
  const branch = process.env.GITHUB_DATA_BRANCH || DEFAULT_BRANCH;
  const filePath = process.env.GITHUB_DATA_PATH || DEFAULT_PATH;
  const [owner, name] = String(repo).split("/");
  const enabled = Boolean(token && owner && name);
  let sha = "";
  let branchReady = false;
  let saveQueue = Promise.resolve();
  const status = {
    backend: enabled ? "github" : "disk",
    enabled,
    repo,
    branch,
    path: filePath,
    ready: !enabled,
    lastLoadAt: "",
    lastSaveAt: "",
    lastError: enabled ? "" : "GITHUB_DATA_TOKEN not configured",
  };

  async function load() {
    if (!enabled) return null;
    try {
      await ensureBranch();
      const response = await githubFetch(`/repos/${owner}/${name}/contents/${encodeURIComponentPath(filePath)}?ref=${encodeURIComponent(branch)}`, { method: "GET" });
      if (response.status === 404) {
        status.ready = true;
        status.lastError = "";
        status.lastLoadAt = new Date().toISOString();
        return null;
      }
      if (!response.ok) throw await githubError(response, "load room data");
      const data = await response.json();
      sha = data.sha || "";
      const text = Buffer.from(String(data.content || ""), "base64").toString("utf8");
      status.ready = true;
      status.lastError = "";
      status.lastLoadAt = new Date().toISOString();
      return JSON.parse(text || "{}");
    } catch (error) {
      status.ready = false;
      status.lastError = error.message;
      throw error;
    }
  }

  function save(payload) {
    if (!enabled) return Promise.resolve({ ok: false, skipped: true, reason: "github storage not configured" });
    saveQueue = saveQueue.then(() => saveOnce(payload), () => saveOnce(payload));
    return saveQueue;
  }

  async function saveOnce(payload) {
    try {
      await ensureBranch();
      const body = {
        message: `data: persist trip rooms ${new Date().toISOString()}`,
        content: Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64"),
        branch,
      };
      if (sha) body.sha = sha;
      const response = await githubFetch(`/repos/${owner}/${name}/contents/${encodeURIComponentPath(filePath)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (response.status === 409) {
        await refreshSha();
        return saveOnce(payload);
      }
      if (!response.ok) throw await githubError(response, "save room data");
      const data = await response.json();
      sha = data.content?.sha || sha;
      status.ready = true;
      status.lastError = "";
      status.lastSaveAt = new Date().toISOString();
      return { ok: true, sha };
    } catch (error) {
      status.ready = false;
      status.lastError = error.message;
      throw error;
    }
  }

  async function refreshSha() {
    const response = await githubFetch(`/repos/${owner}/${name}/contents/${encodeURIComponentPath(filePath)}?ref=${encodeURIComponent(branch)}`, { method: "GET" });
    if (response.status === 404) {
      sha = "";
      return;
    }
    if (!response.ok) throw await githubError(response, "refresh room data sha");
    const data = await response.json();
    sha = data.sha || "";
  }

  async function ensureBranch() {
    if (branchReady) return;
    const branchResponse = await githubFetch(`/repos/${owner}/${name}/git/ref/heads/${encodeURIComponent(branch)}`, { method: "GET" });
    if (branchResponse.ok) {
      branchReady = true;
      return;
    }
    if (branchResponse.status !== 404) throw await githubError(branchResponse, "check data branch");

    const repoResponse = await githubFetch(`/repos/${owner}/${name}`, { method: "GET" });
    if (!repoResponse.ok) throw await githubError(repoResponse, "read repository metadata");
    const repoData = await repoResponse.json();
    const sourceBranch = repoData.default_branch || "main";
    const sourceRefResponse = await githubFetch(`/repos/${owner}/${name}/git/ref/heads/${encodeURIComponent(sourceBranch)}`, { method: "GET" });
    if (!sourceRefResponse.ok) throw await githubError(sourceRefResponse, "read default branch ref");
    const sourceRef = await sourceRefResponse.json();
    const createResponse = await githubFetch(`/repos/${owner}/${name}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: sourceRef.object?.sha }),
    });
    if (!createResponse.ok && createResponse.status !== 422) throw await githubError(createResponse, "create data branch");
    branchReady = true;
  }

  async function githubFetch(path, options = {}) {
    return fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "TripDesignerRenderStorage",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers || {}),
      },
    });
  }

  return {
    enabled,
    status,
    load,
    save,
  };
}

function encodeURIComponentPath(filePath) {
  return String(filePath).split("/").map(encodeURIComponent).join("/");
}

async function githubError(response, action) {
  let detail = "";
  try {
    const data = await response.json();
    detail = data.message || JSON.stringify(data).slice(0, 300);
  } catch {
    detail = await response.text().catch(() => "");
  }
  return new Error(`GitHub ${action} failed: ${response.status} ${detail}`.trim());
}

module.exports = { createGithubRoomStore };
