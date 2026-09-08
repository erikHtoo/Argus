# Argus

A minimal Windows activity journal. See where your day went in meaningful time blocks, without a chatbot or a feed of every Alt-Tab.

## Run

Windows 11, Node.js 22.16+ and the built-in Windows PowerShell are required.

```powershell
cd C:\Users\thawz\OneDrive\Documents\ChatGPT\argus
pnpm install
pnpm start
```

The launcher rebuilds the interface before opening. If Argus is already running, use **Quit Argus** in its system tray menu first to load updated code. Closing the window keeps tracking in the background. Tracking does not start automatically with Windows.

Click **Start tracking** to enable local foreground-app and window-title tracking. Pause from the header or tray. Window titles can be disabled in Settings; recognizing YouTube requires them.

## Session overview

The date filter shows the whole day as variable-length sessions. One card names the dominant activity; clicking it reveals app totals and sustained YouTube titles.

For example: **Valorant session · 2h**, with **Valorant 1h 30m / Chrome 30m** inside. Browser detours dispersed throughout gaming do not create separate cards. A YouTube session followed by sustained gaming becomes two sessions.

- The tracker accumulates app totals in minute buckets, without retaining a chronological tab-switch log.
- Sessions appear after five minutes of total observed activity. There are no fixed hourly boundaries.
- Detours are absorbed until another activity remains dominant for 15 minutes; then the boundary is placed at the beginning of that change. This is a heuristic, and an ongoing session can be revised as more evidence arrives.
- Three minutes without input in a game, Discord, or ordinary app becomes **Idle**, with its own session. Video/stream pages remain passive viewing time while foreground; this does not verify playback.
- Locked, excluded, paused, and missing collector periods add no activity. Gaps of five minutes or more split sessions. The date view clips at midnight.
- Video titles are aggregated in details and shown after five accumulated minutes per title. New titles do not create cards.
- Old records are grouped too, but prior absorbed detours cannot be reconstructed. Their breakdowns are marked estimated.
- Session length is the elapsed span; the breakdown shows observed app time, so missing observations can make those totals smaller.

There is no chat provider, audio capture, screenshot capture, task manager, or goals interface.

## Data

The encrypted SQLite database is stored at `%LOCALAPPDATA%\Argus\argus.db.enc`, protected by your Windows account. Chromium caches live separately in `browser-session`. Old tasks and notes remain in the encrypted database for compatibility, but are not exposed to the journal.

Settings includes comma-separated app/title exclusions, retention (30 days by default), export, and history deletion. Exports contain journal entries and are readable JSON. Deletion cannot remove files already exported. The tray also supports deleting the last 15 minutes.

The collector polls every three seconds. Brief transitions between samples may be missed. Argus records foreground activity; background audio and simultaneous applications are outside its scope.

## Development

```powershell
pnpm dev
pnpm test
pnpm check
pnpm build
pnpm test:desktop
```

The browser preview at http://127.0.0.1:5173 uses a labeled sample day and cannot capture desktop activity. Preview edits reset on reload.

`shared/sessions.mjs` holds minute totals and variable-length session grouping. `electron/main.mjs` runs the Windows collector, encrypted store, and restricted IPC. `src/main.jsx` renders the daily journal and settings. Legacy shared data helpers remain to read and prune earlier databases safely.

Desktop smoke tests use an isolated profile and synthetic activity. They check the actual renderer, encrypted persistence, session drill-down, date filtering, deletion, removed chat commands, and second-instance cache isolation.
