const fs = require("node:fs/promises");
const path = require("node:path");

async function ensureDirExists(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function sanitizeBaseName(fileName) {
  const parsed = path.parse(fileName || "project");
  const safeBase = (parsed.name || "project")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return safeBase || "project";
}

async function removeIfExists(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function bytesToHumanReadable(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

module.exports = {
  ensureDirExists,
  sanitizeBaseName,
  removeIfExists,
  bytesToHumanReadable,
};
