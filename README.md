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

## Journal rules

- A new activity is saved only after five minutes of observed foreground time. Short candidates are held in memory and discarded when interrupted.
- Detours under two minutes can stay inside the main activity if it accounts for at least 70% of the block. Longer detours end the old block; a different app still needs five minutes to appear.
- A block's timestamp range includes absorbed detours. It is not an exact measure of focused work.
- Switching titles inside the same app does not create new blocks. The longest-observed title is shown only after that title accumulates five minutes.
- Lock, sleep, exclusions, collector gaps, pauses, and midnight split blocks. Ordinary apps stop accumulating after three minutes without input. Video and stream pages continue while foreground, because watching need not involve mouse input.
- Foreground time does not prove playback, attention, achievement, or educational value. Purpose is optional and manually labeled **For fun**, **Learning**, or **Work**.
- Existing long sessions remain visible; legacy short switches are hidden. Historical data is preserved, rather than inventing a reconstruction of missing context.

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

`shared/journal.mjs` holds the in-memory aggregation and persistence threshold. `electron/main.mjs` runs the Windows collector, encrypted store, and restricted IPC. `src/main.jsx` renders the daily journal and settings. Legacy shared data helpers remain to read and prune earlier databases safely.

Desktop smoke tests use an isolated profile and synthetic activity. They check the actual renderer, encrypted persistence, purpose labels, deletion, removed chat commands, and second-instance cache isolation.
