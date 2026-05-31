const { guessYearFromProjectVersion } = require("../config/versions");

function parseMajor(versionString) {
  if (!versionString) {
    return null;
  }
  const match = String(versionString).match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function detectProjectObjectVersion(xmlHead) {
  const preferred =
    /<Project\b[^>]*\bClassID="62ad66dd-0dcd-42da-a660-6d8fbde94876"[^>]*\bVersion="(\d+)"/i;
  const fallback = /<Project\b[^>]*\bVersion="(\d+)"/i;

  const preferredMatch = xmlHead.match(preferred);
  if (preferredMatch) {
    return Number(preferredMatch[1]);
  }

  const fallbackMatch = xmlHead.match(fallback);
  return fallbackMatch ? Number(fallbackMatch[1]) : null;
}

function detectDottedVersions(xmlHead) {
  const matches = [];
  const regex =
    /\b(?:AppVersion|ApplicationVersion|CreatorVersion|BuildVersion|Version)\s*=\s*"(\d+\.\d+(?:\.\d+)*)"/gi;

  let match = regex.exec(xmlHead);
  while (match) {
    const version = match[1];
    matches.push({
      raw: version,
      major: parseMajor(version),
    });
    match = regex.exec(xmlHead);
  }

  return matches;
}

function detectSourceVersion(xmlText) {
  const xmlHead = xmlText.slice(0, 20000);
  const projectObjectVersion = detectProjectObjectVersion(xmlHead);
  const dottedMatches = detectDottedVersions(xmlHead);
  const highestDotted = dottedMatches
    .filter((entry) => Number.isFinite(entry.major))
    .sort((left, right) => right.major - left.major)[0];

  const yearGuess = guessYearFromProjectVersion(projectObjectVersion);

  return {
    projectObjectVersion,
    appMajor: highestDotted ? highestDotted.major : null,
    appVersionString: highestDotted ? highestDotted.raw : null,
    yearGuess,
    confidence: yearGuess ? "high" : "medium",
  };
}

module.exports = {
  detectSourceVersion,
};
