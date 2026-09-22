# Implementation checklist

- [x] 1. Foundation: Next.js/OpenNext compatibility verified; Better Auth; SQLite/D1 adapters; protected uploads; both builds and local runtime slices passed before UI work.
- [x] 2. Design system: light shell, desktop/mobile navigation, Radix dialogs, purposeful reduced-motion-aware transitions, loading/error/empty/offline/permission states; explicit separate demo.
- [x] 3. Backlog: persistent board/list tasks, filters, shareable details, requirements/progress, dependencies, comments, activity, completion and concurrency rules.
- [x] 4. Journey: named journeys, private raster uploads, editable Version 1 placeholders, version stacks, persisted React Flow layout/connections, undo/redo, explicit Arrange, screen list/focused review, pins/replies/resolution and linked tasks.
- [x] 5. Human review: task/screen queues; owner-only Done reviewed; mandatory change feedback; historical reviews retained; AI human-review attempts rejected.
- [x] 6. API and MCP: versioned REST, generated OpenAPI, bounded deterministic context/pages/batches/cursors, idempotency, scoped credentials, connection test/kit, local stdio adapter verified through REST.
- [x] 7. Portability/hardening implemented: Docker configuration, D1/R2 bindings/migrations, versioned export/import, request/upload limits, private no-store responses, CSRF and authorization, backup/restore instructions.
- [x] 8. Local end-to-end verification/polish: strict typing, 6 domain tests, 25 API/MCP checks per backend, 6 desktop/phone browser scenarios, 7 audited views with no detected WCAG A/AA violations; measured request/payload/CPU evidence.
- [ ] Docker container execution and volume restart verification: Docker is not installed on this host. Configuration and exact validation instructions are provided.
- [x] Live Cloudflare deployment: version `3070ad42-78f4-4849-9257-72daeedda75b` is serving `https://custombacklog.medimemhamdi18.workers.dev`; root and OpenAPI read-only smoke checks returned HTTP 200. Account quota/billing validation remains outstanding.
- [x] Local development launcher: loads `.env.local` for SQLite migration, starts the Next.js dev server, opens the app when ready, and cleans up its owned process tree on exit. Isolated startup/shutdown evidence is in [verification](docs/VERIFICATION.md).
- [x] Owner onboarding accepts a username and password directly in every environment. The first successful registration atomically closes setup; the dev server continues to bind to loopback.
- [x] Optional private local-owner credentials are applied by the launcher before startup. Existing owner identity and projects are retained; unchanged credentials preserve sessions. Eight isolated provisioning tests and real owner sign-in passed.

## Key decisions

Repository started empty with no instructions. Framework versions were checked against published adapter peers: Next.js 16.3.5, React 19.3.0, OpenNext 1.20.6, Better Auth 1.7.5. Actual Node and Workers authentication/write/upload slices passed before substantial UI development.

Small project aggregates use one revision-checked atomic SQL update containing state, activity and idempotency results. Real concurrent requests proved this path on both SQLite and D1; no unsupported interactive D1 transactions are assumed. Capacity limits and coarse conflict behavior are explicit. Better Auth handles cryptography/sessions. No LLM dependency.

Browser verification found and fixed React Flow dimension/handle persistence, ambiguous form-label associations, focus restoration, actual secondary-text contrast, and development-toolbar interference with phone navigation. The tests respect authentication rate limits instead of disabling them.

Workers Free has a documented 10 ms CPU budget. Password hashing/sign-in exceeded that budget in indicative local measurements; no free-hosting guarantee is made. See [verification evidence](docs/VERIFICATION.md), [maintainer guide](docs/MAINTAINER.md), and [limitations](docs/LIMITATIONS.md).

## Username sign-in update

- [x] Replace browser email sign-in with Better Auth username sign-in; simplify owner setup and partner invitations.
- [x] Add SQLite/D1 username columns and unique index without replacing workspace data.
- [x] Update the two requested local accounts and verify owner/partner sign-in and refresh at desktop/phone widths.
- [x] Verify fresh username-based setup, project creation, partner invitation/join, and partner permissions.

## Partner canvas and screen stacks

- [x] Partner canvas landing, backlog/task-detail navigation hidden, screen-only review inbox.
- [x] Layered version stacks in canvas and screen list; thumbnail carousel with previous/next controls and version-specific discussion.
- [x] Human-only persistent recommendations, green action, preferred version shown first, optimistic conflicts and activity records.
- [x] Export/import retains and validates recommendations. Seven unit tests, both builds, desktop/phone browser flow passed.

## Screen image and screen CRUD

