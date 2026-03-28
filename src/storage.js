const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "..", "data");
const dataFile = path.join(dataDir, "guilds.json");

function ensureStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({}, null, 2), "utf8");
  }
}

function readData() {
  ensureStorage();
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

function writeData(data) {
  ensureStorage();
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), "utf8");
}

function getGuildConfig(guildId) {
  const data = readData();
  return data[guildId] ?? null;
}

function updateGuildConfig(guildId, updater) {
  const data = readData();
  const current = data[guildId] ?? {};
  data[guildId] = updater(current);
  writeData(data);
  return data[guildId];
}

module.exports = {
  getGuildConfig,
  updateGuildConfig
};
