# Implementation checklist

- [x] 1. Foundation: Next.js/OpenNext compatibility verified; Better Auth; SQLite/D1 adapters; protected uploads; both builds and local runtime slices passed before UI work.
- [x] 2. Design system: light shell, desktop/mobile navigation, Radix dialogs, purposeful reduced-motion-aware transitions, loading/error/empty/offline/permission states; explicit separate demo.
- [x] 3. Backlog: persistent board/list tasks, filters, shareable details, requirements/progress, dependencies, comments, activity, completion and concurrency rules.
- [x] 4. Journey: named journeys, placeholders/private raster uploads, immutable versions, persisted React Flow layout/connections, undo/redo, explicit Arrange, screen list/focused review, pins/replies/resolution and linked tasks.
- [x] 5. Human review: task/screen queues; owner-only Done reviewed; mandatory change feedback; historical reviews retained; AI human-review attempts rejected.
- [x] 6. API and MCP: versioned REST, generated OpenAPI, bounded deterministic context/pages/batches/cursors, idempotency, scoped credentials, connection test/kit, local stdio adapter verified through REST.
- [x] 7. Portability/hardening implemented: Docker configuration, D1/R2 bindings/migrations, versioned export/import, request/upload limits, private no-store responses, CSRF and authorization, backup/restore instructions.
- [x] 8. Local end-to-end verification/polish: strict typing, 6 domain tests, 25 API/MCP checks per backend, 6 desktop/phone browser scenarios, 7 audited views with no detected WCAG A/AA violations; measured request/payload/CPU evidence.
- [ ] Docker container execution and volume restart verification: Docker is not installed on this host. Configuration and exact validation instructions are provided.
- [ ] Live Cloudflare deployment and account quota/billing validation: no live deployment performed. Local Workers/D1/R2 preview passed.

## Key decisions

Repository started empty with no instructions. Framework versions were checked against published adapter peers: Next.js 16.3.5, React 19.3.0, OpenNext 1.20.6, Better Auth 1.7.5. Actual Node and Workers authentication/write/upload slices passed before substantial UI development.

Small project aggregates use one revision-checked atomic SQL update containing state, activity and idempotency results. Real concurrent requests proved this path on both SQLite and D1; no unsupported interactive D1 transactions are assumed. Capacity limits and coarse conflict behavior are explicit. Better Auth handles cryptography/sessions. No LLM dependency.

Browser verification found and fixed React Flow dimension/handle persistence, ambiguous form-label associations, focus restoration, actual secondary-text contrast, and development-toolbar interference with phone navigation. The tests respect authentication rate limits instead of disabling them.

Workers Free has a documented 10 ms CPU budget. Password hashing/sign-in exceeded that budget in indicative local measurements; no free-hosting guarantee is made. See [verification evidence](docs/VERIFICATION.md), [maintainer guide](docs/MAINTAINER.md), and [limitations](docs/LIMITATIONS.md).
