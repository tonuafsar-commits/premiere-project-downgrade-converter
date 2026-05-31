function parseMajor(versionString) {
  if (!versionString) {
    return null;
  }
  const match = String(versionString).match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function applyMetadataDowngrade(xmlText, sourceVersionInfo, targetPreset) {
  const headerLimit = Math.min(xmlText.length, 50000);
  const header = xmlText.slice(0, headerLimit);
  const remainder = xmlText.slice(headerLimit);

  let rewrittenHeader = header;
  const changes = [];
  const warnings = [];

  const sourceProjectVersion = sourceVersionInfo.projectObjectVersion;
  const targetProjectVersion = targetPreset.projectObjectVersion;

  if (
    Number.isFinite(sourceProjectVersion) &&
    Number.isFinite(targetProjectVersion) &&
    sourceProjectVersion > targetProjectVersion
  ) {
    const preferredRegex =
      /(<Project\b[^>]*\bClassID="62ad66dd-0dcd-42da-a660-6d8fbde94876"[^>]*\bVersion=")(\d+)(")/i;
    const fallbackRegex = /(<Project\b[^>]*\bVersion=")(\d+)(")/i;
    const activeRegex = preferredRegex.test(rewrittenHeader)
      ? preferredRegex
      : fallbackRegex;

    rewrittenHeader = rewrittenHeader.replace(
      activeRegex,
      (fullMatch, prefix, versionNumber, suffix) => {
        changes.push(
          `Project object version ${versionNumber} -> ${targetProjectVersion}`,
        );
        return `${prefix}${targetProjectVersion}${suffix}`;
      },
    );
  }

  const sourceAppMajor = Number(sourceVersionInfo.appMajor);
  const targetAppMajor = Number(targetPreset.appMajor);
  const shouldDowngradeAppVersion =
    Number.isFinite(sourceAppMajor) &&
    Number.isFinite(targetAppMajor) &&
    sourceAppMajor > targetAppMajor;

  if (shouldDowngradeAppVersion) {
    const appVersionRegex =
      /(\b(?:AppVersion|ApplicationVersion|CreatorVersion|BuildVersion|ProductVersion)\s*=\s*")(\d+\.\d+(?:\.\d+)*)(")/gi;

    rewrittenHeader = rewrittenHeader.replace(
      appVersionRegex,
      (fullMatch, prefix, versionNumber, suffix) => {
        const major = parseMajor(versionNumber);
        if (!Number.isFinite(major) || major <= targetAppMajor) {
          return fullMatch;
        }
        changes.push(
          `Application metadata ${versionNumber} -> ${targetPreset.appVersionString}`,
        );
        return `${prefix}${targetPreset.appVersionString}${suffix}`;
      },
    );
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
    xmlText: rewrittenHeader + remainder,
    changes,
    warnings,
    strategy: changes.length ? "direct-metadata-downgrade" : "safe-pass-through",
  };
}

module.exports = {
  applyMetadataDowngrade,
};
