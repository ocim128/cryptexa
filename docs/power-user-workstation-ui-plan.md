# Power User Workstation UI Plan

## Purpose

Redesign Cryptexa into a dense, top-oriented writing workspace that favors speed, visibility, and low visual noise.

This document exists to prevent redesign drift. It locks scope, visual rules, file ownership, phase order, and exit criteria before implementation starts.

## Product Rules

- Keep the note list on top. Do not move note navigation to a sidebar.
- Keep core actions visible on desktop: Save, Change Password, Reload, Delete, Search, Export, Theme.
- Prioritize the work surface over app chrome: editor first, tabs second, toolbar third, status last.
- Remove controls and decoration that do not improve throughput.
- Keep encryption, storage, tab behavior, search, quick switcher, export, and keyboard shortcuts intact unless this plan explicitly changes them.
- Keep light and dark themes, but redesign them from one shared token system. Light theme is the baseline reference.
- Do not add webfont dependencies in this redesign. Use system sans and `ui-monospace`.
- Remove arbitrary tab color customization.
- Remove playful copy, emoji, and kinetic or orbit decoration from the primary UI.

## Non-Goals

- No rich text editor.
- No storage or crypto changes.
- No new tagging, grouping, or sidebar navigation system.
- No hidden kebab-menu-first workflow for core actions.
- No major feature additions beyond better presentation of existing features.

## Intentional Behavior Changes

- Remove arbitrary tab color customization and all related UI, code paths, and tests.
- Move `Search`, `Export`, and `Help` into stable shell markup. They must not appear through runtime DOM injection.
- Replace shortcut duplication with one authoritative shortcut map. One shortcut must not have two meanings in different surfaces.
- Replace ephemeral shortcut-help notification behavior with a structured help surface that can be scanned and closed deliberately.
- Keep the landing page minimal and separate from the workspace. Do not show disabled workspace controls on landing.

## Reference Use

Borrow from `AutoBeli`:

- disciplined token system
- thin borders over heavy shadows
- one restrained accent color
- mono utility labels
- tighter visual hierarchy

Do not borrow literally:

- storefront hero layout
- serif-heavy marketing treatment
- decorative framing on every surface
- product-card style composition

## Code Structure Rules

- [index.html](/C:/Users/user/Documents/Repo/Cryptexa/index.html) owns visible shell markup.
- [src/app.ts](/C:/Users/user/Documents/Repo/Cryptexa/src/app.ts) owns event wiring and state coordination. It must not inject toolbar buttons or inline button styling.
- [styles.css](/C:/Users/user/Documents/Repo/Cryptexa/styles.css) is the visual source of truth. Remove duplicate rules instead of layering new overrides on top.
- [src/ui](/C:/Users/user/Documents/Repo/Cryptexa/src/ui) modules may toggle classes and build dynamic utility surfaces, but styling must come from CSS classes and tokens.
- Kinetic CSS/runtime assets are not part of the target visual system. Do not reintroduce them into the active runtime path.
- Treat [src/app.ts](/C:/Users/user/Documents/Repo/Cryptexa/src/app.ts), [index.html](/C:/Users/user/Documents/Repo/Cryptexa/index.html), and [styles.css](/C:/Users/user/Documents/Repo/Cryptexa/styles.css) as source files. Do not hand-edit generated artifacts such as [app.js](/C:/Users/user/Documents/Repo/Cryptexa/app.js), [app.min.js](/C:/Users/user/Documents/Repo/Cryptexa/app.min.js), [styles.min.css](/C:/Users/user/Documents/Repo/Cryptexa/styles.min.css), `dist/*`, or `public/*`.
- The only inline script allowed after redesign is early theme bootstrapping if needed to prevent theme flash. Landing/workspace shell logic must not remain as inline script in `index.html`.

## Cross-Cutting Requirements

- Keyboard flows remain first-class. Visible UI must match actual shortcuts.
- Shortcut definitions, help copy, and utility-surface footer hints must come from one canonical shortcut map or one canonical source block. Do not maintain separate hard-coded shortcut lists.
- Do not ship browser-reserved shortcut conflicts without Phase 0 verification. If a shortcut collides with browser print, new-tab, or similar default behavior in the supported browser, remap it once and update every surface in the same phase.
- No core action should be discoverable only on hover.
- Focus states must remain visible across toolbar, tabs, editor, dialogs, search, and switcher.
- Motion must be optional and subtle. UI meaning cannot depend on animation.
- Toolbar and tab strip must not shift after runtime initialization.
- Large-note performance protections must remain intact.
- Search, switcher, help, and confirmation surfaces should share one overlay pattern. Prefer native `dialog` unless a concrete blocker appears.

