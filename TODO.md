# Prioritized improvement plan

Audit date: 2026-10-30. Baseline: 206 passing tests. Work proceeds from data integrity and app-breaking failures to build reliability and interface polish. Checkboxes record implemented and verified work, not just proposed changes.

1. [x] Reject malformed Unicode in canonical encoding so distinct strings cannot silently acquire identical canonical bytes and digests.
2. [x] Snapshot queued presenter inputs and imported event logs so caller mutation cannot corrupt committed state or deterministic replay.
3. [x] Recover from worker crashes, timeouts, and message failures; settle pending calls and release workers, timers, and object URLs.
4. [x] Keep mobile composer controls stationary when focus moves from the textarea to Send; real-browser testing found the layout shift could swallow the first tap.
5. [x] Remove the Android API 30-only inset operation from the API 24–29 path so supported older phones can launch.
6. [x] Preserve pending Android exports across activity recreation and handle cancellation and concurrent export requests explicitly.
7. [x] Move Android document writes off the UI thread and report their actual result.
8. [x] Align save, export, and import size limits in UTF-8 bytes so every accepted session backup can be imported.
9. [x] Return a structured invalid-query result for non-JSON query values such as BigInt instead of crashing while constructing the error.
10. [x] Apply narrative authoring text limits after Unicode normalization so every compiled package verifies itself.
11. [x] Enforce exact integer domains and bounded precision for potential/logarithm helpers, with independent numerical checks.
12. [x] Tighten event and image validation, rejecting malformed legacy entries, mismatched event fields, and invalid base64 before state changes.
13. [x] Keep a failed optional first-run theme save from blocking an otherwise usable conversation.
14. [x] Reload the Android start page when WebView state restoration cannot restore a page.
15. [x] Make narrative compiler output atomic and reject accidental overwrites of its input file.
16. [x] Keep ring-field geometry finite for empty, singleton, and degenerate topic sets; describe the actual layout mathematics accurately.
17. [x] Resolve multiword ring members using the matched phrase's weight and consume the phrase once.
18. [x] Make Android builds verify generated app bytes before packaging, preventing stale-source releases.
19. [x] Pin the Gradle wrapper and enforce Android lint/build checks in CI.
20. [x] Add repeatable release packaging with versioned HTML, SDK, APK/AAB, source package, and SHA-256 checksums.
21. [x] Prevent an expired success notification from hiding a newer save or conflict error.
22. [x] Fix dialog naming, image keyboard activation, and memory-filter focus retention.
23. [x] Compute “Yesterday” by local calendar date so labels work across daylight-saving changes.
24. [x] Report clipboard failure honestly and restore the initiating control's label and focus.
25. [x] Synchronize release versions, model/storage identities, compatibility notes, and build/release documentation.

## Completion gates

- Rebuild both generated deliverables and pass the full regression suite plus targeted failure-path checks.
- Exercise the browser's worker and inline paths and complete Android lint, APK, and AAB builds.
- Inspect packaged assets and verify their checksums before publication.
- Commit the completed changes, synchronize with `origin/main` without discarding remote work, push to `main`, and publish a release with the distribution artifacts.

## Validation record

- Generated HTML and SDK pass byte-for-byte source checks.
- 242 Node regression tests pass, including exact rational logarithm bounds and independent high-precision potential vectors.
- Chromium smoke tests pass with a real worker, worker recovery, and forced inline operation.
- Android lint has zero errors; all six export-store JVM tests pass, including stale callbacks against a replaced export. APK and AAB builds pass and embed the exact generated HTML.
- Three Python packaging tests pass. Packaged binaries contain the exact generated HTML; all five artifact checksums pass verification.
- The Android release signing certificate matches the previous sideloadable APK. Older model-pinned sessions remain accessible through their original app.
