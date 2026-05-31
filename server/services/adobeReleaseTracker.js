const RELEASE_NOTES_URL =
  "https://helpx.adobe.com/premiere-pro/premiere-pro-releasenotes.html";
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const FETCH_TIMEOUT_MS = 9000;

let cachedReleaseInfo = null;
let inFlightPromise = null;

function parseMajor(versionString) {
  if (!versionString) {
    return null;
  }

  const match = String(versionString).match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function extractLatestReleaseInfo(html) {
  if (!html || typeof html !== "string") {
    return null;
  }

  // Adobe generally lists the newest release first. The heading appears in HTML as:
  // "<h2>May 2026 (version 26.2.2)</h2>"
  // but we also support markdown-like export variants with "##".
  const headingPatterns = [
    /<h2[^>]*>\s*([A-Za-z]+)\s+(\d{4})\s+\(version\s+(\d+(?:\.\d+){0,2})\)\s*<\/h2>/i,
    /##\s+([A-Za-z]+)\s+(\d{4})\s+\(version\s+(\d+(?:\.\d+){0,2})\)/i,
  ];

  let headingMatch = null;
  for (const pattern of headingPatterns) {
    headingMatch = html.match(pattern);
    if (headingMatch) {
      break;
    }
  }

  if (!headingMatch) {
    return null;
  }

  const [, monthName, yearText, versionString] = headingMatch;
  const major = parseMajor(versionString);
  const year = Number(yearText);

  const updatedMatch = html.match(
    /(?:Last updated on\s*<\/span>\s*<span[^>]*>|Last updated on\s+)([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
  );
  const lastUpdated = updatedMatch ? updatedMatch[1] : null;

  return {
    available: true,
    latestVersion: versionString,
    latestMajor: major,
    latestYear: Number.isFinite(year) ? year : null,
    releaseHeading: `${monthName} ${yearText}`,
    lastUpdated,
    sourceUrl: RELEASE_NOTES_URL,
    confidence: "high",
  };
}

async function fetchReleaseNotesHtml() {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(RELEASE_NOTES_URL, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "premiere-project-downgrade-converter/1.0 (+https://github.com/tonuafsar-commits/premiere-project-downgrade-converter)",
      },
    });

    if (!response.ok) {
      throw new Error(`Adobe release notes request failed (${response.status}).`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function cacheResult(result) {
  cachedReleaseInfo = {
    ...result,
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
  };
  return cachedReleaseInfo;
}

function isCacheFresh(cacheEntry) {
  if (!cacheEntry?.expiresAt) {
    return false;
  }
  const expiresAt = Date.parse(cacheEntry.expiresAt);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

async function refreshLatestRelease() {
  const html = await fetchReleaseNotesHtml();
  const parsed = extractLatestReleaseInfo(html);
  if (!parsed) {
    throw new Error("Unable to parse latest Adobe Premiere release heading.");
  }
  return cacheResult(parsed);
}

async function getLatestReleaseInfo({ forceRefresh = false } = {}) {
  if (!forceRefresh && isCacheFresh(cachedReleaseInfo)) {
    return {
      ...cachedReleaseInfo,
      fromCache: true,
      stale: false,
      fetchError: null,
    };
  }

  if (!inFlightPromise) {
    inFlightPromise = refreshLatestRelease().finally(() => {
      inFlightPromise = null;
    });
  }

  try {
    const refreshed = await inFlightPromise;
    return {
      ...refreshed,
      fromCache: false,
      stale: false,
      fetchError: null,
    };
  } catch (error) {
    if (cachedReleaseInfo) {
      return {
        ...cachedReleaseInfo,
        fromCache: true,
        stale: true,
        fetchError: error.message,
      };
    }

    return {
      available: false,
      latestVersion: null,
      latestMajor: null,
      latestYear: null,
      releaseHeading: null,
      lastUpdated: null,
      sourceUrl: RELEASE_NOTES_URL,
      confidence: "none",
      fetchedAt: new Date().toISOString(),
      expiresAt: null,
      fromCache: false,
      stale: true,
      fetchError: error.message,
    };
  }
}

module.exports = {
  getLatestReleaseInfo,
};
