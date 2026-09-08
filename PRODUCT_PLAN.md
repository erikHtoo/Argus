# Argus product and implementation plan

Status: archived original proposal. Superseded by the minimal activity-journal pivot documented in README.md. Chat, tasks, goals, screenshots, and audio are no longer part of the active app.
Working assumptions: Windows 11 first, a single personal user, local storage by default, English first, optional cloud AI. macOS comes after the Windows capture pipeline works reliably.

## Product promise

Argus helps you remember what happened on your computer, decide what matters next, and follow through on your goals.

The core loop is **observe → remember → plan → act → review**. Capturing a day is useful only if it helps the user make a better next decision.

Example: a user wants to become a software developer and has an exam tomorrow. Argus prioritizes exam preparation today, reserves an achievable study block, and keeps their development goal visible without treating both as equally urgent.

The reference is Omi's audio-to-memory, tasks, and chat experience. Argus extends that idea to desktop activity and intentional daily planning. It does not promise complete knowledge of someone's life: it knows only what was captured or entered, and labels gaps.

## Daily experience

1. **Set direction.** Onboarding asks about goals, approaching deadlines, available hours, and preferred coaching frequency. Capture permissions are separate from goal setup.
2. **Plan the morning.** Suggest up to three priorities and movable focus blocks based on deadlines, task estimates, and the user's available time. Explain why each priority was selected.
3. **Observe while working.** A visible tray indicator shows which sources are active. The user can pause, exclude an app, or delete recent history immediately.
4. **Capture commitments.** Direct instructions in Argus create tasks. Statements detected in recordings become suggestions in an inbox, with a timestamp and source excerpt.
5. **Help at decision points.** A user can ask “What should I do next?” or start a focus session. Optional nudges appear only after a meaningful deviation from a chosen focus block, with cooldown and snooze controls.
6. **Review the evening.** Show completed work, time aligned with goals, leisure, unknown activity, and remaining commitments. Offer tomorrow's plan for review.

## Main screens

| Screen | Main job | Key contents |
| --- | --- | --- |
| Today | Decide and act | Top priorities, next action, daily schedule, focus timer, capture status, AI prompt |
| Timeline | Understand the day | App sessions, transcript segments, optional screen observations, idle/away periods, corrections |
| Tasks | Manage commitments | Inbox, Have to do, Want to do, deadlines, status, goal filters |
| Goals | Connect actions to ambitions | Outcome, milestones, linked tasks, weekly targets, progress evidence |
| Memory | Retrieve past context | Search and chat with timestamped evidence and links back to the timeline |
| Settings | Control capture and data | Separate source toggles, exclusions, retention, AI mode, export, deletion |

Desktop layout: left navigation; a central work area; an optional AI panel on the right. Today defaults to actionable information, with detailed analytics one click away. Use calm language, readable typography, and avoid a moralizing productivity score.

## Capture and interpretation

### Application activity

- Track the foreground application, permitted window title, start/end times, and input-idle state. Never log keystrokes.
- Use session transitions and a lightweight polling fallback; merge short repeated observations into sessions.
- Treat sleep, lock, collector downtime, and no input separately. Watching a lecture without typing can still be intentional activity.
- Start with app and window-title context. Add an explicitly permissioned browser extension later for reliable page URL/title context; window titles alone are insufficient.
- Avoid counting simultaneous audio, app, and screen observations as separate elapsed time.

### Optional screen understanding

- Off by default. Offer selected-app capture before broad desktop capture.
- Sample adaptively on context changes and at a capped interval, initially proposed as 30–60 seconds during active use. Tune against measured accuracy, battery, and storage costs.
- Run OCR locally where supported; extract a short observation and discard the original frame by default. Retaining screenshots is a separate choice.
- Apply app/window exclusions before capture. Redaction is an additional best-effort safeguard, not a guarantee that sensitive content can always be recognized.
- Treat inaccessible or protected screens as missing data. Do not imply the system sees everything.

### Optional audio memory

