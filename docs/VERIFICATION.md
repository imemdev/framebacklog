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
