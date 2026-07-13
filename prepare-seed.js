"use strict";

const fs = require("fs");
const path = require("path");

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

try {
  fs.mkdirSync(dataDir, { recursive: true });
} catch (error) {
  console.warn(`Could not prepare data directory: ${error.message}`);
}

require("./server");
