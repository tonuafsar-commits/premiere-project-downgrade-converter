const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { XMLValidator } = require("fast-xml-parser");
const { getVersionPreset } = require("../config/versions");
const { UserFacingError } = require("../utils/errors");
const { sanitizeBaseName, bytesToHumanReadable } = require("../utils/fileUtils");
const { readPrprojFile, encodePrprojFile } = require("./prprojReader");
const { detectSourceVersion } = require("./versionDetector");
const { analyzeProjectStructure, detectCompatibilityRisks, getPreservationList } = require("./projectAnalyzer");
const { applyMetadataDowngrade } = require("./metadataDowngrade");
const { sanitizeProjectXml } = require("./xmlSanitizer");

const MAX_UPLOAD_SIZE_BYTES = 200 * 1024 * 1024;

function assertSupportedFile(uploadPath, originalName, fileSizeBytes) {
  const lowerName = String(originalName || "").toLowerCase();
  if (!lowerName.endsWith(".prproj")) {
    throw new UserFacingError(
      "Only .prproj files are supported.",
      "UNSUPPORTED_FILE_TYPE",
      400,
    );
  }

  if (fileSizeBytes <= 0) {
    throw new UserFacingError(
      "The uploaded file is empty.",
      "EMPTY_FILE",
      400,
    );
  }

  if (fileSizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    throw new UserFacingError(
      `File is too large. Maximum allowed size is ${bytesToHumanReadable(MAX_UPLOAD_SIZE_BYTES)}.`,
      "FILE_TOO_LARGE",
      413,
    );
  }

  if (!uploadPath) {
    throw new UserFacingError(
      "Upload path is missing.",
      "MISSING_UPLOAD",
      400,
    );
  }
}

function buildSourceVersionLabel(sourceVersion) {
  if (sourceVersion.yearGuess) {
    return `Premiere Pro ${sourceVersion.yearGuess} (estimated)`;
  }
  if (sourceVersion.projectObjectVersion) {
    return `Project Object Version ${sourceVersion.projectObjectVersion}`;
  }
  if (sourceVersion.appVersionString) {
    return `Premiere ${sourceVersion.appVersionString}`;
  }
  return "Unknown";
}

function determineFinalStatus({ unsupportedItems, warnings }) {
  if (unsupportedItems.length) {
    return "partially_successful";
  }
  if (warnings.length) {
    return "partially_successful";
  }
  return "successful";
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function validateXmlOrThrow(xmlText, stageLabel) {
  const validationResult = XMLValidator.validate(xmlText);
  if (validationResult === true) {
    return;
  }

  const error = validationResult?.err || {};
  const location = Number.isFinite(error.line)
    ? `line ${error.line}, column ${error.col || 1}`
    : "unknown location";
  const message = error.msg || "XML validation failed.";

  throw new UserFacingError(
    `${stageLabel} produced invalid project XML (${location}): ${message}`,
    "INVALID_XML_AFTER_CONVERSION",
    422,
  );
}

async function convertProject({
  jobId,
  uploadPath,
  originalName,
  targetYear,
  outputDir,
  onProgress,
}) {
  const targetPreset = getVersionPreset(targetYear);
  if (!targetPreset) {
    throw new UserFacingError(
      `Unsupported target version: ${targetYear}`,
      "UNSUPPORTED_TARGET_VERSION",
      400,
    );
  }

  const fileStats = await fs.stat(uploadPath);
  assertSupportedFile(uploadPath, originalName, fileStats.size);
  onProgress(10, "Uploaded file validated");

  const sourcePayload = await readPrprojFile(uploadPath);
  onProgress(26, "Project file decoded");

  const sourceSanitization = sanitizeProjectXml(sourcePayload.xmlText);
  validateXmlOrThrow(sourceSanitization.xmlText, "Input sanitization");

  const sourceVersion = detectSourceVersion(sourceSanitization.xmlText);
  onProgress(38, "Source version detected");

  const structureMetrics = analyzeProjectStructure(sourceSanitization.xmlText);
  onProgress(50, "Project structure analyzed");

  const rewriteResult = applyMetadataDowngrade(
    sourceSanitization.xmlText,
    sourceVersion,
    targetPreset,
  );
  onProgress(68, "Compatibility metadata adjusted");

  const outputSanitization = sanitizeProjectXml(rewriteResult.xmlText);
  validateXmlOrThrow(outputSanitization.xmlText, "Conversion");

  const riskResult = detectCompatibilityRisks(outputSanitization.xmlText, targetYear);
  const warnings = dedupe([
    ...sourceSanitization.notes,
    ...outputSanitization.notes,
    ...rewriteResult.warnings,
    ...riskResult.warnings,
  ]);
  const unsupportedItems = dedupe(riskResult.unsupportedItems);
  onProgress(80, "Compatibility risks analyzed");

  const safeBaseName = sanitizeBaseName(originalName);
  const conversionId = jobId || randomUUID();
  const outputFileName = `${safeBaseName}-downgraded-to-${targetYear}-${conversionId}.prproj`;
  const outputPath = path.join(outputDir, outputFileName);

  const encodedProject = encodePrprojFile(
    outputSanitization.xmlText,
    sourcePayload.compression,
    sourcePayload.encodingMeta,
  );
  await fs.writeFile(outputPath, encodedProject);
  onProgress(90, "Converted project generated");

  const report = {
    conversionId,
    timestamp: new Date().toISOString(),
    status: determineFinalStatus({ unsupportedItems, warnings }),
    sourceVersion: {
      detectedLabel: buildSourceVersionLabel(sourceVersion),
      projectObjectVersion: sourceVersion.projectObjectVersion,
      appVersionString: sourceVersion.appVersionString,
      yearGuess: sourceVersion.yearGuess,
      detectionConfidence: sourceVersion.confidence,
    },
    targetVersion: {
      year: String(targetYear),
      label: targetPreset.label,
      projectObjectVersion: targetPreset.projectObjectVersion,
      appVersionString: targetPreset.appVersionString,
      mappingConfidence: targetPreset.confidence,
    },
    structure: structureMetrics,
    preservedItems: getPreservationList(),
    unsupportedItems,
    warnings,
    appliedChanges: rewriteResult.changes,
    sanitizationNotes: dedupe([
      ...sourceSanitization.notes,
      ...outputSanitization.notes,
    ]),
    strategy: rewriteResult.strategy,
    fallbackGuidance: unsupportedItems.length
      ? "If the downgraded project behaves unexpectedly, export/import sequence XML from a matching Premiere version and relink media."
      : null,
    output: {
      fileName: outputFileName,
      sizeBytes: encodedProject.length,
      sizeReadable: bytesToHumanReadable(encodedProject.length),
      compression: sourcePayload.compression,
    },
  };

  const reportFileName = `${safeBaseName}-conversion-report-${conversionId}.json`;
  const reportPath = path.join(outputDir, reportFileName);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  onProgress(100, "Conversion complete");

  return {
    outputPath,
    outputFileName,
    reportPath,
    reportFileName,
    report,
  };
}

module.exports = {
  convertProject,
};