## Phase 0 - Baseline Capture

### Purpose

Protect current behavior before changing structure and presentation.

### Files

- [tests/e2e/tabs.spec.js](/C:/Users/user/Documents/Repo/Cryptexa/tests/e2e/tabs.spec.js)
- [tests/e2e/keyboard.spec.js](/C:/Users/user/Documents/Repo/Cryptexa/tests/e2e/keyboard.spec.js)
- [tests/e2e/search.spec.js](/C:/Users/user/Documents/Repo/Cryptexa/tests/e2e/search.spec.js)
- [tests/e2e/theme.spec.js](/C:/Users/user/Documents/Repo/Cryptexa/tests/e2e/theme.spec.js)
- [tests/e2e/extended-features.spec.js](/C:/Users/user/Documents/Repo/Cryptexa/tests/e2e/extended-features.spec.js)

### Work

- Run the existing Playwright suite that covers tabs, keyboard shortcuts, search, theme, and extended features.
- Capture reference screenshots for landing, authenticated workspace, multi-row tab strip, search dialog, tab switcher, delete confirmation dialog, and mobile toolbar.
- Write a regression checklist for tab add, close, reorder, pin, switch, save, reload, delete, export, search, quick switcher, theme toggle, and password dialogs.
- Verify actual browser behavior for reserved or conflict-prone shortcuts used today, especially new-tab and quick-switcher flows. Record which bindings are safe to keep and which must be remapped.
- Create an intentional-change ledger so QA can distinguish deliberate removals from regressions. Minimum entries: tab color picker removal, runtime toolbar injection removal, help-surface change, and kinetic decoration removal.
- Identify runtime-inserted UI that will be removed later: search button, export button, inline-styled help button, and tab color picker.

### Exit Criteria

- Current behavior baseline is recorded.
- Known failing tests, if any, are documented before redesign work starts.
- Regression checklist exists and is specific enough to validate every later phase.

## Phase 1 - Visual Foundation and Cleanup Boundaries

### Purpose

Create one stable visual system before redesigning individual surfaces.

### Files

- [styles.css](/C:/Users/user/Documents/Repo/Cryptexa/styles.css)
- [src/ui/themes.ts](/C:/Users/user/Documents/Repo/Cryptexa/src/ui/themes.ts)
- [index.html](/C:/Users/user/Documents/Repo/Cryptexa/index.html)
- [src/app.ts](/C:/Users/user/Documents/Repo/Cryptexa/src/app.ts)

### Work

- Replace the current blue-green token mix with a neutral productivity palette and one accent color.
- Define tokens for app background, panel surfaces, borders, primary text, secondary text, accent, success, warning, danger, editor surface, and gutter surface.
- Reduce global radius and shadow weight. Prefer thin borders and flat planes.
- Keep one token map for light and dark themes. Do not hand-style components per theme.
- Remove duplicate CSS blocks in `styles.css`, especially repeated dialog and modified-tab styling.
- Remove decorative kinetic or orbital styling from the app shell, dialogs, and landing.
- Stop creating toolbar controls from JavaScript. Visible shell controls must exist in `index.html`.
- Remove inline styles from markup and runtime-created controls.
- Move landing/workspace shell toggling out of the inline script in `index.html` into source-controlled TypeScript owned by `src/app.ts` or a dedicated `src/ui` module.

### Exit Criteria

- Both themes are token-driven.
- No toolbar button is created at runtime.
- No visible toolbar control depends on inline styles.
- Kinetic decoration is removed from the main UI path.
- `styles.css` no longer contains duplicate component definitions for the same surface.
- Landing/workspace shell state is no longer controlled by an inline script.

## Phase 2 - Toolbar Information Architecture

### Purpose

Make the top bar fast to scan, dense, and functional without hiding actions.

### Files

- [index.html](/C:/Users/user/Documents/Repo/Cryptexa/index.html)
- [styles.css](/C:/Users/user/Documents/Repo/Cryptexa/styles.css)
- [src/app.ts](/C:/Users/user/Documents/Repo/Cryptexa/src/app.ts)

### Work

- Replace the current flat button row with explicit groups for brand and site context, primary actions, utility actions, and status metadata.
- Make `Save` the only primary-emphasis action.
- Make `Change Password`, `Reload`, `Search`, and `Export` secondary actions.
- Make `Delete` a danger-outline action, never equal in weight to `Save`.
- Keep `Theme` and `Help` visible, but style them as compact utilities.
- Add `Search` as static markup in the toolbar. Remove runtime insertion from `src/app.ts`.
- Add `Export` as static markup in the toolbar. Remove runtime insertion from `src/app.ts`.
- Decide whether to show the current site id beside the brand or inside compact toolbar metadata. Keep it visible after initialization.
- Redesign the status indicator so it reads like metadata, not a widget.
- Allow toolbar wrapping on narrower widths before hiding anything. Core actions stay visible.
- Standardize control height, padding, border, hover, active, and disabled states.
- Keep the landing page separate from the workspace shell. Landing must not render a disabled toolbar state.

