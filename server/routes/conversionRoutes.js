const path = require("node:path");
const multer = require("multer");
const express = require("express");
const { DEFAULT_TARGET_VERSION, listVersionPresets } = require("../config/versions");
const { convertProject } = require("../services/conversionEngine");
const { getLatestReleaseInfo } = require("../services/adobeReleaseTracker");
const { UserFacingError } = require("../utils/errors");
const { removeIfExists } = require("../utils/fileUtils");

const MAX_UPLOAD_SIZE_BYTES = 200 * 1024 * 1024;

function createConversionRouter({ jobStore, uploadsDir, outputDir }) {
  const router = express.Router();

  const upload = multer({
    dest: uploadsDir,
    limits: {
      fileSize: MAX_UPLOAD_SIZE_BYTES,
    },
    fileFilter: (req, file, callback) => {
      const lowerName = String(file.originalname || "").toLowerCase();
      if (!lowerName.endsWith(".prproj")) {
        callback(
          new UserFacingError(
            "Unsupported file type. Please upload a .prproj file.",
            "UNSUPPORTED_FILE_TYPE",
            400,
          ),
        );
        return;
      }
      callback(null, true);
    },
  });

  router.get("/versions", async (req, res) => {
    const latestStableRelease = await getLatestReleaseInfo();
    res.json({
      defaultTargetVersion: DEFAULT_TARGET_VERSION,
      versions: listVersionPresets(),
      latestStableRelease,
    });
  });

  router.post("/conversions", upload.single("projectFile"), (req, res, next) => {
    const targetVersion = String(req.body?.targetVersion || DEFAULT_TARGET_VERSION);
    const uploadedFile = req.file;

    if (!uploadedFile) {
      next(
        new UserFacingError(
          "No file uploaded. Please attach a .prproj file.",
          "MISSING_FILE",
          400,
        ),
      );
      return;
    }

    const job = jobStore.createJob({
      targetVersion,
      fileName: uploadedFile.originalname,
    });

    res.status(202).json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
    });

    setImmediate(async () => {
      try {
        jobStore.markProcessing(job.id, "Preparing conversion", 3);
        const result = await convertProject({
          jobId: job.id,
          uploadPath: uploadedFile.path,
          originalName: uploadedFile.originalname,
          targetYear: targetVersion,
          outputDir,
          onProgress: (progress, stage) => {
            jobStore.markProcessing(job.id, stage, progress);
          },
        });

        jobStore.markCompleted(job.id, {
          fileName: result.outputFileName,
          reportFileName: result.reportFileName,
          downloadUrl: `/api/conversions/${job.id}/download`,
          reportUrl: `/api/conversions/${job.id}/report`,
          report: result.report,
          outputPath: result.outputPath,
          reportPath: result.reportPath,
        });
      } catch (error) {
        const safeError = error instanceof UserFacingError
          ? {
              message: error.message,
              code: error.code,
              details: error.details || null,
            }
          : {
              message: "Unexpected error during conversion.",
              code: "INTERNAL_CONVERSION_ERROR",
            };

        jobStore.markFailed(job.id, safeError);
      } finally {
        await removeIfExists(uploadedFile.path);
      }
    });
  });

  router.get("/conversions/:jobId", (req, res, next) => {
    const job = jobStore.getJob(req.params.jobId);
    if (!job) {
      next(new UserFacingError("Job not found.", "JOB_NOT_FOUND", 404));
      return;
    }

    res.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      error: job.error,
      result: job.result
        ? {
            fileName: job.result.fileName,
            reportFileName: job.result.reportFileName,
            downloadUrl: job.result.downloadUrl,
            reportUrl: job.result.reportUrl,
            report: job.result.report,
          }
        : null,
    });
  });

  router.get("/conversions/:jobId/download", (req, res, next) => {
    const job = jobStore.getJob(req.params.jobId);
    if (!job) {
      next(new UserFacingError("Job not found.", "JOB_NOT_FOUND", 404));
      return;
    }

    if (job.status !== "completed" || !job.result?.outputPath) {
      next(
        new UserFacingError(
          "Converted project is not available yet.",
          "RESULT_NOT_READY",
          409,
        ),
      );
      return;
    }

    const normalizedOutputPath = path.resolve(job.result.outputPath);
    if (!normalizedOutputPath.startsWith(path.resolve(outputDir))) {
      next(
        new UserFacingError(
          "Download path validation failed.",
          "INVALID_DOWNLOAD_PATH",
          400,
        ),
      );
      return;
    }

    res.download(normalizedOutputPath, job.result.fileName);
  });

  router.get("/conversions/:jobId/report", (req, res, next) => {
    const job = jobStore.getJob(req.params.jobId);
    if (!job) {
      next(new UserFacingError("Job not found.", "JOB_NOT_FOUND", 404));
      return;
    }

    if (job.status !== "completed" || !job.result?.reportPath) {
      next(
        new UserFacingError(
          "Conversion report is not available yet.",
          "REPORT_NOT_READY",
          409,
        ),
      );
      return;
    }

    const normalizedReportPath = path.resolve(job.result.reportPath);
    if (!normalizedReportPath.startsWith(path.resolve(outputDir))) {
      next(
        new UserFacingError(
          "Report path validation failed.",
          "INVALID_REPORT_PATH",
          400,
        ),
      );
      return;
    }

    res.sendFile(normalizedReportPath);
  });

  return router;
}

module.exports = {
  createConversionRouter,
};
