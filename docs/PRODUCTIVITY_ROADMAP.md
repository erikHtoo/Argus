# Productivity without dashboard clutter

The product is a daily sequence of meaningful sessions. Opening a session explains its time. Productivity features should help the user decide what to do next, while leaving that overview intact.

## 1. Make the history trustworthy

**Session corrections.** Inside details, let the user rename a session, mark mistaken idle time, or merge adjacent sessions. Keep observed totals intact and clearly distinguish the user's correction from collected evidence. Store corrections against stable time ranges and migrate them safely when grouping boundaries change. History deletion must remove overlapping corrections. Undo should be available in the current interaction.

**Why this session?** A small details-only explanation: “Valorant was foreground for 75% of this session.” Mixed sessions should remain mixed when there is no clear winner. Do not assign a meaningful winner through an alphabetical tie-break.

**Capture continuity.** Show gaps as unobserved, not idle. Keep passive YouTube distinct from verified playback. Test games controlled through a controller before claiming keyboard inactivity proves the user is away.

Acceptance: a user can correct one mistaken session without changing app totals or adding a permanent toolbar. Corrections survive restart, regrouping, and retention correctly.

## 2. One intention for today

An optional single sentence, such as “Understand binary search” or “Finish a practice exam.” Add an optional time budget. Keep it in a small collapsed line above the sessions, not a task manager.

Inside a relevant session, the user can mark it as contributing to that intention. Argus cannot infer that all editor time was useful work or all YouTube time was leisure. Time associated with the intention is observed effort, not completion.

At day end, offer a voluntary reflection: “Did this move you forward?” with a short note. Never auto-mark success from screen time.

Acceptance: one intention, one time budget, session links, and an optional reflection. No subtasks, inbox, streaks, or motivational scores. Everything works offline.

## 3. Compare intention with the day

Show one compact comparison only when the user has an intention: planned effort versus the sessions they linked. A user preparing for an exam can see that their intended 90 minutes became 30 minutes, then decide whether to reserve another session.

Avoid labeling the remaining time “wasted.” Leisure can be intentional. The comparison should lead to one concrete choice: adjust tomorrow's intention or reserve another focused session.

Acceptance: the comparison uses only explicit user links; missing capture is shown as missing; no psychological or productivity judgments are inferred from app names.

## 4. A quiet weekly review

An optional weekly view summarizes user-linked effort and session patterns, such as recurring uninterrupted study periods. Compare only days with sufficient capture coverage. Use a few useful observations rather than a wall of charts.

Possible decision: “My study sessions usually happen before dinner; I will plan tomorrow's practice there.” Do not turn correlations into claims that a schedule caused better performance.

Acceptance: explain every observation from visible local data; no generated claims or AI provider needed; empty or poorly captured weeks produce no invented insight.

## 5. Optional time boundaries

Allow a user to set a session limit for a chosen activity, such as a 60-minute gaming break. One gentle notification after that limit, with snooze or dismissal. Never enable automatically, repeatedly nag, block apps, or treat leisure as failure.

Build this only after session continuity is reliable. Test restart, sleep, idle gaps, changing session boundaries, and suppression of duplicate notifications.

## Shipping order

Reliability and session corrections come first. Prototype the one-intention flow next, verify that it remains unobtrusive, then build intention comparisons. Weekly reviews and notifications are later options, not commitments for this improvement pass.

Out of scope: chatbot, automatic task extraction, arbitrary productivity scores, screen recordings, audio capture, social leaderboards, or a fixed hourly activity grid.