- Microphone and computer playback have independent, explicit toggles. Their distinction must be visible in the tray and dashboard.
- Use speech detection and segmented transcription. Prefer local transcription when the machine supports it; queue processing instead of interrupting foreground work.
- Explain that microphone capture may include nearby conversations. Give the user a clear recording indicator and a fast pause control.
- Do not assume that speech from a video, another participant, or a noisy recording is the user's commitment. Unknown speakers remain unknown.
- Delete raw audio after successful transcription by default; failed chunks have a short bounded retry lifetime. Transcript storage is separately configurable.

### Classification

Store two dimensions: **activity type** (coding, studying, communication, entertainment, other, away, unknown) and **relationship to intent** (goal-aligned, planned leisure, possible distraction, unknown).

Examples: a React tutorial may support a development goal; a planned game break is leisure; a game during an opted-in study block may be a distraction. App identity alone never proves productivity, learning, or wasted time.

Use explicit user labels first, then deterministic rules, then AI classification where needed. Store confidence, evidence, and corrections. A correction can update a future rule without silently rewriting unrelated historical activity.

## Tasks, goals, and planning

Task fields: title, details, commitment type (`have_to` / `want_to`), status, priority, due date/time, estimated minutes, linked goal, origin, source reference, and extraction confidence.

Deadline is independent of commitment type: something the user wants to do may still have a deadline. A scheduled work block is also separate from the task's deadline.

- “Add revise chapters 1–3 for tomorrow's exam” in Argus creates a task and shows an undo action.
- “I have to submit the assignment Friday” in captured audio produces an inbox suggestion, preserving the quote and recording date.
- Resolve relative dates using the recording's local date/time, not the processing date. Do not invent an exam time or deadline hour; ambiguous dates remain flagged.
- Deduplicate repeated mentions and preserve provenance. Let users accept, edit, dismiss, or merge suggestions.
- Break broad goals into milestones and actionable tasks. “Become a good developer” needs user-defined evidence such as completing a project, practicing consistently, or passing a specific assessment.
- Planner uses deadlines, dependencies, estimates, available hours, existing blocks, and user priority. Reserve breaks and leave slack; explain conflicts when the work cannot fit.
- Propose rescheduling instead of silently moving commitments. App usage is evidence of effort, not proof of task completion or skill mastery.

## AI experience

Suggested prompts:

- “What should I work on for the next 45 minutes?”
- “What did I say I needed to finish this week?”
- “Find the explanation of database indexes I read yesterday.”
- “How much time did I spend on my development goal?”
- “My exam is tomorrow. Help me plan the rest of today.”
- “What distracted me during the study block?”

Answers retrieve relevant local events and memories, then cite source timestamps. Separate observed facts from interpretations and suggestions. Say when a source is unavailable, deleted, or outside the captured period.

Captured screen text and transcripts are untrusted data, never instructions to the assistant. They cannot authorize tool execution, external messages, or changes to settings. In the first version, AI actions are restricted to reviewable in-app task and plan operations with undo.

## Data and privacy model

- Core tracking, tasks, timeline, and manual planning work offline without an account.
- Cloud AI is opt-in, with a clear explanation that selected context leaves the device. Local storage does not automatically mean local inference.
- Store runtime data under the user's local application-data directory, outside the source repository and synced document folders.
- Encrypt persistent sensitive content; protect the key using the operating system's user-scoped credential protection. No content-bearing analytics or diagnostic logs by default.
- Provide capture exclusions, pause/until-tomorrow, delete last 15 minutes, date-range deletion, delete all, and export.
- Proposed retention: no retained raw screen/audio by default; 30 days of observations/transcripts; 90 days of daily summaries; tasks/goals until removed. Make these configurable rather than hidden defaults.
- Deletion must also remove search entries, embeddings, queued jobs, and affected derived summaries. Regenerate summaries from remaining sources when appropriate. User-created tasks can remain, with removed source excerpts cleared.
- Do not promise erasure of an export the user saved elsewhere or data already sent to an external provider. Document those boundaries in the relevant settings.

## Technical design

Proposed stack: **Tauri 2 + React + TypeScript** for the desktop interface, a **Rust background collector**, and **SQLite** for structured local data and initial full-text search. Validate required Windows bindings and encrypted database packaging in an early native spike before committing to the full build.

Windows adapters handle foreground-app detection, input inactivity, session lock/suspend, permissioned screen capture, microphone input, and WASAPI playback capture. Keep these behind interfaces so macOS adapters can be added later.