### Exit Criteria

- Toolbar order is fixed in markup, not created by runtime DOM injection.
- Save is visually dominant.
- Delete is clearly destructive but not visually loud by default.
- All core actions are visible at desktop width.
- At tablet widths the toolbar wraps cleanly instead of overlapping or collapsing randomly.
- Status text can show `Ready`, `Modified`, `Saving`, `Saved`, or `Error` without dominating the row.

## Phase 3 - Tab Strip Redesign

### Purpose

Keep top navigation dense and readable while reducing visual clutter.

### Files

- [styles.css](/C:/Users/user/Documents/Repo/Cryptexa/styles.css)
- [src/ui/tabs.ts](/C:/Users/user/Documents/Repo/Cryptexa/src/ui/tabs.ts)
- [src/ui/tab-switcher.ts](/C:/Users/user/Documents/Repo/Cryptexa/src/ui/tab-switcher.ts)
- [index.html](/C:/Users/user/Documents/Repo/Cryptexa/index.html)
- [tests/e2e/tabs.spec.js](/C:/Users/user/Documents/Repo/Cryptexa/tests/e2e/tabs.spec.js)
- [tests/e2e/keyboard.spec.js](/C:/Users/user/Documents/Repo/Cryptexa/tests/e2e/keyboard.spec.js)

### Work

- Keep tabs above the editor. Do not introduce a sidebar alternative.
- Replace the raised-card tab style with a flatter note-strip style.
- Signal active state with stronger text and a restrained accent underline or top bar, not a thick full-border treatment.
- Standardize tab width, padding, truncation, spacing, and close affordance.
- Keep wrapped rows, but ensure the add-tab button is anchored cleanly and does not overlap wrapped tabs.
- Keep modified state, but render it as a small stable marker instead of a visually noisy badge.
- Keep pinned state, but render it as a compact marker without decorative chrome.
- Remove arbitrary per-tab background colors and remove the color picker from the shell.
- Keep drag and drop, but simplify drag-over and dragging visuals.
- Align the quick tab switcher with the tab-strip system: compact row height, no emoji, consistent pinned and modified markers, and a tighter footer or no footer if redundant.
- Reconcile shortcut copy with actual behavior. Fix any mismatch between the help surface and current bindings.
- If a quick-switcher shortcut is remapped during Phase 0 conflict audit, update switcher open behavior, in-switcher hints, and all related tests in the same phase as the UI change.

### Exit Criteria

- Twenty or more tabs remain readable without looking like stacked buttons.
- Active, pinned, and modified states are distinguishable at a glance.
- Add-tab placement stays stable with one row or multiple rows.
- The tab switcher visually belongs to the same system as the tab strip.
- The tab color picker is removed.

## Phase 4 - Editor Surface and Writing Ergonomics

### Purpose

Make the editor the dominant surface and reduce distracting state changes.

### Files

- [styles.css](/C:/Users/user/Documents/Repo/Cryptexa/styles.css)
- [src/ui/tabs.ts](/C:/Users/user/Documents/Repo/Cryptexa/src/ui/tabs.ts)

### Work

- Reduce editor framing so the writing surface feels stable instead of card-like.
- Keep the line gutter, but lower its contrast and visual weight.
- Use one mono stack consistently for editor text, gutter text, and code-like snippets in utility surfaces.
- Replace the current full-surface focus background shift with a quieter focus treatment.
- Tune active-line and selected-line highlights so they support orientation without coloring the editor too aggressively.
- Rebalance editor padding, gutter width, and line rhythm for dense writing sessions.
- Make caret, selection, scrollbar, and placeholder styling consistent with the new token system.
- Keep large-note protections in place: debounced gutter work, low-cost tab switching, and no unnecessary paint-heavy effects on the textarea.

### Exit Criteria

- The editor has the strongest visual priority on screen.
- Focus state is visible without flooding the whole canvas.
- Gutter alignment remains correct across themes.
- Large notes do not lose current performance protections.

## Phase 5 - Dialogs, Search, Switcher, and Landing

### Purpose

Bring all secondary surfaces into the same system and remove decorative noise.

### Files

