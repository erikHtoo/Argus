# Build validation

This file records executed checks, distinct from features that still require a real-device pilot.

## Proportional day ribbons — September 9, 2026

- 36 tests passed, including shared-scale positioning, duration-proportional widths, folds crossing session boundaries, overnight activity, consistent colors, preference validation, and date-range boundaries.
- Native Electron smoke passed: seven/fourteen-day filtering, ending-date selection, visible-hour preference persistence, overnight fold opening a full day, 90/30-minute session details, matching activity colors, and narrow-window layout.
- Production build and syntax/type check passed. Inspected overview, detailed day, and narrow-window screenshots with synthetic data.
- This is a presentation change; foreground tracking and session segmentation are unchanged. The earlier same-sized session-card UI is replaced.

## Activity journal pivot — September 8, 2026

### Variable sessions — September 9, 2026

The session implementation supersedes the five-minute visit/detour implementation below. The day overview contains variable-length dominant-activity sessions, with app totals available on click. No fixed-hour grid is used.

- 28 unit/integration checks passed, including a two-hour session with 90 minutes gaming / 30 minutes browser time, subsequent YouTube boundaries, idle gaming and Discord, passive video, video titles, missing samples, and partial deletion.
- Native Electron verified the exact 90/30-minute breakdown, session selection, date filtering, encrypted persistence, deletion, and narrow-window layout. Screenshot inspected using synthetic activity.
- Production build and syntax/type check passed. Extended real-world gaming/video tracking remains a user pilot.

- 26 tests passed, including five-minute qualification, two-minute detours, sustained app changes, dominant-time ratios, title retention, privacy boundaries, downtime, midnight, and legacy data preservation.
- Production build and syntax/type command passed.
- Isolated native Electron smoke passed: journal rendering, purpose-label persistence, encryption, deletion, rejected chat commands, disabled media settings, Settings navigation, and layout at the 640-pixel minimum window width.
- Native journal screenshot inspected with synthetic Valorant and YouTube blocks. No personal screen content is included in test artifacts.
- Second-instance launch exits cleanly without cache errors or changing the primary database.
- New aggregation is verified with deterministic sample sequences. An extended real gaming/video pilot of this version has not yet been performed.

The checks below describe earlier versions, including features since removed.

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
