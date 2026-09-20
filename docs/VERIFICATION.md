# Verification record

Verified locally on 2026-09-20. This file distinguishes implementation from actual runtime evidence.

| Area | Result and evidence |
|---|---|
| Strict TypeScript | `pnpm typecheck` passed. |
| Business rules | `pnpm test`: 6 tests passed, covering workflow, review history, required feedback, blockers, dependency cycles/incomplete dependencies, optimistic versions, roles/scope, and comment-to-task deduplication. |
| Node production build | `pnpm build` passed with Next.js 16.3.5. Standalone production server ran on port 3001 against a persistent SQLite directory. |
| Workers adapter build | `pnpm cf:build` passed with OpenNext 1.20.6. No framework substitution. |
| Foundation before UI | Both runtimes passed owner setup/sign-in, project/task write-read, protected PNG upload/retrieval and anonymous image rejection before substantial UI implementation. |
| REST + MCP, Node | 25 contract checks passed; [raw report](verification/node-contracts.json). |
| REST + MCP, Workers/D1/R2 | Same 25 contract checks passed in local workerd; [raw report](verification/workers-contracts.json). |
| Actual canvas dragging | Pointer drag changed stored coordinates, survived refresh, and did not accidentally open a screen panel; the clean demo layout was restored. [Report](verification/drag.json). |
| Atomic/concurrent writes | Two simultaneous updates at the same task version produced exactly one success and one 409 on each database implementation. Journey and screen decision stale-version checks also returned 409. |
| Restart persistence | An MCP-created task retained its In progress status and progress summary after restarting each runtime. [Node](verification/restart-3001.json), [Workers](verification/restart-8787.json). This is not a Docker restart test. |
| Fresh installation browser | Owner setup, project creation, manual invitation link, partner join at phone width, and partner permission state passed on an isolated production installation; no owner page/console errors. [Report](verification/onboarding.json). |
| Desktop browser | Chromium at 1440×1000: task creation/edit/progress, refresh persistence, completion, feedback/review, reopening controls; canvas arrange/undo/redo/connections and refresh; credential creation/test/secret dismissal/kit download; invitation link generation. |
| Phone browser | Chromium at 360×800 and 390×844: readable task list, full-screen details, pin/comment and screen decisions, owner quick creation, offline draft preservation and recovery, no page-level horizontal overflow. |
| Keyboard/reduced motion | Escape closes dialogs and returns focus to the task opener. Keyboard pin placement works. Reduced-motion phone scenario passed. Radix focus traps, semantic labels and visible focus are used. |
| End-to-end browser suite | `pnpm test:e2e`: 6/6 passed in the final combined run (38.6 seconds). Screenshots are generated under ignored `test-results/`; curated examples are copied below when retained. |
| Accessibility/contrast | axe-core WCAG 2 A/AA and 2.1 AA checks found no violations in backlog, journey list, canvas, mobile list, task panel, settings or screen review. Initial contrast failures were fixed and rerun. [View-scoped report](verification/accessibility.json). This is not a claim of universal accessibility or screen-reader user testing. |
| Upload privacy | Anonymous reads return 401; another project's AI credential receives 403; active SVG masquerading as PNG is rejected; raster bytes survive protected retrieval and export/import. |
| Portable export/import | Screens, versions, comments, pins, task links, journey positions and relationships round-trip; auth secrets/receipts are excluded; invalid file keys/paths are rejected. |
| Dependency audit | `pnpm audit --prod`: no known vulnerabilities reported at the time of verification. |
| Live Cloudflare | **Not deployed or verified live.** Configuration and instructions are prepared; local adapter runtime passed. |
| Docker | **Configuration prepared; container not run.** Docker CLI/daemon is absent here. Node persistence passed, but the requested container-volume restart check remains unverified. |

## Assistant workflow measurement

Measured with raw UTF-8 response body byte lengths and `performance.now()` around real HTTP calls. No tokenizer was used and no token counts are claimed. Calls: work context, bounded task creation, start progress, get full task, update progress, complete task, and change cursor retrieval. Conflict/retry/authorization probes are separate and excluded from this seven-call sample.

- Node/SQLite: **7 requests, 2,910 response bytes** in the recorded hardened run; individual local wall times approximately 1.6–3.9 ms.
- Local Workers/D1: **7 requests, 2,905 response bytes**; individual local wall times approximately 6.5–9.4 ms.
- Payloads vary with task content, actor names and concurrent winning updates. The sample uses a small new project, not a worst-case project at capacity.
- Responses contain no screenshot base64 except explicit project export. Full descriptions/comments are retrieved only when requested by API consumers.

