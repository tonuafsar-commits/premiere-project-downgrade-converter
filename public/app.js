const elements = {
  dropZone: document.getElementById("dropZone"),
  projectFileInput: document.getElementById("projectFileInput"),
  selectedFile: document.getElementById("selectedFile"),
  targetVersion: document.getElementById("targetVersion"),
  latestReleaseText: document.getElementById("latestReleaseText"),
  convertButton: document.getElementById("convertButton"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  downloadButton: document.getElementById("downloadButton"),
  reportButton: document.getElementById("reportButton"),
  errorSection: document.getElementById("errorSection"),
  errorText: document.getElementById("errorText"),
  reportSection: document.getElementById("reportSection"),
  statusBadge: document.getElementById("statusBadge"),
  statsGrid: document.getElementById("statsGrid"),
  preservedItems: document.getElementById("preservedItems"),
  unsupportedItems: document.getElementById("unsupportedItems"),
  warningsList: document.getElementById("warningsList"),
  changesList: document.getElementById("changesList"),
};

const state = {
  selectedFile: null,
  activeJobId: null,
  pollTimer: null,
  versions: [],
};

function setError(message) {
  elements.errorText.textContent = message;
  elements.errorSection.classList.remove("hidden");
}

function clearError() {
  elements.errorText.textContent = "";
  elements.errorSection.classList.add("hidden");
}

function setProgress(progressPercent, stage) {
  const clamped = Math.max(0, Math.min(100, Number(progressPercent) || 0));
  elements.progressBar.style.width = `${clamped}%`;
  elements.progressText.textContent = `${clamped}% - ${stage || "Processing..."}`;
}

function resetResults() {
  elements.reportSection.classList.add("hidden");
  elements.downloadButton.classList.add("hidden");
  elements.reportButton.classList.add("hidden");

  elements.downloadButton.href = "#";
  elements.reportButton.href = "#";
  elements.statusBadge.innerHTML = "";
  elements.statsGrid.innerHTML = "";
  elements.preservedItems.innerHTML = "";
  elements.unsupportedItems.innerHTML = "";
  elements.warningsList.innerHTML = "";
  elements.changesList.innerHTML = "";
}

function setSelectedFile(file) {
  state.selectedFile = file || null;
  elements.selectedFile.textContent = file
    ? `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`
    : "No file selected";
  elements.convertButton.disabled = !file;
}

function appendListItems(listElement, items, emptyMessage) {
  listElement.innerHTML = "";
  if (!items || !items.length) {
    const li = document.createElement("li");
    li.textContent = emptyMessage;
    listElement.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    listElement.appendChild(li);
  }
}

function addStatCard(label, value) {
  const wrapper = document.createElement("article");
  wrapper.className = "stat";
  wrapper.innerHTML = `<p class="stat-label">${label}</p><p class="stat-value">${value}</p>`;
  elements.statsGrid.appendChild(wrapper);
}

function renderStatusBadge(status) {
  const normalized = String(status || "").toLowerCase();
  const isSuccess = normalized === "successful";
  const isPartial = normalized === "partially_successful";

  const label = isSuccess
    ? "Successful"
    : isPartial
      ? "Partially Successful"
      : "Failed";
  const className = isSuccess ? "success" : isPartial ? "partial" : "failed";

  elements.statusBadge.innerHTML = `<span class="status-pill ${className}">${label}</span>`;
}

function renderReport(report) {
  renderStatusBadge(report.status);

  addStatCard("Source", report.sourceVersion?.detectedLabel || "Unknown");
  addStatCard("Target", report.targetVersion?.label || "Unknown");
  addStatCard("Sequences", report.structure?.sequences ?? 0);
  addStatCard("Video Tracks", report.structure?.videoTracks ?? 0);
  addStatCard("Audio Tracks", report.structure?.audioTracks ?? 0);
  addStatCard("Clips", report.structure?.clips ?? 0);
  addStatCard("Markers", report.structure?.markers ?? 0);
  addStatCard("Transitions", report.structure?.transitions ?? 0);

  appendListItems(
    elements.preservedItems,
    report.preservedItems,
    "No preserved-items list was generated.",
  );
  appendListItems(
    elements.unsupportedItems,
    report.unsupportedItems,
    "No known unsupported items were detected.",
  );
  appendListItems(
    elements.warningsList,
    report.warnings,
    "No warnings were generated.",
  );
  appendListItems(
    elements.changesList,
    report.appliedChanges,
    "No metadata rewrites were applied.",
  );

  elements.reportSection.classList.remove("hidden");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = data?.error?.message || "Request failed.";
    throw new Error(errorMessage);
  }

  return data;
}