Pipeline:

`Capture adapters → bounded local queue → normalization/redaction → local database → summaries/search → planner/chat → dashboard`

Persist jobs with retries and backpressure. Collectors must not depend on an available AI provider. Restrict desktop IPC to explicit commands with validated inputs, use a restrictive content policy, and keep cloud API credentials outside the frontend.

Initial entities: `ActivitySession`, `Observation`, `TranscriptSegment`, `Memory`, `Task`, `Goal`, `Milestone`, `PlanBlock`, `UserRule`, `CaptureConsent`, `ProcessingJob`, and `SourceLink`. Sources carry timestamps/time zone, capture origin, confidence where applicable, and retention metadata.

Start with full-text search plus time/app/goal filters. Add semantic retrieval after the basic evidence pipeline works. Local model support should use a replaceable provider interface; benchmark candidate transcription and reasoning models on target hardware before promising offline AI performance.

## Implementation order and acceptance gates

### Phase 0 — Native feasibility

Validate packaging, tray operation, foreground activity, idle/lock/sleep handling, and local persistence. Spike one screen capture and one audio transcription path using explicitly enabled test input. Confirm dependencies and encryption support.

Acceptance: an installable development build collects a short real session accurately; denied permissions and unavailable capture sources have explicit states. Record CPU, RAM, battery impact, and daily storage estimates on the test device.

### Phase 1 — Useful daily planner

Build Today, Timeline, Tasks, Goals, and capture settings. Implement real app sessions, manual task/goal creation, commitment/deadline filters, focus blocks, daily summaries from structured activity, exclusions, pause, and deletion.

Acceptance: a user can plan a day, track real activity, restart without losing data, correct a session, and remove collected history. Any demonstration data is clearly labeled and separate from personal data.

### Phase 2 — Searchable memory and audio

Add optional mic/playback transcription, source-linked search/chat, task suggestion inbox, deduplication, and relative-date handling. Provide local and explicitly opted-in cloud inference paths as validated by the feasibility work.

Acceptance: users can find a recorded statement, inspect the supporting segment, accept a suggested task, and receive an honest insufficient-evidence answer. Deleting a source removes it from retrieval and affected derived content.

### Phase 3 — Screen context and adaptive planning

Add optional sampled screen OCR, contextual classification, user rules, explainable next-action suggestions, schedule proposals, and optional focus nudges.

Acceptance: a relevant tutorial can be marked goal-aligned; inactivity is not automatically classified as distraction; nudges respect quiet hours and cooldowns; proposed work fits the available day or exposes a conflict.

### Phase 4 — Pilot and hardening

Run multi-day use on representative laptops. Test performance during gaming, video playback, calls, and battery operation. Validate retention cleanup, installer/update behavior, crash recovery, accessibility, and offline behavior. Prepare signed distribution before broad release.

The complete first pilot should include activity capture, optional audio and screen context, evidence-based chat, tasks, goals, and daily planning. Phase 1 is an intentionally useful intermediate build, not the completion of the overall product.

Later scope: macOS, browser extension, calendar integrations, multi-device sync, richer personal routines. Automatic control of unrelated apps and employer monitoring are outside the initial product scope.

## Validation and success measures

Test session boundaries across app switches, midnight, time-zone changes, lock, sleep, and restart. Test ambiguous or quoted task statements, duplicate extraction, expired sources, cloud opt-out, prompt injection in captured text, and deletion through all derived stores.

Primary outcome: users complete more of their self-selected priorities and find the daily plan helpful. Supporting measures: useful recalled memories, accepted versus dismissed task suggestions, classification corrections, nudge dismissals, and capture reliability. All-day capture volume and hours worked are not success metrics by themselves.

## Research references

- Omi overview: https://help.omi.me/en/articles/13135007-overview
- Omi developer introduction: https://docs.omi.me/doc/get_started/introduction
- Windows playback capture: https://learn.microsoft.com/en-us/windows/win32/coreaudio/loopback-recording

## Next implementation step

Begin with Phase 0 and Phase 1: a Windows desktop shell, tray controls, real app tracking, local persistence, and the Today/Tasks/Timeline experience. Introduce microphone and screen capture through explicit onboarding controls as their adapters are implemented.
