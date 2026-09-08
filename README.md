# Argus

A local-first Windows desktop companion for remembering your day, managing commitments, and making progress toward your goals.

Argus connects **activity → context → next steps**. It never equates time in an app with achievement. Capture starts off, and the user chooses which sources to enable.

## Run locally

Requirements: Windows 11, Node.js 22.16+ (Node 24 recommended), npm, and the built-in Windows PowerShell 5.1. No Rust or .NET SDK is required.

```powershell
npm install
npm run build
npm start
```

For an interactive browser preview:

```powershell
npm run dev
```

Open `http://127.0.0.1:5173`. The preview is clearly labeled, contains sample data, and cannot capture your desktop. Preview edits persist only in that browser's local storage. The desktop starts with an empty personal workspace.

## What works

- Today dashboard, task creation and completion, have-to/want-to filters, deadlines, goal links, and goal progress based on completed tasks.
- Daily focus-block proposals that account for urgency, available minutes, existing blocks, and day end. Review before accepting; remove blocks and regenerate as plans change.
- Focus sessions with a timer; finishing a timer never automatically marks work complete.
- Native foreground-app and inactivity tracking. Window titles require separate consent. Lock, sleep, excluded apps, and missing collector samples do not become work time.
- Editable activity categories and intent labels, including planned leisure and unknown.
- Notes, local keyword search, source-linked answers, and commitment suggestions that require review.
- Optional Windows OCR of the foreground window, with exclusions checked before capture. Screenshots are processed in memory, not written as image files.
- Independent microphone and computer playback capture. Audio is silence-filtered, converted to 16 kHz WAV in memory, and submitted in short chunks to an explicitly configured local transcription server.
- Offline rule-based planning and search; optional Ollama chat or an explicitly enabled OpenAI-compatible cloud provider.
- A SQLite database encrypted with Electron safeStorage (Windows user-scoped DPAPI protection), outside the repository and synced Documents folders.
- System tray, pause/resume, export, recent-history deletion, full-history deletion, and retention cleanup.

## Local AI setup

Argus does not bundle a language or speech model. All core task, goal, planning, tracking, note, and search features work without one.

### Conversational assistant

Run a local Ollama server with a model your machine can handle. In **Settings → A little help thinking**, choose **Local model**, set the URL (default `http://127.0.0.1:11434`), and enter the installed model name. Save, then ask the assistant a question.

For cloud inference, choose **Cloud model**, configure the base URL ending in `/v1`, model, and API key, and save. This explicitly enables sending your question, selected memories, task context, and goal context to that provider. API keys are not exposed to the renderer or included in exports.

### Audio transcription

Run a local whisper.cpp-compatible server with an installed speech model. Configure its inference endpoint (default `http://127.0.0.1:8080/inference`) in Settings. It must accept multipart `file` WAV uploads and return JSON containing `text`.

Enable **Microphone** and/or **Computer audio**. The current source state is visible in Settings, and the top bar/tray shows capture status. If no transcription server is available, Argus reports the connection error and discards the attempted chunk. There is no durable raw-audio retry queue in this version. Chunks are bounded; when transcription falls behind, excess chunks are dropped with a visible source error.

Windows playback capture uses Electron's display-media loopback facility. A video track is required by that API, but its frames are never read or retained by the audio pipeline.

### Screen context

Enable Screen context to sample the active window roughly once a minute. Argus uses `PrintWindow` and Windows OCR with your installed OCR language packs. Some GPU, protected, minimized, or unsupported windows produce no useful text; this is missing context, never evidence of inactivity. Screen and audio capture turn off at every app restart.

## Data controls

Personal runtime data is stored at `%LOCALAPPDATA%\Argus\argus.db.enc`. The encryption key is protected by your Windows account. This protects the database at rest, not against software already running as your user. Keep access to your Windows account secure.

Password-manager name exclusions ship by default. Add app names or window-title phrases, one per line. Foreground matches pause capture. A polling interval creates a short detection delay; exclusions are not a universal sensitive-content detector.

History is kept for 30 days by default. Deleting history also removes associated inbox suggestions and clears source links on accepted tasks. Accepted tasks and goals remain until you delete them. Chat messages are session-only and are cleared when source memories are removed. Exported JSON is readable and outside the scope of subsequent local deletion.

Closing the window keeps Argus running in the tray. **Tray → Quit Argus** stops it. Tracking does not auto-start with Windows.

## Architecture

```text
React/Vite renderer (sandboxed; no Node access)
             │ explicit, validated IPC
Electron main process ─── encrypted SQLite image
             ├── native PowerShell/C# foreground collector
             ├── native in-memory window capture + Windows OCR
             ├── local WAV transcription client
             └── offline retrieval / local or opted-in cloud AI
```

- `shared/core.mjs`: validation, classification, task extraction, planning, activity sessions, retrieval, retention.
- `electron/`: privileged commands, encrypted storage, native lifecycle, provider clients, restricted preload.
- `native/`: Windows-only foreground and OCR adapters; no keystroke collection.
- `src/`: interface, preview adapter, in-memory audio capture.
- `tests/`: unit and integration tests using synthetic data/local mock providers.
- `scripts/native-smoke.ps1`: real Windows collector and OCR smoke checks; does not print captured window content.

The initial plan proposed Tauri/Rust. The first implementation uses Electron because Node was available while Rust and .NET SDKs were absent. This trades a larger desktop runtime for a build that can be exercised on the target machine now. The UI currently uses React/JavaScript; TypeScript checks syntax rather than providing full static typing.

## Validation

```powershell
npm test
npm run check
npm run build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/native-smoke.ps1
```

Tests cover encrypted restart persistence, deletion cascades, retention, session boundaries and gaps, date validation, plan budgets and conflicts, atomic plan acceptance, task deduplication, evidence handling, and local provider contracts.

## Pilot limitations

This is an initial personal-use build, not a completed multi-day reliability pilot. Actual microphone, playback, transcription-model quality, battery use, and protected-window compatibility depend on the device and need pilot testing. No automatic speaker identification, semantic embeddings, persistent audio queue, browser extension, calendar sync, milestone editor, automatic nudges, or macOS support is included yet. Task extraction is deliberately conservative and rule-based: relative dates in captured speech stay in the proposed title for user review rather than silently becoming a deadline.

See [PRODUCT_PLAN.md](PRODUCT_PLAN.md) for the intended evolution and [docs/VALIDATION.md](docs/VALIDATION.md) for the checks performed on this build.