function stopPolling() {
  if (state.pollTimer) {
    window.clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

function startPolling(jobId) {
  stopPolling();

  state.pollTimer = window.setInterval(async () => {
    try {
      const data = await fetchJson(`/api/conversions/${jobId}`);
      setProgress(data.progress || 0, data.stage || "Processing...");

      if (data.status === "completed") {
        stopPolling();
        elements.downloadButton.href = data.result.downloadUrl;
        elements.downloadButton.classList.remove("hidden");

        elements.reportButton.href = data.result.reportUrl;
        elements.reportButton.classList.remove("hidden");

        renderReport(data.result.report);
      }

      if (data.status === "failed") {
        stopPolling();
        const message = data.error?.message || "Conversion failed.";
        setError(message);
        setProgress(data.progress || 0, "Failed");
      }
    } catch (error) {
      stopPolling();
      setError(error.message);
    }
  }, 900);
}

function renderLatestReleaseInfo(latestStableRelease) {
  if (!elements.latestReleaseText) {
    return;
  }

  if (!latestStableRelease?.available) {
    elements.latestReleaseText.textContent =
      "Latest Adobe stable release: unavailable right now (using local compatibility mapping).";
    elements.latestReleaseText.classList.add("stale");
    return;
  }

  const version = latestStableRelease.latestVersion || "unknown";
  const releaseHeading = latestStableRelease.releaseHeading
    ? `${latestStableRelease.releaseHeading}`
    : "recent release";

  elements.latestReleaseText.textContent =
    `Latest Adobe stable release: v${version} (${releaseHeading}).`;

  if (latestStableRelease.stale) {
    elements.latestReleaseText.classList.add("stale");
  } else {
    elements.latestReleaseText.classList.remove("stale");
  }
}

async function loadTargetVersions() {
  const data = await fetchJson("/api/versions");
  state.versions = data.versions || [];
  elements.targetVersion.innerHTML = "";
  renderLatestReleaseInfo(data.latestStableRelease);

  for (const version of state.versions) {
    const option = document.createElement("option");
    option.value = version.year;
    const confidenceNote = version.confidence === "estimated" ? " (estimated mapping)" : "";
    option.textContent = `${version.label}${confidenceNote}`;
    if (version.year === data.defaultTargetVersion) {
      option.selected = true;
    }
    elements.targetVersion.appendChild(option);
  }
}

async function startConversion() {
  stopPolling();
  clearError();
  resetResults();

  if (!state.selectedFile) {
    setError("Please select a .prproj file before converting.");
    return;
  }

  elements.convertButton.disabled = true;
  setProgress(2, "Uploading file...");

  try {
    const formData = new FormData();
    formData.append("projectFile", state.selectedFile);
    formData.append("targetVersion", elements.targetVersion.value);

    const startResponse = await fetchJson("/api/conversions", {
      method: "POST",
      body: formData,
    });

    state.activeJobId = startResponse.jobId;
    setProgress(startResponse.progress || 3, startResponse.stage || "Queued");
    startPolling(state.activeJobId);
  } catch (error) {
    setError(error.message);
    setProgress(0, "Upload failed");
  } finally {
    elements.convertButton.disabled = false;
  }
}

function registerUploadEvents() {
  const pickFile = () => elements.projectFileInput.click();

  elements.dropZone.addEventListener("click", pickFile);
  elements.dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pickFile();
    }
  });

  elements.projectFileInput.addEventListener("change", () => {
    const file = elements.projectFileInput.files?.[0] || null;
    setSelectedFile(file);
  });

  elements.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("drag-active");
  });

  elements.dropZone.addEventListener("dragleave", () => {
    elements.dropZone.classList.remove("drag-active");
  });

  elements.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("drag-active");
    const droppedFile = event.dataTransfer?.files?.[0] || null;
    setSelectedFile(droppedFile);
  });
}

async function initializeApp() {
  registerUploadEvents();
  elements.convertButton.addEventListener("click", startConversion);
  setProgress(0, "Waiting for upload...");

  try {
    await loadTargetVersions();
  } catch (error) {
    setError(`Failed to load available target versions: ${error.message}`);
  }
}

initializeApp();