- [x] Add screen accepts an optional first screenshot, so an uploaded screen starts with an image on Version 1 instead of an empty Version 2.
- [x] Existing versions expose upload, replace, and remove image actions with an optimistic image revision and the existing upload permission.
- [x] Screen title rename and screen deletion are available in the screen panel; deletion removes journey nodes/edges, task/comment references, and private image objects after the aggregate write succeeds.
- [x] Focused Node/SQLite API and Chromium checks covered multipart Version 1 creation, placeholder add/replace/remove, rename/delete cleanup, protected image retrieval, and partner-safe server authorization.

## Pinned feedback, portrait screens, and task cleanup

- [x] Matching stable pin numbers on images and discussion threads, two-way focus/highlight, distinct general comments.
- [x] Full 9:16 image containment in cards/canvas/carousel and responsive preview; no upload aspect-ratio rejection.
- [x] Owner-only version-checked task deletion in every status, confirmation/cancel, dependency cleanup, deletion change events.
- [x] Eight domain tests and production build passed; browser verified pins/resolution, reviewed-task deletion, and a real 360×640 PNG upload at desktop/phone widths.

## Shared ideas

- [x] Ideas navigation for owner and partner; shared project ideas, search, tag filters, edit/delete controls.
- [x] Immediately saved reusable tags, starter categories, normalized duplicate prevention.
- [x] Shared domain authorization, version conflicts, idempotent creation, activity and export/import.
- [x] Ten unit tests and desktop/phone browser checks passed, including tags surviving cancelled forms and reuse by both accounts.

- [x] Partner navigation now contains only User journey and Ideas; direct Backlog/Reviews/Settings links display the journey. Owner navigation and server permissions are unchanged.

## Private projects and delegated partners

- [x] Versioned per-project action grants, migration, owner-only partner creation/invitations and grant management.
- [x] Project lists/private files filtered on server; snapshots redact ungranted sections; changes cannot be self-granted.
- [x] Permission-aware partner navigation and editing controls; single owner retains administrative actions.
- [x] MCP update_task and add_task_comment verified using the actual stdio client.
- [x] Local browser/API tests cover scope, forbidden data/files, grant updates/revocation, readonly UI, conflict and AI restrictions.

## Backlog order and canvas shortcuts

- [x] All backlog columns and the list sort Urgent → High → Medium → Low, retaining equal-priority order.
- [x] Canvas right-click/Control-click offers Create screen here; double-click empty space opens creation with persisted canvas coordinates.
- [x] Clicking a connection or its removal button opens confirmation; cancel, save, and undo supported.
- [x] Strict typing, 12 domain tests, Node/OpenNext builds and isolated desktop/phone interaction checks passed.

## Automatic journey playback

- [x] Run journey from canvas or screen-list toolbar; focused responsive player uses the recommended screen version.
- [x] Automatic directed traversal, explicit branch/start choices, pause/resume/restart and 0.5×/0.75×/1×/1.25× speeds.
- [x] Normal 1× playback is one second per screen; the visible status uses the same timing calculation.
- [x] End-of-path feedback, explicit loop continuation, background-tab pause and timer cleanup on close.
- [x] Browser verification of timings, both branch choices, pause/resume, end/restart, phone and reduced-motion mode.

## Readable canvas connections

- [x] Rounded orthogonal routing around screen bounds for forward, return, skipped-screen and cross-row links.
- [x] Distinct outer lanes, bordered labels, clearer arrowheads and 28px interaction paths.
- [x] More initial canvas padding; existing connections and confirmation/undo workflow retained.
- [x] Connection creation shows an explicit From → To preview, explains that the arrow points to the destination, and offers a one-click direction swap for existing or new connections.
- [x] 14 tests pass; isolated browser verified return/shortcut routes, click confirmation, refresh, desktop and phone screenshots.

## Public guide and open-source publication

- [x] FrameBacklog display name with NEXT_PUBLIC_APP_NAME override; integration/storage identifiers retained for compatibility.
- [x] Public /guide linked from sign-in: project credentials, local stdio MCP, sharing, remote connectivity and workflow rules.
- [x] README project-permission correction, contribution/security guidance, MIT license and local data/store exclusions.
- [x] 14 tests and real MCP/project-isolation regression passed; unauthenticated guide verified at desktop/phone widths.

- [x] Minimap enabled by default in the top-right corner; hide/show checkbox retained.
- [x] Source publication checks passed: strict typing, 14 tests, formatting, Node production build and OpenNext build. Applied Prettier to the existing journey-player/public-guide CSS without changing declarations; reviewed tracked files and both existing commits for publication-sensitive material.
