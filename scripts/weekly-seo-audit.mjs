import fs from "node:fs/promises";

const DEFAULT_BASE_URL = "https://premiere-project-downgrade-converte.vercel.app";
const DEFAULT_OUTPUT_PATH = "seo-weekly-report.md";
const PRIMARY_KEYWORD = "premiere pro project downgrader";
const SECONDARY_KEYWORDS = [
  "premiere pro project converter",
  "downgrade prproj",
  "premiere pro 2023",
];

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === "--base-url") {
      args.baseUrl = argv[i + 1];
      i += 1;
    } else if (current === "--out") {
      args.outputPath = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) {
    return DEFAULT_BASE_URL;
  }
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function countKeyword(text, keyword) {
  if (!text || !keyword) {
    return 0;
  }
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.toLowerCase().match(new RegExp(escaped, "g"));
  return match ? match.length : 0;
}

function stripHtmlTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickFirst(regex, text) {
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function listAll(regex, text) {
  const out = [];
  let match = regex.exec(text);
  while (match) {
    const value = match[1] ?? match[0];
    out.push(String(value).trim());
    match = regex.exec(text);
  }
  return out;
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "weekly-seo-audit/1.0 (+https://github.com/tonuafsar-commits/premiere-project-downgrade-converter)",
    },
  });
  const text = await response.text();
  return {
    url,
    status: response.status,
    ok: response.ok,
    text,
  };
}

function parseSitemap(xmlText) {
  const urls = listAll(/<loc>([^<]+)<\/loc>/gi, xmlText)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return [...new Set(urls)];
}

function buildFallbackUrls(baseUrl) {
  return [
    `${baseUrl}/`,
    `${baseUrl}/premiere-pro-project-downgrader-guide.html`,
  ];
}

function assessPage({ url, html, status }) {
  const title = pickFirst(/<title>([^<]+)<\/title>/i, html);
  const description = pickFirst(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    html,
  );
  const canonical = pickFirst(
    /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i,
    html,
  );
  const h1List = listAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, html).map((entry) =>
    stripHtmlTags(entry),
  );
  const jsonLdCount =
    (html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>/gi) || [])
      .length;
  const ogTitle = pickFirst(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    html,
  );
  const bodyText = stripHtmlTags(html);
  const internalLinks = listAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi, html).filter(
    (href) => href.startsWith("/") || href.includes("premiere-project-downgrade-converte.vercel.app"),
  );

  const primaryKeywordCount = countKeyword(bodyText, PRIMARY_KEYWORD);
  const secondaryKeywordHits = SECONDARY_KEYWORDS.reduce(
    (sum, keyword) => sum + (countKeyword(bodyText, keyword) > 0 ? 1 : 0),
    0,
  );

  const checks = [];
  checks.push({
    name: "HTTP Status",
    pass: status === 200,
    detail: `Status ${status}`,
  });
  checks.push({
    name: "Title Tag",
    pass: Boolean(title) && title.length >= 45 && title.length <= 70,
    detail: title ? `${title.length} chars` : "missing",
  });
  checks.push({
    name: "Meta Description",
    pass: Boolean(description) && description.length >= 120 && description.length <= 170,
    detail: description ? `${description.length} chars` : "missing",
  });
  checks.push({
    name: "Canonical URL",
    pass: Boolean(canonical),
    detail: canonical || "missing",
  });
  checks.push({
    name: "Single H1",
    pass: h1List.length === 1,
    detail: `${h1List.length} h1 tags`,
  });
  checks.push({
    name: "Structured Data",
    pass: jsonLdCount >= 1,
    detail: `${jsonLdCount} JSON-LD blocks`,
  });
  checks.push({
    name: "Open Graph Title",
    pass: Boolean(ogTitle),
    detail: ogTitle || "missing",
  });
  checks.push({
    name: "Primary Keyword Coverage",
    pass: primaryKeywordCount >= 2,
    detail: `${primaryKeywordCount} mentions`,
  });
  checks.push({
    name: "Secondary Keyword Coverage",
    pass: secondaryKeywordHits >= 2,
    detail: `${secondaryKeywordHits}/${SECONDARY_KEYWORDS.length} keyword groups present`,
  });
  checks.push({
    name: "Internal Links",
    pass: internalLinks.length >= 2,
    detail: `${internalLinks.length} internal links`,
  });

  const totalChecks = checks.length;
  const passedChecks = checks.filter((entry) => entry.pass).length;
  const score = Math.round((passedChecks / totalChecks) * 100);

  const failedChecks = checks.filter((entry) => !entry.pass);
  const recommendations = failedChecks.map(
    (check) => `Improve ${check.name.toLowerCase()} (${check.detail}).`,
  );

  return {
    url,
    title,
    description,
    canonical,
    h1: h1List[0] || null,
    score,
    checks,
    recommendations,
  };
}

