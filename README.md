# Premiere Project Downgrade Converter

Web-based Adobe Premiere Pro project downgrade tool focused on making newer `.prproj` files more usable in older versions, especially **Premiere Pro 2023**.

## What This Project Does

- Uploads a `.prproj` file through a browser UI
- Detects likely source project version metadata
- Lets the user choose a target Premiere version (default: 2023)
- Auto-checks Adobe official release notes and displays the latest stable Premiere version in UI
- Applies guarded compatibility metadata rewrites
- Preserves project structure and timeline metadata as much as possible
- Generates:
  - a new converted project file
  - a detailed conversion report with warnings and unsupported-risk items

## What This Project Does Not Promise

- Perfect backward compatibility for every Premiere feature
- Reliable cross-version behavior for every third-party effect/plugin
- Exact reconstruction of proprietary unsupported features

When full-safe downgrade cannot be guaranteed, the converter reports warnings and marks the result as `partially_successful` instead of silently dropping data.

## Stack

- Backend: Node.js + Express + Multer
- Frontend: HTML/CSS/Vanilla JS
- Conversion strategy: modular services under `server/services`

## Project Structure

```text
premiere-project-downgrade-converter/
  public/
    index.html
    styles.css
    app.js
  server/
    config/
      versions.js
      compatibilityRules.js
    routes/
      conversionRoutes.js
    services/
      conversionEngine.js
      metadataDowngrade.js
      prprojReader.js
      projectAnalyzer.js
      versionDetector.js
      jobStore.js
    utils/
      errors.js
      fileUtils.js
    index.js
  storage/
    uploads/
    output/
  package.json
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Start server:

```bash
npm start
```

3. Open:

```text
http://localhost:5050
```

## How Conversion Works

1. Validate upload type and size (`.prproj`, max 200MB by default)
2. Read project data safely:
   - supports plain XML `.prproj`
   - supports gzip-compressed `.prproj`
3. Detect source metadata:
   - project object version
   - application version hints
4. Analyze structure counts:
   - sequences, tracks, clips, markers, transitions, effects, bins
5. Apply guarded metadata downgrade strategy:
   - downgrade known project object version metadata
   - downgrade known app-version metadata keys when source is newer than target
6. Scan for compatibility risks and unsupported metadata patterns
7. Write converted copy (never overwrites original)
8. Generate conversion report JSON

## API Summary

- `GET /api/health`
- `GET /api/versions`
- `POST /api/conversions` (multipart form with `projectFile`, `targetVersion`)
- `GET /api/conversions/:jobId`
- `GET /api/conversions/:jobId/download`
- `GET /api/conversions/:jobId/report`

## Conversion Report Fields

- detected source version details
- selected target version details
- sequence/track/clip/marker counts
- preserved items list
- unsupported-risk items list
- warnings
- applied metadata changes
- final status (`successful`, `partially_successful`, `failed`)

## Auto Update Behavior

- `GET /api/versions` now includes `latestStableRelease`, fetched from Adobe’s official Premiere release-notes page.
- The fetch result is cached for 12 hours to reduce latency and rate pressure.
- If Adobe is temporarily unreachable, the app falls back safely to cached data (or local mappings) and marks the release info as stale.

## Safety Features

- strict file extension check
- upload size limit
- readable XML validation
- protection against likely binary/corrupted input
- converted file written as a new copy only
- explicit warnings when uncertain

## Updating for Future Premiere Versions

When Adobe releases new versions:

1. Update mappings in `server/config/versions.js`
   - `appMajor`
   - `appVersionString`
   - `projectObjectVersion`
2. Add or tune rules in `server/config/compatibilityRules.js`
3. Expand metadata rewrite logic in `server/services/metadataDowngrade.js`
4. Add new detection heuristics in `server/services/versionDetector.js`
5. Validate against sample projects from the new release

## Recommended Validation Workflow

1. Convert a representative project copy.
2. Open converted output in Premiere Pro 2023.
3. Verify:
   - sequence presence
   - timing and clip alignment
   - markers
   - transitions/effects
   - plugin behavior
4. Review report warnings before production use.

## Notes on Version Mapping Confidence

`server/config/versions.js` includes a `confidence` field. If a mapping is uncertain (for example estimated future-year metadata), that is surfaced to the user in the UI and report.
