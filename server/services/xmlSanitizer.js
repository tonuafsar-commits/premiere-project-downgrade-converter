function removeInvalidXmlCodepoints(value) {
  // Keep XML 1.0 valid character ranges:
  // #x9 | #xA | #xD | #x20-#xD7FF | #xE000-#xFFFD | #x10000-#x10FFFF
  return value.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/g, "");
}

function sanitizeMalformedNamelessTags(value) {
  // Known malformed fragments observed in problematic Premiere projects:
  // <>-21.2545948029</>
  // Remove them entirely because unnamed elements are invalid XML.
  const pattern = /<>\s*[^<]*\s*<\/>/g;
  const matches = value.match(pattern);
  const count = matches ? matches.length : 0;
  return {
    output: value.replace(pattern, ""),
    removedCount: count,
  };
}

function sanitizeProjectXml(xmlText) {
  const notes = [];
  let output = xmlText;

  const malformedResult = sanitizeMalformedNamelessTags(output);
  if (malformedResult.removedCount > 0) {
    notes.push(
      `Removed ${malformedResult.removedCount} malformed nameless XML tag(s).`,
    );
    output = malformedResult.output;
  }

  const cleanedCodepoints = removeInvalidXmlCodepoints(output);
  if (cleanedCodepoints !== output) {
    notes.push("Removed invalid XML control character(s).");
    output = cleanedCodepoints;
  }

  return {
    xmlText: output,
    notes,
  };
}

module.exports = {
  sanitizeProjectXml,
};