## CPU and hosting evidence

Cloudflare currently documents a **10 ms/request CPU** allowance on Workers Free ([official limits](https://developers.cloudflare.com/workers/platform/limits/)). Wall time from local HTTP requests is not billed CPU. Local preview does not enforce the live account's CPU quota.

Five Better Auth default password-hash runs measured with Node `process.cpuUsage()` used approximately 68.9–74.5 ms each. A real local Workers sign-in was also sampled through the Wrangler/workerd V8 inspector at a 1 ms sampling interval; its profile classified roughly **216 ms as JavaScript samples**, with a 200 response. The profiler covers protocol overhead as well as the request and introduces measurement overhead; it is indicative local evidence, not production billing. [Raw profile summary](verification/workers-cpu.json).

These results are incompatible with a blanket claim that password authentication fits safely within Workers Free. The documentation retains Docker and recommends paid Workers CPU allowances for the Cloudflare target. Real deployment CPU, latency, storage, operations and charges must be verified on the account before promising operating cost.

## Remaining acceptance gaps

Docker container/volume restart and live Cloudflare deployment are the unverified infrastructure targets. Physical mobile devices, non-Chromium browsers and assistive-technology user testing were not run. Initial product capacity and integration boundaries are in [LIMITATIONS.md](LIMITATIONS.md).

## Retained synthetic demo screenshots

[Desktop backlog](verification/images/desktop.png) · [Mobile backlog](verification/images/mobile.png) · [Journey canvas](verification/images/canvas.png). These show a separate synthetic demo, not private user data.

## Username sign-in update — 2026-09-20

Both requested local accounts passed real Chromium sign-in and refresh against the production Node server: owner at 1280×900 and partner at 390×900, with no page errors. Existing project data was retained; passwords were replaced using Better Auth hashing and prior sessions invalidated. A separate fresh installation on port 3003 passed username-only setup, project creation, invitation creation, partner join and partner permission checks with no console/page errors (updated onboarding report). Strict typing, all six unit tests, standard Next.js production build, and OpenNext build passed. Migration 0002 applied successfully to local D1. This update was not deployed live.

## Partner canvas and version stacks — 2026-09-20

Seven unit tests passed, including recommendation ordering without chronology changes, AI rejection, invalid-version rejection and stale conflicts. Next.js and OpenNext production builds passed. On an isolated copy of the local workspace, Chromium verified Kai’s canvas landing, absence of Backlog navigation, protection from opening a task panel through an old backlog URL, stacked list/canvas cards, carousel selection, persistent recommendations, version-specific comments, unchanged journey edges, and HTTP 409 for stale recommendations. Tested at 1440×1000 and 390×844 with no page errors or phone page overflow. See [browser report](verification/version-stacks.json); run scripts/stack-check.mjs with TEST_URL, TEST_USERNAME and TEST_PASSWORD against an isolated multi-version fixture.

## Numbered pins, portrait screenshots, task deletion — 2026-09-20

`scripts/pin-check.mjs` passed against an isolated workspace: matching image/thread pin numbers, two-way keyboard focus and highlight, stable numbers with resolved threads hidden/shown, desktop and 390px phone, no page errors. `scripts/portrait-delete-check.mjs` passed: owner cancel and permanent deletion of a Done reviewed task, subsequent GET 404, stale DELETE 409, upload of an actual 360×640 PNG, exact 9:16 rendered preview on desktop/phone, canvas containment, no page overflow/errors. Test scripts use TEST_URL/TEST_USERNAME/TEST_PASSWORD and mutate disposable fixtures only. Eight domain tests passed; deletion tests cover all four statuses, owner-only authorization, optimistic version checks, dependency cleanup and deletion activity.

## Ideas — 2026-09-20

Ten unit tests passed, adding shared idea creation, whitespace/case tag deduplication, ownership rules, AI write rejection, stale-edit rejection and tag retention after deletion. `scripts/ideas-check.mjs` passed on an isolated database: Kai at 390px saved a tag, cancelled, refreshed and reused it; both Kai and owner created shared ideas with that same tag; filtering worked; unauthorized edits returned 403; no phone overflow or page errors. Desktop and phone screenshots were inspected. Test credentials are provided through environment variables. Ideas are project-scoped and stored in the existing version-checked aggregate; old project records need no migration.

## Partner navigation simplification — 2026-09-20

Production build passed. Real browser checks on localhost:3000 confirmed Kai has only User journey/Ideas in the desktop sidebar and Journey/Ideas at 390px. Direct ?page=reviews, settings or backlog renders User journey. Owner still has all five sections. Screen-level review permissions are unchanged; this navigation change does not make shared project data private between human members.

## Private projects, delegated permissions and MCP editing — 2026-09-20

Twelve domain tests passed. Standard Next.js and OpenNext builds passed. Migration 0003 applied to existing and fresh local D1 databases. The same `scripts/access-check.mjs` browser/REST/actual-stdio-MCP scenario passed against isolated Node/SQLite at port 3005 and Workers/D1/R2 at port 8788: owner creates a project-scoped partner from Settings UI; partner sees only assigned projects; unassigned snapshots and private screenshots return 403; partner cannot create projects/accounts/credentials or self-grant; permitted partner creates a task through mobile UI; replacing grants immediately denies the previously allowed project; read-only assignment hides editing controls; stale grant changes return 409; actual MCP update_task edits title/description/priority/status and add_task_comment succeeds; AI cross-project reads and human review fail. Phone-width check had no overflow, and browser recorded no page errors. Cloudflare remains locally tested, not deployed live.

Workers invitation verification also passed: owner-selected view-ideas access was retained on join, other projects were absent, task reads returned 403, and reuse of the consumed invitation returned 403.

## Backlog sorting and canvas actions — 2026-09-20

Strict typing, 12 domain tests, standard Next.js and OpenNext builds passed. `scripts/canvas-actions-check.mjs` passed against an isolated copy at port 3006: board priority order, edge click confirmation, cancel, deletion, undo, canvas context action and creation, double-click creation form, refreshed screen/connection persistence, and the confirmation at 390px. No browser page errors. Pointer events were synthesized as MouseEvents; physical Mac trackpad gestures were not tested. Run with TEST_URL, TEST_USERNAME and TEST_PASSWORD against disposable data only. Existing user project data was not modified by these tests. Local production server on port 3000 restarted with this build; no live Cloudflare deployment.

## Automatic journey playback — 2026-09-20

Strict typing, 12 domain tests and Node/OpenNext builds passed. `scripts/playback-check.mjs` used an isolated five-screen branched journey with real screenshots: browser clock verified 0.5× and 1.25×/0.75× timing, pause/resume, automatic forward traversal, indefinite branch wait, both destination choices, end-of-path status, restart, Escape dismissal, and 390px layout under reduced-motion preference. No page errors or phone overflow; phone screenshot inspected. The test edits disposable journey data only. Run with TEST_URL, TEST_USERNAME and TEST_PASSWORD. Playback uses four seconds per screen at 1×, pauses when the tab is hidden, and requires a choice before revisiting a loop. No live deployment performed.

## Canvas arrow routing — 2026-09-20

14 unit/domain tests passed, including path-segment checks against screen bounds for forward, reverse, skipped-screen and vertical connections, and separated return lanes. Strict typing and standard Next.js build passed. `scripts/edge-routing-check.mjs` passed on an isolated project: three screens with forward, last-to-first and shortcut connections, rendered labels, delete confirmation/cancel, reload persistence, desktop and 390px canvas. Both screenshots inspected and no page errors. The first visual pass found overlapping outer labels; increased lane spacing fixed the tested case. Routes are computed from saved positions without rewriting edges. Physically overlapping cards can still conceal their ports; separate those cards or use Arrange. No live deployment performed.

OpenNext Cloudflare adapter build also passed for this routing change; runtime deployment was not repeated because the change is confined to client rendering.

## FrameBacklog public guide and source release — 2026-09-20

14 tests, strict typing and Next.js production build passed. Unauthenticated Chromium verified the sign-in guide link, FrameBacklog name, environment instructions and no overflow at 390px; mobile screenshot inspected. The real `scripts/access-check.mjs` scenario passed again on isolated Node/SQLite: project grants, private files, immediate revocation, stale conflicts, actual stdio MCP title/description/status/comment updates, AI cross-project and human-review rejection. Release candidate file review found a generated local pnpm store, now excluded; databases, uploads, environments, and test browser artifacts remain ignored. Existing committed screenshots show synthetic demo data. Source publication does not deploy the application.
