const CORE_PRESERVATION_ITEMS = [
  "Project hierarchy (bins and folders)",
  "Sequence list and ordering",
  "Track structure and arrangement",
  "Clip placement, trims, and timing references",
  "Markers (clip and sequence where detected)",
  "Media linkage metadata and path references",
];

const FEATURE_RULES = [
  {
    key: "textBasedEditingV2",
    label: "Text-based editing metadata",
    minSupportedYear: 2024,
    pattern: /TextBased|Transcript|AutoTranscription/gi,
    message:
      "Text-based editing metadata may not open correctly in the selected older version.",
  },
  {
    key: "aiGenerativeMetadata",
    label: "Generative or AI-assisted metadata",
    minSupportedYear: 2024,
    pattern: /Generative|AIAssist|Sensei|GenExtend|GenErase/gi,
    message:
      "AI-assisted metadata appears in this project and may be ignored by older Premiere versions.",
  },
  {
    key: "newColorManagement",
    label: "New color management metadata",
    minSupportedYear: 2024,
    pattern: /WideGamut|ToneMap|ColorManagementV2|DisplayColor/gi,
    message:
      "Newer color-management properties may not be fully interpreted after downgrade.",
  },
  {
    key: "enhancedCaptions",
    label: "Advanced captions or text styling",
    minSupportedYear: 2024,
    pattern: /CaptionStyle|SpeechToText|SubtitleStyleV2/gi,
    message:
      "Caption styling metadata might partially degrade in older versions.",
  },
  {
    key: "pluginOrEffectRisk",
    label: "Third-party plugin or effect metadata",
    minSupportedYear: 1900,
    always: true,
    pattern: /Plugin|ThirdParty|OFX|VST|LUTPath/gi,
    message:
      "Some plugins/effects can break across versions and should be manually verified in Premiere Pro 2023.",
  },
];

module.exports = {
  CORE_PRESERVATION_ITEMS,
  FEATURE_RULES,
};
