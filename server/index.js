const path = require("node:path");
const express = require("express");
const multer = require("multer");
const { createConversionRouter } = require("./routes/conversionRoutes");
const { JobStore } = require("./services/jobStore");
const { ensureDirExists } = require("./utils/fileUtils");
const { UserFacingError } = require("./utils/errors");

const PORT = Number(process.env.PORT || 5050);
const app = express();

const projectRoot = path.resolve(__dirname, "..");
const uploadsDir = path.join(projectRoot, "storage", "uploads");
const outputDir = path.join(projectRoot, "storage", "output");
const publicDir = path.join(projectRoot, "public");

const jobStore = new JobStore();

async function bootstrap() {
  await ensureDirExists(uploadsDir);
  await ensureDirExists(outputDir);

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      service: "premiere-project-downgrade-converter",
      timestamp: new Date().toISOString(),
    });
  });

  app.use(
    "/api",
    createConversionRouter({
      jobStore,
      uploadsDir,
      outputDir,
    }),
  );

  app.use(express.static(publicDir));

  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      res.status(status).json({
        error: {
          message:
            error.code === "LIMIT_FILE_SIZE"
              ? "File is too large. Maximum allowed size is 200 MB."
              : error.message,
          code: error.code,
        },
      });
      return;
    }

    if (error instanceof UserFacingError) {
      res.status(error.status).json({
        error: {
          message: error.message,
          code: error.code,
          details: error.details || null,
        },
      });
      return;
    }

    console.error("[server:error]", error);
    res.status(500).json({
      error: {
        message: "Internal server error.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  });

  app.listen(PORT, () => {
    console.log(`Premiere Downgrade Converter running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
