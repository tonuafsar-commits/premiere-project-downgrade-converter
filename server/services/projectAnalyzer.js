const {
  CORE_PRESERVATION_ITEMS,
  FEATURE_RULES,
} = require("../config/compatibilityRules");

function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function analyzeProjectStructure(xmlText) {
  return {
    sequences: countMatches(xmlText, /<Sequence\b/gi),
    bins: countMatches(xmlText, /<(Bin|RootProjectItem)\b/gi),
    videoTracks: countMatches(
      xmlText,
      /<(VideoTrack|Track\b[^>]*MediaType="Video")\b/gi,
    ),
    audioTracks: countMatches(
      xmlText,
      /<(AudioTrack|Track\b[^>]*MediaType="Audio")\b/gi,
    ),
    clips: countMatches(xmlText, /<(ClipItem|Clip\b|MasterClip\b)\b/gi),
    markers: countMatches(xmlText, /<Marker\b/gi),
    transitions: countMatches(
      xmlText,
      /<(Transition|VideoTransition|AudioTransition)\b/gi,
    ),
    effects: countMatches(
      xmlText,
      /<(VideoFilterComponent|AudioFilterComponent|Effect)\b/gi,
    ),
  };
}

function patternExists(xmlText, pattern) {
  const sanitizedFlags = pattern.flags.replace(/g/g, "");
  const localPattern = new RegExp(pattern.source, sanitizedFlags);
  return localPattern.test(xmlText);
}

function detectCompatibilityRisks(xmlText, targetYear) {
  const numericTargetYear = Number(targetYear);
  const unsupportedItems = [];
  const warnings = [];

  for (const rule of FEATURE_RULES) {
    const appliesByVersion = numericTargetYear < rule.minSupportedYear;
    if (!(rule.always || appliesByVersion)) {
      continue;
    }

    if (patternExists(xmlText, rule.pattern)) {
      unsupportedItems.push(rule.label);
      warnings.push(rule.message);
    }
  }

  return {
    unsupportedItems,
    warnings,
  };
}

function getPreservationList() {
  return [...CORE_PRESERVATION_ITEMS];
}

module.exports = {
  analyzeProjectStructure,
  detectCompatibilityRisks,
  getPreservationList,
};
