# Cryptexa Performance Improvements Plan

## Scope

This plan covers incremental, low-risk performance improvements for the current Cryptexa repository.

Relevant architecture observed in the repo:

- Browser app entrypoint: `src/app.ts`, bundled to `public/app.js` and `dist/app.js` by `build.js`.
- Client state and persistence orchestration: `src/state/ClientState.ts`.
- Editor/tab UI: `src/ui/tabs.ts`, `src/ui/search.ts`, `src/ui/tab-switcher.ts`.
- Crypto helpers: `src/crypto/*`, `src/utils/crypto-helpers.ts`.
- Express backend: `server-app.ts`, compiled to `dist/server.js`.
- Persistence modes:
  - File mode via `db.json`, default outside Vercel.
  - MongoDB mode via `mongodb`, required on Vercel by runtime validation.
- API routes:
  - `GET /api/json`
  - `POST /api/save`
  - `POST /api/delete`
  - `GET /health`
- Static routes currently served manually in `server-app.ts`.

## Non-Goals

- No service worker.
- No offline API cache.
- No browser cache for encrypted workspace API responses.
- No rewrite of the editor, backend, or persistence model.
- No change to encryption format unless explicitly covered by tests and backward compatibility.
- No change to optimistic concurrency semantics.

## Assumptions And Unknowns

- Assumption: `initHashContent` and `currentHashContent` are the active optimistic concurrency contract.
- Assumption: stale API responses can cause save conflicts or data loss, so API responses must remain uncached.
- Assumption: static asset caching is safe only for assets that are content-hashed or operationally acceptable to keep cached.
- Unknown: production traffic volume and average encrypted payload size.
- Unknown: MongoDB deployment topology and network latency.
- Unknown: whether external consumers request `/icon.png` directly.
- Unknown: whether deploy hosts already apply compression or cache headers upstream.

## Save Conflict And Cache Safety Contract

All phases must preserve these rules:

- Never cache `GET /api/json` at browser, proxy, CDN, or Express middleware level.
- Never cache `POST /api/save` or `POST /api/delete`.
- Add or preserve `Cache-Control: no-store` on all `/api/*` responses.
- Do not cache encrypted workspace payloads in `localStorage`, `sessionStorage`, service workers, or IndexedDB.
- Do not cache `currentHashContent` beyond the existing in-memory `ClientState.remote.currentHashContent`.
- Every save must continue sending the latest known `initHashContent`.
- Every successful save must update `remote.currentHashContent` and `initHashContent` from the server response.
- Static asset caching must be restricted to files outside `/api/*`.

Recommended backend guardrail:

```ts
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
```

## Phase 0: Baseline And Contracts

### Objective

Create a measurable baseline and lock in the data freshness contract before performance changes.

### Scope

- Tests and lightweight instrumentation only.
- No behavior-changing performance work.

### Technical Tasks

- Record current unit test, lint, typecheck, build, and e2e status.
- Add focused tests for API cache headers if backend test infrastructure supports Express request testing.
- Add unit tests around `ClientState.saveSite()` to verify:
  - `initHashContent` is sent on save.
  - successful save updates `initHashContent`.
  - overwrite/conflict responses do not mutate local remote hash state.
- Document static versus API cache policy in this file and optionally `SECURITY.md`.

### Dependencies

- Existing Vitest setup in `vitest.config.js`.
- Existing server validation tests in `tests/unit/server.test.ts`.

### Risks/Blockers

- Current tests may not instantiate Express routes directly.
- Adding HTTP route tests may require `supertest` or equivalent dev dependency.

### Deliverables

- Test coverage for save freshness behavior.
- Test or manual verification note for API `Cache-Control: no-store`.
- Baseline timings and artifact sizes recorded in PR notes.