- [index.html](/C:/Users/user/Documents/Repo/Cryptexa/index.html)
- [styles.css](/C:/Users/user/Documents/Repo/Cryptexa/styles.css)
- [src/app.ts](/C:/Users/user/Documents/Repo/Cryptexa/src/app.ts)
- [src/ui/search.ts](/C:/Users/user/Documents/Repo/Cryptexa/src/ui/search.ts)
- [src/ui/tab-switcher.ts](/C:/Users/user/Documents/Repo/Cryptexa/src/ui/tab-switcher.ts)
- [src/ui/dialogs.ts](/C:/Users/user/Documents/Repo/Cryptexa/src/ui/dialogs.ts)

### Work

- Rewrite landing copy into terse technical language.
- Keep landing structure simple: one title, one short explanation, one input, and one primary action.
- Remove jokes, emoji, and decorative security marketing language from landing and help surfaces.
- Simplify password and confirmation dialogs into one consistent structure and button hierarchy.
- Remove glossy gradients, orbit rings, and decorative dialog bars.
- Redesign search results into a dense utility list with tab name, line number, one-line snippet, and selected state.
- Redesign quick switcher into a compact command palette.
- Move help into a structured overlay using the same dialog pattern as search and switcher. Do not keep shortcut help as a transient notification.
- Keep help and shortcuts factual and aligned with actual bindings.
- Ensure all dialogs use the same spacing, radius, border, shadow, and focus rules.

### Exit Criteria

- No primary UI surface contains emoji or joke copy.
- Landing and dialogs visually belong to the same application as the workspace.
- Search and switcher feel like utility tools, not showcase components.
- Kinetic dialog decoration is removed from active use.
- Help is a structured overlay, not a toast-like notification.

## Phase 6 - Responsive Pass, Cleanup, and QA

### Purpose

Finish the redesign without shipping dead code, layout regressions, or behavior drift.

### Files

- [styles.css](/C:/Users/user/Documents/Repo/Cryptexa/styles.css)
- [src/app.ts](/C:/Users/user/Documents/Repo/Cryptexa/src/app.ts)
- [src/ui/search.ts](/C:/Users/user/Documents/Repo/Cryptexa/src/ui/search.ts)
- [src/ui/tab-switcher.ts](/C:/Users/user/Documents/Repo/Cryptexa/src/ui/tab-switcher.ts)
- [tests/e2e/tabs.spec.js](/C:/Users/user/Documents/Repo/Cryptexa/tests/e2e/tabs.spec.js)
- [tests/e2e/search.spec.js](/C:/Users/user/Documents/Repo/Cryptexa/tests/e2e/search.spec.js)
- [tests/e2e/keyboard.spec.js](/C:/Users/user/Documents/Repo/Cryptexa/tests/e2e/keyboard.spec.js)
- [tests/e2e/theme.spec.js](/C:/Users/user/Documents/Repo/Cryptexa/tests/e2e/theme.spec.js)
- [tests/e2e/extended-features.spec.js](/C:/Users/user/Documents/Repo/Cryptexa/tests/e2e/extended-features.spec.js)

### Work

- Audit the redesigned UI at 1440, 1280, 1024, 768, and 480 widths.
- Confirm that the toolbar wraps before it hides core actions.
- Confirm that wrapped tab rows do not break add-tab placement.
- Remove dead CSS selectors and runtime code left from the tab color picker, runtime toolbar button insertion, kinetic decoration, and duplicate component rules.
- Verify parity for both themes across toolbar, tabs, editor, dialogs, search, and switcher.
- Update Playwright tests to cover visible toolbar actions, removed tab color picker, search button existence, export button existence, actual shortcut behavior, help overlay behavior, and layout stability at narrower widths.
- Replace or delete tests that assert intentionally removed behavior. Minimum targets: tab color customization assertions and runtime search-button injection assumptions.
- Regenerate checked-in browser artifacts after source changes. Minimum commands before final QA: `npm run bundle:dev`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, and `npm run build`.
- Add at least one desktop workspace screenshot assertion and one narrow-width screenshot assertion if the current test setup supports it.

### Exit Criteria

- No dead runtime insertion remains for toolbar controls.
- No orphaned kinetic UI code remains in the active path.
- Layout is stable across defined breakpoints.
- Automated tests pass or any exception is documented and deliberate.
- Root runtime artifacts are refreshed from source before the phase is considered complete.

## Final Acceptance Checklist

- Notes remain listed on top, not on the side.
- Core actions stay visible on desktop.
- Save is the clearest primary action.
- Search and export are present in the toolbar as first-class actions.
- Arbitrary tab colors are removed.
- The editor is visually calmer and more dominant than the chrome around it.
- Status reads as metadata, not as a separate widget.
- Search, tab switcher, dialogs, and landing share one visual system.
- Primary UI copy is terse and technical.
- The redesign improves density and scan speed without reducing functionality.
