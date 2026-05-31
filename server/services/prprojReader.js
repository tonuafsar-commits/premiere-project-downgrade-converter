const fs = require("node:fs/promises");
const zlib = require("node:zlib");
const { UserFacingError } = require("../utils/errors");

const GZIP_SIGNATURE = Buffer.from([0x1f, 0x8b]);

function hasGzipHeader(buffer) {
  if (!buffer || buffer.length < 2) {
    return false;
  }
  return buffer[0] === GZIP_SIGNATURE[0] && buffer[1] === GZIP_SIGNATURE[1];
}

function countNullBytes(buffer) {
  let total = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] === 0) {
      total += 1;
    }
  }
  return total;
}

function assertLooksLikeProjectXml(xmlText) {
  if (!xmlText || typeof xmlText !== "string") {
    throw new UserFacingError(
      "Project data is empty or unreadable.",
      "INVALID_PROJECT",
      400,
    );
  }

  const head = xmlText.slice(0, 8000);
  const isLikelyXml = /<\?xml/i.test(head);
  const hasPremiereMarkers =
    /<PremiereData/i.test(head) || /<Project\b/i.test(head);

  if (!isLikelyXml && !hasPremiereMarkers) {
    throw new UserFacingError(
      "This file does not look like a valid Premiere Pro project.",
      "UNSUPPORTED_FILE_CONTENT",
      400,
    );
  }
}

async function readPrprojFile(filePath) {
  const originalBuffer = await fs.readFile(filePath);
  if (!originalBuffer || !originalBuffer.length) {
    throw new UserFacingError(
      "The uploaded file is empty.",
      "EMPTY_FILE",
      400,
    );
  }

  const isCompressed = hasGzipHeader(originalBuffer);
  let xmlBuffer = originalBuffer;
  let compression = "plain";

  if (isCompressed) {
    try {
      xmlBuffer = zlib.gunzipSync(originalBuffer);
      compression = "gzip";
    } catch (error) {
      throw new UserFacingError(
        "The project archive could not be decompressed.",
        "INVALID_GZIP_PROJECT",
        400,
        { rootCause: error.message },
      );
    }
  }

  const nullByteRatio = countNullBytes(xmlBuffer) / Math.max(1, xmlBuffer.length);
  if (nullByteRatio > 0.02) {
    throw new UserFacingError(
      "This project appears to contain unsupported binary data.",
      "BINARY_PROJECT_NOT_SUPPORTED",
      400,
    );
  }

  const xmlText = xmlBuffer.toString("utf8");
  assertLooksLikeProjectXml(xmlText);

  return {
    xmlText,
    compression,
    sourceSizeBytes: originalBuffer.length,
    decodedSizeBytes: xmlBuffer.length,
  };
}

function encodePrprojFile(xmlText, compression) {
  const xmlBuffer = Buffer.from(xmlText, "utf8");
  if (compression === "gzip") {
    return zlib.gzipSync(xmlBuffer);
  }
  return xmlBuffer;
}

module.exports = {
  readPrprojFile,
  encodePrprojFile,
};
