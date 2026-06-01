const PROJECT_CLASS_ID = "62ad66dd-0dcd-42da-a660-6d8fbde94876";
const UNIVERSAL_COMPAT_VERSION = 1;

function rewriteProjectObjectVersion(xmlText, targetVersion) {
  const preferredRegex = new RegExp(
    `(<Project\\b[^>]*\\bClassID="${PROJECT_CLASS_ID}"[^>]*\\bVersion=")(\\d+)(")`,
    "i",
  );
  const fallbackRegex = /(<Project\b[^>]*\bVersion=")(\d+)(")/i;

  const activeRegex = preferredRegex.test(xmlText) ? preferredRegex : fallbackRegex;
  let didRewrite = false;
  let previousVersion = null;

  const rewritten = xmlText.replace(
    activeRegex,
    (fullMatch, prefix, versionNumber, suffix) => {
      didRewrite = true;
      previousVersion = versionNumber;
      return `${prefix}${targetVersion}${suffix}`;
    },
  );

  return {
    xmlText: rewritten,
    didRewrite,
    previousVersion,
  };
}

function applyMetadataDowngrade(xmlText, sourceVersionInfo, targetPreset) {
  let rewrittenXml = xmlText;
  const changes = [];
  const warnings = [];

  const sourceProjectVersion = sourceVersionInfo.projectObjectVersion;
  const targetProjectVersion = targetPreset.projectObjectVersion;

  if (
    Number.isFinite(sourceProjectVersion) && sourceProjectVersion > targetProjectVersion
  ) {
    // Setting to universal compatibility version is more resilient than trying
    // to rewrite many independent metadata fields.
    const rewrite = rewriteProjectObjectVersion(
      rewrittenXml,
      UNIVERSAL_COMPAT_VERSION,
    );
    rewrittenXml = rewrite.xmlText;
    if (rewrite.didRewrite) {
      changes.push(
        `Project object version ${rewrite.previousVersion} -> ${UNIVERSAL_COMPAT_VERSION}`,
      );
      warnings.push(
        `Applied universal compatibility project version flag for safer downgrade to ${targetPreset.label}.`,
      );
    }
  }

  if (!changes.length) {
    warnings.push(
      "No deterministic metadata rewrite was necessary or possible. Project content was preserved as-is.",
    );
  }

  if (sourceVersionInfo.confidence !== "high") {
    warnings.push(
      "Source version detection confidence is limited; review project content carefully after opening.",
    );
  }

  return {
    xmlText: rewrittenXml,
    changes,
    warnings,
    strategy: changes.length
      ? "universal-version-flag-downgrade"
      : "safe-pass-through",
  };
}

module.exports = {
  applyMetadataDowngrade,
};
