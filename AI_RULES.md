# AI Rules

## Tech stack

- This app is a **browser-native single-page app** built as a **single HTML file**: `kira_v3.html`.
- The codebase uses **vanilla JavaScript**, not React, TypeScript, Vue, or any bundler-based framework.
- Styling is done with **plain CSS inside the HTML file**, with heavy use of **CSS custom properties** for themes and design tokens.
- The UI is rendered and updated with **direct DOM APIs** such as `querySelector`, element creation, class toggles, and event listeners.
- Persistence is handled with **`localStorage`**, using versioned keys like `kira_state_v3`, `kira_ai_v3`, `kira_images_v3`, `kira_profilepic_v3`, `kira_theme_v1`, and `kira_adaptive_v1`.
- App reliability depends on **atomic client-side persistence**, especially the `persistAtomically()` flow and transaction marker recovery.
- Image handling uses **browser-native file APIs**: `FileReader`, `Image`, and `<canvas>` for client-side compression and previews.
- The project includes **standalone HTML-based test pages** in `tests/` rather than a package-managed test runner.
- The app is designed for **fully client-side operation with zero network calls** during runtime.
- External dependencies are minimal; the main external asset in active use is **Google Fonts** loaded from the document head.

## Library and API usage rules

- **Use vanilla JavaScript for all app logic.** Do not introduce React, TypeScript, jQuery, Vue, Svelte, or build-tool-dependent code unless explicitly requested.
- **Use direct DOM APIs for UI changes.** For rendering, state reflection, and interaction wiring, prefer `document.createElement`, `querySelector`, `textContent`, `classList`, and `addEventListener`.
- **Use plain CSS for styling.** Keep styles in the existing CSS approach, reuse the current CSS variables, and extend the theme tokens instead of adding Tailwind, Bootstrap, or CSS-in-JS.
- **Use `localStorage` for persistence.** New durable client state should follow the existing versioned-key pattern. Do not rename existing keys without adding a migration path.
- **Use `persistAtomically()` when changing persisted state that must stay in sync.** Do not write coupled state directly in multiple places if the existing atomic persistence flow should own it.
- **Use browser-native image APIs for media features.** For uploads, previews, resizing, or compression, use `FileReader`, `Image`, and `<canvas>` rather than adding image-processing libraries.
- **Use `textContent` and safe attribute assignment for user content.** Do not inject user-provided strings with `innerHTML`.
- **Preserve offline, client-only behavior.** Do not add fetch calls, backend dependencies, analytics SDKs, or cloud AI services unless explicitly requested.
- **Keep tests lightweight and browser-runnable.** If adding tests, follow the existing standalone HTML/JS testing style in the `tests/` directory unless the project is intentionally migrated.
- **Treat architecture docs as constraints.** When behavior touches persistence, invariants, routing, or neural components, align with `ARCHITECTURE.md`, `BACKEND_UPGRADE_AUDIT.md`, and related design docs.

## Change discipline

- Prefer small, surgical edits inside `kira_v3.html` unless a separate file clearly improves the code without introducing tooling.
- Maintain existing naming patterns, versioned storage keys, and invariant boundaries.
- Avoid adding new dependencies for functionality already covered by browser APIs.
- If a change would require a framework, package manager, or build step, call that out explicitly before making the shift.
