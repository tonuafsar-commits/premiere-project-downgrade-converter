const { randomUUID } = require("node:crypto");

const RETAIN_JOB_LIMIT = 200;
const JOB_TTL_MS = 1000 * 60 * 60 * 24;

class JobStore {
  constructor() {
    this.jobs = new Map();
  }

  createJob(initialData = {}) {
    const id = randomUUID();
    const now = new Date().toISOString();

    const job = {
      id,
      status: "queued",
      progress: 0,
      stage: "Queued",
      createdAt: now,
      updatedAt: now,
      error: null,
      result: null,
      ...initialData,
    };

    this.jobs.set(id, job);
    this.pruneOldJobs();
    return job;
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  updateJob(jobId, patch) {
    const existing = this.getJob(jobId);
    if (!existing) {
      return null;
    }

    const updated = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, updated);
    return updated;
  }

  markProcessing(jobId, stage = "Processing", progress = 1) {
    return this.updateJob(jobId, {
      status: "processing",
      stage,
      progress,
    });
  }

  markCompleted(jobId, result) {
    return this.updateJob(jobId, {
      status: "completed",
      stage: "Completed",
      progress: 100,
      result,
      error: null,
    });
  }

  markFailed(jobId, error) {
    return this.updateJob(jobId, {
      status: "failed",
      stage: "Failed",
      error,
    });
  }

  pruneOldJobs() {
    const now = Date.now();

    for (const [jobId, job] of this.jobs.entries()) {
      const createdAt = Date.parse(job.createdAt);
      if (!Number.isFinite(createdAt)) {
        continue;
      }
      if (now - createdAt > JOB_TTL_MS) {
        this.jobs.delete(jobId);
      }
    }

    if (this.jobs.size <= RETAIN_JOB_LIMIT) {
      return;
    }

    const sorted = [...this.jobs.values()].sort(
      (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
    );

    const excess = sorted.length - RETAIN_JOB_LIMIT;
    for (let index = 0; index < excess; index += 1) {
      this.jobs.delete(sorted[index].id);
    }
  }
}

module.exports = {
  JobStore,
};
