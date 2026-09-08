# Argus improvement pass

## Scope and continuation

User authorized continued review, improvements, feature plans, and existing-branch pushes within their current five-hour Codex allowance. Heartbeat automation: `improve-argus-sessions`, every 15 minutes. Stop/pause at 99% usage, any change to reset timestamp `1788902183`, or UTC `2026-09-08T21:16:23Z`. Do not consume another window or a reset. No agents, audio, or screenshots of personal activity.

Read the current git status before each pass. Preserve the variable-length dominant-session design. Feature direction is in PRODUCTIVITY_ROADMAP.md.

## September 9 — first pass

- Fixed transitions that incorrectly reset when a user briefly checks Discord or returns to the preceding game during an otherwise sustained YouTube session. Candidate activity changes now tolerate brief detours while retaining the 15-minute / 70% evidence requirement.
- Moved session details directly below the selected card, so opening an early session does not put its explanation offscreen below the whole day's list.
- The Today view now follows midnight automatically, while a deliberately chosen historical date stays selected.
- Wrote a minimal productivity roadmap: trustworthy corrections, one daily intention, user-linked effort comparison, optional weekly reflection, and opt-in time boundaries.

Validation: 30 regression tests, production build, syntax/type check, and native Electron smoke passed. The smoke verifies the 90/30-minute example, inline detail placement, historical date selection, and narrow-window layout. The Today midnight update is implemented; a real overnight pilot remains outstanding.

## Next useful audits

1. Mixed activity and exact ties currently select a named winner; assess an honest Mixed session fallback while preserving actual breakdown totals.
2. Performance: the grouper repeatedly summarizes growing minute arrays. Measure a full month of stored data and a busy day before optimizing.
3. Accuracy: minute-boundary rounding, truncated historical records, and capture gaps. Verify sums never exceed plausible recorded duration.
4. Improve the browser sample data to use the same minute-total format as current tracking; it still uses legacy estimated spans.
5. Confirm live tracker health without exposing personal window titles. Existing user consent covers foreground tracking, but do not restart or interrupt an unrelated app instance.
6. Plan correction storage and stable session identity before adding editable productivity labels.

Only report new actionable findings or completed changes. Do not repeat unchanged progress or add features just to consume allowance.
