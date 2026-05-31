const DEFAULT_TARGET_VERSION = "2023";

// Project Object version mappings are based on widely reported Premiere project
// metadata behavior and kept modular for future updates.
const VERSION_PRESETS = {
  "2026": {
    label: "Premiere Pro 2026",
    appMajor: 26,
    appVersionString: "26.0",
    projectObjectVersion: 44,
    confidence: "estimated",
  },
  "2025": {
    label: "Premiere Pro 2025",
    appMajor: 25,
    appVersionString: "25.0",
    projectObjectVersion: 43,
    confidence: "high",
  },
  "2024": {
    label: "Premiere Pro 2024",
    appMajor: 24,
    appVersionString: "24.0",
    projectObjectVersion: 42,
    confidence: "high",
  },
  "2023": {
    label: "Premiere Pro 2023",
    appMajor: 23,
    appVersionString: "23.0",
    projectObjectVersion: 41,
    confidence: "high",
  },
  "2022": {
    label: "Premiere Pro 2022",
    appMajor: 22,
    appVersionString: "22.0",
    projectObjectVersion: 40,
    confidence: "high",
  },
  "2021": {
    label: "Premiere Pro 2021",
    appMajor: 15,
    appVersionString: "15.0",
    projectObjectVersion: 39,
    confidence: "high",
  },
  "2020": {
    label: "Premiere Pro 2020",
    appMajor: 14,
    appVersionString: "14.0",
    projectObjectVersion: 38,
    confidence: "high",
  },
};

function listVersionPresets() {
  return Object.entries(VERSION_PRESETS)
    .sort((left, right) => Number(right[0]) - Number(left[0]))
    .map(([year, preset]) => ({
      year,
      ...preset,
    }));
}

function getVersionPreset(targetYear) {
  return VERSION_PRESETS[String(targetYear)] || null;
}

function guessYearFromProjectVersion(projectObjectVersion) {
  if (!Number.isFinite(projectObjectVersion)) {
    return null;
  }

  const exact = Object.entries(VERSION_PRESETS).find(
    ([, preset]) => preset.projectObjectVersion === projectObjectVersion,
  );

  if (exact) {
    return exact[0];
  }

  const closest = Object.entries(VERSION_PRESETS)
    .map(([year, preset]) => ({ year, version: preset.projectObjectVersion }))
    .sort((left, right) => right.version - left.version)
    .find((entry) => projectObjectVersion >= entry.version);

  return closest ? closest.year : null;
}

module.exports = {
  DEFAULT_TARGET_VERSION,
  VERSION_PRESETS,
  listVersionPresets,
  getVersionPreset,
  guessYearFromProjectVersion,
};