### Validation/Testing Criteria

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e` when browser/runtime behavior changes.

### Exit Criteria

- Cache safety rules are explicit.
- Baseline is recorded.
- No performance phase starts until API freshness behavior is covered by tests or a documented manual check.

## Phase 1: Static Asset Delivery

### Objective

Reduce static transfer cost without caching encrypted workspace data or API responses.

### Scope

- Static files only: JS, CSS, favicons, touch icon.
- Express static serving and build output.
- No changes to `/api/*` data flow.

### Technical Tasks

- Add API no-store middleware before API routes in `server-app.ts`.
- Replace manual static asset route loop with `express.static(PUBLIC_DIR, ...)` where possible.
- Add compression middleware if deployment does not already compress responses.
- Use conservative cache headers for non-hashed JS/CSS.
- Prefer content-hashed `app.[hash].js` and `styles.[hash].css` before using immutable caching for JS/CSS.
- Patch `build.js` to write hashed JS/CSS filenames into `dist/index.html` and `public/index.html`.
- Preserve `GET /:site` fallback serving `index.html` uncached or short cached.

### Dependencies

- `build.js`
- `server-app.ts`
- `index.html`
- Deployment configs: `vercel.json`, `render.yaml`, `Dockerfile`

### Risks/Blockers

- Incorrect immutable caching on non-hashed `app.js` could ship stale client code.
- Static middleware order must not intercept `/api/*` or workspace path fallback.
- Vercel/static host behavior may differ from local Express.

### Deliverables

- Static assets served with appropriate cache headers.
- API responses explicitly no-store.
- Build produces stable HTML references to hashed assets if immutable JS/CSS caching is used.

### Validation/Testing Criteria

- Verify `/api/json`, `/api/save`, `/api/delete` include `Cache-Control: no-store`.
- Verify `/app*.js`, `/styles*.css`, icons return intended cache headers.
- Run e2e save/reload flow to ensure no stale workspace data is read.
- Confirm workspace route `/:site` still serves the app shell.

### Exit Criteria

- Repeat static loads are cacheable.
- API data cannot be cached by browser/proxy/CDN.
- No save conflict caused by stale `currentHashContent`.

## Phase 2: Remove Or Shrink Dead Static Asset Weight

### Objective

Reduce deploy size and static serving surface by removing unused large assets.

### Scope

- `icon.png` handling only unless additional unused static assets are proven unused.

### Technical Tasks

- Confirm `icon.png` has no runtime references.
- Remove `icon.png` from:
  - `PUBLIC_STATIC_FILES` in `build.js`
  - `STATIC_ASSETS` in `server-app.ts`
- If external compatibility requires `/icon.png`, replace it with a smaller optimized asset.
- Keep favicons and apple-touch icon because `index.html` references them.

### Dependencies

- `build.js`
- `server-app.ts`
- `index.html`

### Risks/Blockers

- External bookmarks or integrations may request `/icon.png` despite no repo reference.

### Deliverables

- Smaller `dist/` and `public/` outputs.
- No unused large static route.

### Validation/Testing Criteria

- `npm run build`
- Confirm `dist/` and `public/` no longer include unused `icon.png`, or include optimized replacement.
- Confirm favicon and touch icon still load.

### Exit Criteria

- Removed asset does not affect page rendering or browser icon behavior.
- No API or save behavior changes.

## Phase 3: Editor Hot Path Optimization

### Objective

Reduce duplicate work on textarea input while preserving editor behavior.

### Scope

- `src/app.ts`
- `src/ui/tabs.ts`
- Existing tab/editor tests.

### Technical Tasks

- Audit duplicate textarea input handlers:
  - Per-textarea listener in `addTab()`.
  - Global textarea listener in `wireWorkspaceEvents()`.
- Centralize gutter updates in one path.
- Preserve RAF batching and huge-note debounce behavior.
- Ensure title updates, search index dirty marking, active-line highlights, and modified flags still fire.
- Add or update unit/e2e coverage for tab input and gutter updates.

### Dependencies

- Existing editor metrics cache in `src/ui/tabs.ts`.
- Existing global workspace input pipeline in `src/app.ts`.

### Risks/Blockers

- Removing the wrong input path could break line gutter refresh for tabs created before workspace initialization.
- JSDOM may not fully validate visual gutter behavior.

### Deliverables

- One authoritative input pipeline for gutter refresh.
- No duplicate line-count recomputation per keystroke.

### Validation/Testing Criteria

- Unit tests for tab creation and input.
- E2E typing test on existing workspace.
- Manual or automated large note smoke test around 50,000+ characters.

### Exit Criteria

- Gutter, title, modified state, search dirty state, and highlights still update.
- Typing does less duplicated work.
- No persistence or save conflict behavior changes.

## Phase 4: Crypto Serialization Optimization

### Objective

Speed up save/decrypt CPU time for large encrypted payloads without changing payload format.

### Scope

- `src/utils/crypto-helpers.ts`
- Existing crypto tests.

### Technical Tasks

- Replace per-byte string concatenation in `bufToHex()` with table-based conversion.
- Replace `substr` and `parseInt` loop in `hexToBuf()` with a faster decoder.
- Preserve exact lowercase hex output.
- Preserve accepted input behavior for existing encrypted payloads.
- Add tests for roundtrip conversion, odd/malformed hex behavior if current behavior is relied on.

### Dependencies

- `src/crypto/aes-gcm.ts`
- `src/crypto/pbkdf2.ts`
- `tests/unit/crypto.test.ts`

### Risks/Blockers

- Hex decoder edge cases can affect decrypt/save.
- Web Crypto dominates small payload cost, so gains mainly affect large payloads.

### Deliverables

- Faster hex encode/decode helpers.
- Backward-compatible encrypted payload format.

### Validation/Testing Criteria

- Existing crypto tests.
- New hex roundtrip tests.
- Save/decrypt e2e test with existing payload.

### Exit Criteria

- Old payloads decrypt.
- New payloads save and reload.
- `salt:iv:cipherHex` contract unchanged.

## Phase 5: File Persistence I/O Optimization

### Objective

Reduce file-mode save latency and disk I/O while preserving optimistic concurrency.

### Scope

- File mode only in `server-app.ts`.
- No MongoDB behavior change in this phase.

### Technical Tasks

- Keep `Database.runFileMutation()` serialization.
- Preserve in-memory `fileDb` conflict check before mutation.
- Replace backup copy strategy with safer write-then-rotate flow:
  - Write complete temp file.
  - Remove old backup.
  - Rename current DB to backup.
  - Rename temp to active DB.
- Ensure temp cleanup on failure.
- Consider adding lightweight `fsync` only if durability requirements justify the cost.

### Dependencies

- `FileDatabaseStore.save()`
- `Database.saveSiteIfUnchanged()`
- `Database.deleteSiteIfUnchanged()`

### Risks/Blockers

- Rename semantics differ across filesystems.
- Crash between rename steps could require fallback load from `.bak`.
- Current backup loader must continue working.

### Deliverables

- Lower file-mode save I/O.
- Existing backup recovery behavior preserved or improved.

### Validation/Testing Criteria

- Unit/integration tests for:
  - First save.
  - Overwrite conflict.
  - Delete conflict.
  - Corrupt `db.json` fallback to `.bak`.
- Manual save/reload in file mode.

### Exit Criteria

- File save still rejects stale `initHashContent`.
- No stale DB data can be served from cache.
- Backup recovery still works.

## Phase 6: Fetch Timeout And Retry Policy

### Objective

Improve failure latency and avoid long-hanging requests.

### Scope

- `src/utils/fetch.ts`
- Call sites in `src/app.ts` and `src/state/ClientState.ts`.

### Technical Tasks

- Extend `fetchWithRetry()` to accept options such as:
  - `maxRetries`
  - `timeoutMs`
  - optional retryable status codes if needed later.
- Use short timeout for `/health`.
- Use moderate timeout for `GET /api/json`.
- Use longer timeout and no automatic retry for mutating `POST /api/save` and `POST /api/delete`.
- Preserve AbortError handling.

### Dependencies

- Existing `fetchWithRetry()` callers.
- UI toast/error behavior in `ClientState`.

### Risks/Blockers

- Too short save timeout can fail on large encrypted payloads or slow networks.
- Retrying mutating saves can be unsafe unless idempotency is proven.

### Deliverables

- Operation-specific network timeout behavior.
- No automatic retry of mutating save/delete by default.

### Validation/Testing Criteria

- Unit tests with mocked fetch timeout and abort.
- E2E save/delete still pass.
- Health check failure returns warning quickly.

### Exit Criteria

- Failed health/load paths no longer wait 60 seconds.
- Save/delete do not duplicate writes through retry behavior.
- Save conflict semantics unchanged.

## Phase 7: MongoDB New-Site Save Optimization

### Objective

Reduce MongoDB round trips for first save while preserving conflict detection.

### Scope

- MongoDB path in `Database.saveSiteIfUnchanged()` only.

### Technical Tasks

- For empty `initHashContent`, evaluate insert-first logic:
  - `insertOne(document)` for new site.
  - On duplicate key, return conflict unless current DB state is explicitly allowed by the existing contract.
- Preserve current conditional update path for non-empty `initHashContent`.
- Keep unique index on `{ site: 1 }`.
- Add projection to `getSite()` if useful.

### Dependencies

- MongoDB collection `sites`.
- Unique index creation in `connectMongoDB()`.

### Risks/Blockers

- Incorrect insert-first fallback can allow overwrite or false conflict.
- Requires MongoDB-backed test or carefully isolated mock/integration test.

### Deliverables

- New-site Mongo save avoids update-then-insert round trip.
- Existing-session conflict behavior preserved.

### Validation/Testing Criteria

- Mongo integration tests if environment is available.
- Otherwise isolated tests around filter construction and duplicate-key handling.
- E2E behavior in file mode remains unchanged.

### Exit Criteria

- First save succeeds for new site.
- Concurrent first save produces one success and one conflict.
- Existing stale save still conflicts.

## Observability And Logging

Current architecture has production request logging in `server-app.ts`. Performance work should add only targeted logging if needed.

Tasks:

- Keep production request duration log.
- Avoid logging workspace content, encrypted payloads, passwords, or full query strings containing password material.
- For cache rollout, optionally log response headers in development only.
- For file persistence changes, log backup recovery and save failures only.

Exit criteria:

- Debugging data is enough to diagnose cache/header behavior.
- Logs do not expose secrets or encrypted note payloads.

## Security Considerations

- API no-store is required because stale encrypted payload plus stale hash metadata can create false save conflicts or overwrite confusion.
- Static caching must never include URL fragments, password-bearing URLs, or API responses.
- Compression is acceptable for static assets. Avoid adding compression-specific behavior that reflects secrets in dynamic responses.
- Keep Helmet CSP behavior intact.
- Keep client-side encryption boundary unchanged.

## Rollback Strategy

- Phase 1 rollback:
  - Revert `express.static`, compression, and hashed asset changes.
  - Keep API `no-store` middleware unless it causes a proven issue.
- Phase 2 rollback:
  - Re-add `icon.png` to build/server static lists.
- Phase 3 rollback:
  - Restore prior duplicated input listeners.
- Phase 4 rollback:
  - Restore original `bufToHex()` and `hexToBuf()`.
- Phase 5 rollback:
  - Restore copy-based backup strategy.
- Phase 6 rollback:
  - Restore previous `fetchWithRetry()` signature and call sites.
- Phase 7 rollback:
  - Restore update-then-insert Mongo save flow.

Each phase should be merged independently to keep rollback small.

## Execution Order

1. Phase 0: Baseline and contracts.
2. Phase 1: Static delivery with API no-store guardrail.
3. Phase 2: Remove or shrink unused static asset.
4. Phase 3: Editor hot path.
5. Phase 4: Crypto serialization.
6. Phase 5: File persistence I/O.
7. Phase 6: Fetch timeout/retry policy.
8. Phase 7: MongoDB new-site save optimization.

Phase 7 should wait until lower-risk phases are complete because it touches distributed conflict behavior.
