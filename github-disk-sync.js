"use strict";

const fs = require("fs");
const path = require("path");
const { createGithubRoomStore } = require("./github-room-store");

const root = __dirname;
const renderDiskDir = "/var/data";
const dataDir = process.env.DATA_DIR || (fs.existsSync(renderDiskDir) ? renderDiskDir : path.join(root, "data"));
const dataFile = process.env.DATA_FILE || path.join(dataDir, "rooms.json");
const store = createGithubRoomStore();
const status = {
  ...store.status,
  dataFile,
  hydrated: false,
  watching: false,
  pendingSave: false,
  lastDiskReadAt: "",
  lastDiskWriteAt: "",
};
let saveTimer = null;
let lastSavedFingerprint = "";
let started = false;
let suppressNextWatch = false;

async function hydrateDiskFromGithub() {
  syncStatus();
  if (!store.enabled) return status;

  try {
    const remotePayload = await store.load();
    syncStatus();
    if (hasRooms(remotePayload)) {
      writeDiskPayload(remotePayload);
      suppressNextWatch = true;
      status.hydrated = true;
      return status;
    }

    const localPayload = readDiskPayload();
    if (hasRooms(localPayload)) {
      await store.save(localPayload);
      syncStatus();
      lastSavedFingerprint = fingerprint(localPayload);
      status.hydrated = true;
      return status;
    }

    status.hydrated = true;
    return status;
  } catch (error) {
    status.lastError = error.message;
    console.warn(`GitHub room storage hydrate failed: ${error.message}`);
    return status;
  }
}

function startGithubDiskSync() {
  if (started) return status;
  started = true;
  if (!store.enabled) {
    syncStatus();
    console.warn("GitHub room storage is disabled. Configure GITHUB_DATA_TOKEN on Render to persist rooms to GitHub.");
    return status;
  }

  fs.mkdirSync(dataDir, { recursive: true });
  fs.watchFile(dataFile, { interval: 1200 }, () => {
    if (suppressNextWatch) {
      suppressNextWatch = false;
      return;
    }
    scheduleUpload("watch");
  });
  status.watching = true;
  scheduleUpload("startup");
  return status;
}

function scheduleUpload(reason) {
  clearTimeout(saveTimer);
  status.pendingSave = true;
  saveTimer = setTimeout(() => uploadDiskPayload(reason), 450);
}

async function uploadDiskPayload(reason) {
  try {
    const payload = readDiskPayload();
    if (!hasRooms(payload)) {
      status.pendingSave = false;
      return;
    }
    const nextFingerprint = fingerprint(payload);
    if (nextFingerprint === lastSavedFingerprint) {
      status.pendingSave = false;
      return;
    }
    await store.save(payload);
    syncStatus();
    lastSavedFingerprint = nextFingerprint;
    status.pendingSave = false;
    console.log(`GitHub room storage saved (${reason})`);
  } catch (error) {
    status.pendingSave = false;
    status.lastError = error.message;
    console.warn(`GitHub room storage save failed: ${error.message}`);
  }
}

function readDiskPayload() {
  try {
    if (!fs.existsSync(dataFile)) return null;
    const payload = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    status.lastDiskReadAt = new Date().toISOString();
    return payload;
  } catch (error) {
    status.lastError = error.message;
    return null;
  }
}

function writeDiskPayload(payload) {
  fs.mkdirSync(dataDir, { recursive: true });
  const tempFile = `${dataFile}.github.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2));
  fs.renameSync(tempFile, dataFile);
  status.lastDiskWriteAt = new Date().toISOString();
  lastSavedFingerprint = fingerprint(payload);
}

function hasRooms(payload) {
  return Boolean(payload && typeof payload === "object" && payload.rooms && Object.keys(payload.rooms).length > 0);
}

function fingerprint(value) {
  const text = JSON.stringify(value || {});
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}:${(hash >>> 0).toString(36)}`;
}

function syncStatus() {
  Object.assign(status, store.status, {
    dataFile,
    hydrated: status.hydrated,
    watching: status.watching,
    pendingSave: status.pendingSave,
    lastDiskReadAt: status.lastDiskReadAt,
    lastDiskWriteAt: status.lastDiskWriteAt,
  });
  global.__TripGithubDiskSyncStatus = status;
}

function getGithubDiskSyncStatus() {
  syncStatus();
  return { ...status, tokenConfigured: store.enabled };
}

module.exports = {
  hydrateDiskFromGithub,
  startGithubDiskSync,
  getGithubDiskSyncStatus,
};