function buildReport({ baseUrl, sitemapStatus, sitemapUrl, pages, pageAssessments }) {
  const now = new Date();
  const passedCount = pageAssessments.reduce(
    (sum, page) => sum + page.checks.filter((entry) => entry.pass).length,
    0,
  );
  const totalCount = pageAssessments.reduce((sum, page) => sum + page.checks.length, 0);
  const averageScore = Math.round(
    pageAssessments.reduce((sum, page) => sum + page.score, 0) /
      Math.max(1, pageAssessments.length),
  );

  const topRecommendations = pageAssessments
    .flatMap((page) =>
      page.recommendations.map((entry) => ({
        page: page.url,
        recommendation: entry,
      })),
    )
    .slice(0, 8);

  const lines = [];
  lines.push(`# Weekly SEO Audit Report`);
  lines.push("");
  lines.push(`- Date: ${now.toISOString()}`);
  lines.push(`- Base URL: ${baseUrl}`);
  lines.push(`- Sitemap URL: ${sitemapUrl}`);
  lines.push(`- Sitemap HTTP status: ${sitemapStatus}`);
  lines.push(`- Pages audited: ${pages.length}`);
  lines.push(`- Overall checks passed: ${passedCount}/${totalCount}`);
  lines.push(`- Average on-page score: ${averageScore}/100`);
  lines.push("");
  lines.push(`## Page Scores`);
  lines.push("");

  for (const page of pageAssessments) {
    lines.push(`### ${page.url}`);
    lines.push(`- Score: ${page.score}/100`);
    lines.push(`- Title: ${page.title || "missing"}`);
    lines.push(`- H1: ${page.h1 || "missing"}`);
    lines.push(`- Canonical: ${page.canonical || "missing"}`);
    lines.push(`- Meta description length: ${page.description ? page.description.length : 0}`);
    lines.push(`- Passed checks: ${page.checks.filter((entry) => entry.pass).length}/${page.checks.length}`);
    lines.push("");
    lines.push(`Checks:`);
    for (const check of page.checks) {
      const marker = check.pass ? "PASS" : "FAIL";
      lines.push(`- ${marker}: ${check.name} (${check.detail})`);
    }
    lines.push("");
  }

  lines.push(`## Top Recommendations`);
  lines.push("");
  if (!topRecommendations.length) {
    lines.push(`- Keep publishing fresh keyword-relevant content and earning backlinks.`);
  } else {
    for (const item of topRecommendations) {
      lines.push(`- ${item.recommendation} Page: ${item.page}`);
    }
  }

  lines.push("");
  lines.push(`## External SEO Actions Required`);
  lines.push("");
  lines.push(`- Submit sitemap in Google Search Console and Bing Webmaster Tools.`);
  lines.push(`- Build quality backlinks from video-editing communities, blogs, and tool directories.`);
  lines.push(`- Publish weekly content targeting long-tail queries around Premiere project downgrade workflows.`);
  lines.push(`- Track target keyword movement manually in Search Console performance reports.`);
  lines.push("");

  return lines.join("\n");
}

async function run() {
  const args = parseArgs(process.argv);
  const baseUrl = normalizeBaseUrl(args.baseUrl);
  const outputPath = args.outputPath || DEFAULT_OUTPUT_PATH;
  const sitemapUrl = `${baseUrl}/sitemap.xml`;

  let sitemapStatus = "unavailable";
  let pages = [];

  try {
    const sitemapResponse = await fetchText(sitemapUrl);
    sitemapStatus = String(sitemapResponse.status);
    if (sitemapResponse.ok) {
      pages = parseSitemap(sitemapResponse.text);
    }
  } catch (error) {
    sitemapStatus = `error: ${error.message}`;
  }

  if (!pages.length) {
    pages = buildFallbackUrls(baseUrl);
  }

  const pageAssessments = [];
  for (const pageUrl of pages) {
    try {
      const pageResponse = await fetchText(pageUrl);
      pageAssessments.push(
        assessPage({
          url: pageUrl,
          html: pageResponse.text,
          status: pageResponse.status,
        }),
      );
    } catch (error) {
      pageAssessments.push(
        assessPage({
          url: pageUrl,
          html: "",
          status: 0,
        }),
      );
    }
  }

  const report = buildReport({
    baseUrl,
    sitemapStatus,
    sitemapUrl,
    pages,
    pageAssessments,
  });

  await fs.writeFile(outputPath, report, "utf8");
  console.log(`SEO report saved to ${outputPath}`);
}

run().catch((error) => {
  console.error("SEO audit failed:", error);
  process.exitCode = 1;
});
