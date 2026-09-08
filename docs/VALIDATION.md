# Build validation

This file records executed checks, distinct from features that still require a real-device pilot.

## Executed

- 16 unit/integration tests passed: task and goal validation, foreground session behavior, excluded and locked gaps, midnight boundaries, plan capacity and atomic acceptance, task deduplication, history deletion, retention, endpoint restrictions, encrypted SQLite restart, and local mock AI/transcription services.
- Native Windows activity helper returned a valid foreground/inactivity sample. Window content was neither printed nor retained by the test.
- Native Windows OCR recognized a synthetic sentence rendered in memory.

## Activity improvements verified on September 8, 2026

- All 22 unit/integration tests passed, including new site/game recognition, title opt-out, stale tracker status, time aggregation, and offline activity questions.
- Production frontend build and source checks passed.
- Native Electron smoke passed through the sandboxed preload/IPC: tasks, goals, focus, source-linked search, key redaction, encrypted save/reload, and deletion.
- Visually inspected a capture of the actual Electron test window with the activity panel.
- User-authorized live background check observed both YouTube and VALORANT-Win64-Shipping. At 10:55 UTC, 53 native samples had arrived with zero collector restarts and no storage errors. These are activity observations, not assertions about video playback or user productivity.

## Still pending

Startup/cache fix: a fresh isolated native test verifies that a second launch exits successfully, emits no cache-creation errors, and leaves the primary database unchanged. Chromium session/cache files now use `browser-session` beneath the app data directory, separate from the encrypted activity database. Test runs use separate profiles and report startup failures directly; timeout failures return a nonzero exit code.

- Standalone release packaging and signing.
- Multi-day battery/performance pilot.

## Not yet established

- Multi-day CPU, memory, battery, or storage measurements.
- Live microphone or playback capture with a real transcription model.
- Provider/model answer quality on a real user day.
- Capture compatibility for all games, protected windows, or multi-monitor/DPI combinations.
- Code signing, auto-update, and broad Windows distribution.
