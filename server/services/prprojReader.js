const fs = require("node:fs/promises");
const zlib = require("node:zlib");
const { UserFacingError } = require("../utils/errors");

const GZIP_SIGNATURE = Buffer.from([0x1f, 0x8b]);
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const UTF16LE_BOM = Buffer.from([0xff, 0xfe]);
const UTF16BE_BOM = Buffer.from([0xfe, 0xff]);

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

function looksLikeUtf16LeWithoutBom(buffer) {
  if (!buffer || buffer.length < 8) {
    return false;
  }
  return (
    buffer[1] === 0 &&
    buffer[3] === 0 &&
    buffer[5] === 0 &&
    buffer[7] === 0
  );
}

function looksLikeUtf16BeWithoutBom(buffer) {
  if (!buffer || buffer.length < 8) {
    return false;
  }
  return (
    buffer[0] === 0 &&
    buffer[2] === 0 &&
    buffer[4] === 0 &&
    buffer[6] === 0
  );
}

function toUtf16BeBuffer(xmlText) {
  const utf16Le = Buffer.from(xmlText, "utf16le");
  const utf16Be = Buffer.from(utf16Le);
  utf16Be.swap16();
  return utf16Be;
}

function decodeXmlBuffer(xmlBuffer) {
  if (!xmlBuffer?.length) {
    return {
      xmlText: "",
      encodingMeta: {
        encoding: "utf8",
        hasBom: false,
      },
    };
  }

  if (xmlBuffer.subarray(0, UTF8_BOM.length).equals(UTF8_BOM)) {
    return {
      xmlText: xmlBuffer.subarray(UTF8_BOM.length).toString("utf8"),
      encodingMeta: {
        encoding: "utf8",
        hasBom: true,
      },
    };
  }

  if (xmlBuffer.subarray(0, UTF16LE_BOM.length).equals(UTF16LE_BOM)) {
    return {
      xmlText: xmlBuffer.subarray(UTF16LE_BOM.length).toString("utf16le"),
      encodingMeta: {
        encoding: "utf16le",
        hasBom: true,
      },
    };
  }

  if (xmlBuffer.subarray(0, UTF16BE_BOM.length).equals(UTF16BE_BOM)) {
    const noBom = Buffer.from(xmlBuffer.subarray(UTF16BE_BOM.length));
    noBom.swap16();
    return {
      xmlText: noBom.toString("utf16le"),
      encodingMeta: {
        encoding: "utf16be",
        hasBom: true,
      },
    };
  }

  if (looksLikeUtf16LeWithoutBom(xmlBuffer)) {
    return {
      xmlText: xmlBuffer.toString("utf16le"),
      encodingMeta: {
        encoding: "utf16le",
        hasBom: false,
      },
    };
  }

  if (looksLikeUtf16BeWithoutBom(xmlBuffer)) {
    const swapped = Buffer.from(xmlBuffer);
    swapped.swap16();
    return {
      xmlText: swapped.toString("utf16le"),
      encodingMeta: {
        encoding: "utf16be",
        hasBom: false,
      },
    };
  }

  return {
    xmlText: xmlBuffer.toString("utf8"),
    encodingMeta: {
      encoding: "utf8",
      hasBom: false,
    },
  };
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

  const decoded = decodeXmlBuffer(xmlBuffer);
  const xmlText = decoded.xmlText;
  const nullByteRatio = countNullBytes(Buffer.from(xmlText, "utf8")) /
    Math.max(1, Buffer.byteLength(xmlText, "utf8"));
  if (nullByteRatio > 0.05) {
    throw new UserFacingError(
      "This project appears to contain unsupported binary data.",
      "BINARY_PROJECT_NOT_SUPPORTED",
      400,
    );
  }
  assertLooksLikeProjectXml(xmlText);

  return {
    xmlText,
    compression,
    encodingMeta: decoded.encodingMeta,
    sourceSizeBytes: originalBuffer.length,
    decodedSizeBytes: xmlBuffer.length,
  };
}

function encodeXmlBuffer(xmlText, encodingMeta) {
  const encoding = encodingMeta?.encoding || "utf8";
  const hasBom = Boolean(encodingMeta?.hasBom);

  if (encoding === "utf16le") {
    const payload = Buffer.from(xmlText, "utf16le");
    return hasBom ? Buffer.concat([UTF16LE_BOM, payload]) : payload;
  }

  if (encoding === "utf16be") {
    const payload = toUtf16BeBuffer(xmlText);
    return hasBom ? Buffer.concat([UTF16BE_BOM, payload]) : payload;
  }

  const utf8Payload = Buffer.from(xmlText, "utf8");
  return hasBom ? Buffer.concat([UTF8_BOM, utf8Payload]) : utf8Payload;
}

function encodePrprojFile(xmlText, compression, encodingMeta) {
  const xmlBuffer = encodeXmlBuffer(xmlText, encodingMeta);
  if (compression === "gzip") {
    return zlib.gzipSync(xmlBuffer);
  }
  return xmlBuffer;
}

module.exports = {
  readPrprojFile,
  encodePrprojFile,
};
