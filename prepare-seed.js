"use strict";

const fs = require("fs");
const path = require("path");
const seed = require("./imported-itinerary");

// Render environment-variable names are case-sensitive. Support the user's
// existing `deepseek` key while keeping the server-side canonical name.
const configuredDeepSeekKey = process.env.DEEPSEEK_API_KEY || process.env.deepseek || process.env.DEEPSEEK;
if (configuredDeepSeekKey && !process.env.DEEPSEEK_API_KEY) {
  process.env.DEEPSEEK_API_KEY = configuredDeepSeekKey;
}
if (!process.env.DEEPSEEK_MODEL) {
  process.env.DEEPSEEK_MODEL = "deepseek-chat";
}

const root = __dirname;
const renderDiskDir = "/var/data";
const dataDir = process.env.DATA_DIR || (fs.existsSync(renderDiskDir) ? renderDiskDir : path.join(root, "data"));
const dataFile = process.env.DATA_FILE || path.join(dataDir, "rooms.json");

try {
  fs.mkdirSync(dataDir, { recursive: true });
  let payload = { version: 1, savedAt: new Date().toISOString(), rooms: {} };

  if (fs.existsSync(dataFile)) {
    try {
      payload = JSON.parse(fs.readFileSync(dataFile, "utf8"));
      payload.rooms ||= {};
    } catch (error) {
      console.warn(`Could not parse existing room data before import: ${error.message}`);
    }
  }

  const existing = payload.rooms[seed.roomId];
  if (existing?.lists?.length) {
    const index = existing.lists.findIndex((item) => item.id === seed.list.id);
    if (index >= 0) {
      existing.lists[index] = seed.list;
    } else {
      existing.lists.push(seed.list);
    }
    existing.activeListId = seed.list.id;
    existing.updatedAt = Math.max(existing.updatedAt || 0, seed.list.updatedAt);
  } else {
    payload.rooms[seed.roomId] = {
      version: 2,
      activeListId: seed.list.id,
      lists: [seed.list],
      updatedAt: seed.list.updatedAt,
    };
  }

  payload.savedAt = new Date().toISOString();
  fs.writeFileSync(dataFile, JSON.stringify(payload, null, 2));
  console.log(`Imported itinerary list into room ${seed.roomId}`);
} catch (error) {
  console.warn(`Could not import itinerary seed: ${error.message}`);
}

require("./server");
