# Maintaining CustomBacklog

## Architecture

One real Next.js App Router application. The page/layout are Server Components; the interactive workspace, dialogs, backlog and review panels are focused client modules. Journey and React Flow load dynamically. Route handlers expose the shared service layer at `/api/v1`; MCP uses REST only. Hosting imports are confined to `src/lib/storage.ts` and `src/lib/local.ts` and never enter client code.

The initial edition intentionally uses **bounded project aggregates** in SQLite/D1, rather than an ORM transaction callback that D1 cannot execute. Each project row holds versioned tasks, dependencies, screens, immutable screenshot version metadata, comment threads/pins, review histories, journey nodes/edges, recent activity and idempotency receipts. Users, Better Auth sessions/accounts, installation lock, membership, invitations, API credentials and rate counters have separate indexed tables.

A mutation reads project revision N, validates authorization and domain rules, updates an in-memory copy, then performs one `UPDATE projects SET data=?, revision=revision+1 WHERE id=? AND revision=? RETURNING revision`. The content, review/activity event and idempotency receipt commit in the **same SQL statement**. A competing writer returns no row and becomes 409; no silent retry overwrites user work. SQLite uses WAL and a five-second busy timeout. D1 executes the same single atomic statement; no `BEGIN` or interactive transaction is assumed. Real simultaneous requests were tested on both backends.

Project aggregate tradeoffs: coarse conflicts even on different tasks, no full-text SQL indexing, and bounded capacity. Metadata maximum: 1.5 MB (below D1's 2 MB row limit). Tasks: 500/project; screenshots: 100 screens × up to 20 versions; journeys: 20, each up to 100 nodes/300 edges; screen comments: 1,000/project; task comments: 100/task. Retain latest 1,000 activity events and 24-hour idempotency receipts. Task/screen review histories persist separately from the truncated change feed. Owners can delete tasks in any status; the change feed emits a Task deleted event with the deleted ID. Dependency references are removed and affected task versions advance. Project deletion and archival are not included. Credentials can be revoked and partner access removed.

File storage uses UUID keys, private local files or a private R2 bucket. Uploads stream into a bounded buffer, validate raster signatures and size, and never invoke an image conversion service. Database and blob storage do not share a transaction: a failed metadata CAS can leave an unreferenced immutable blob; it is not exposed because retrieval requires a matching project/version record. Backups must include both. No object deletion is performed automatically.

## Versions and compatibility

Pinned/locked: Next.js 16.3.5, React 19.3.0, OpenNext 1.20.6, Better Auth 1.7.5, React Flow 12.11.6, Motion 13.4.0, Zod 4.6.5, Wrangler 4.135.0. The pnpm lockfile records all transitive versions. OpenNext's peer range accepts Next `>=16.3.3`; Next 16 support is documented at https://opennext.js.org/cloudflare. Better Auth 1.7 supports native D1 and Node SQLite. Local execution tested on Node 26.8.2; the Dockerfile selects Node 24.15.0, where `node:sqlite` is available. Docker execution still needs verification on a Docker host.

The Cloudflare build sets `CF_BUILD=1` and aliases the local Node adapter out of the bundle. Runtime `STORAGE_TARGET=cloudflare` selects D1/R2. Node uses DATA_DIR (default `.data`). Next uses webpack consistently in development and production; there is no framework substitution.

## Authentication and authorization

Better Auth supplies password hashing, sessions, secure cookie handling and origin protection. No bespoke password encryption/session cryptography. Application setup requires a separately configured installation token, atomically reserves the installation singleton, creates the first owner and closes setup. Invitation links contain 256-bit random bearer secrets; only SHA-256 hashes are stored, with a 24-hour expiry and atomic single-use reservation. Invitations are for partner accounts. Failed registration releases its reservation.

Only sign-in, sign-out and session lookup are exposed through the public Better Auth route. Registration must pass setup or invitation checks. The browser uses Better Auth’s username plugin. Usernames are case-insensitive, 3–40 letters/numbers/dots/underscores/hyphens; passwords have a minimum of 3 characters as requested for this installation. Setup and invitations accept usernames without requiring email; internal placeholder addresses satisfy Better Auth’s account schema. Legacy email API sign-in remains available for existing integrations. Existing accounts without usernames need a unique username assigned in the user table before using the username-only browser form. The instance uses seven-day sessions. HTTPS enables Secure cookies; matching APP_URL Origin is required for browser mutations. Deploy behind HTTPS; ensure proxy and APP_URL reflect the public origin. No password-reset email service, MFA, social login or email verification is included. Administrators must handle account recovery out of band; protect backups and installation access.

The single owner sees all projects and controls accounts/grants. Partners have explicit per-project action grants in partner_access. Authorization fails closed when no assignment exists. Task and screen human review may be delegated explicitly, while administration remains owner-only. Removing partner access invalidates sessions and further authorization checks reject the removed membership. Owners cannot remove their own account through the UI. AI secrets are random 256-bit tokens, hashed before storage, checked for expiry/revocation and project scope on every request. Permission options: read, tasks, comment, upload. Human reviews are separate routes and reject AI credentials.

Every private JSON/file response uses `Cache-Control: private, no-store`. Comments are rendered as React text, never HTML. Image retrieval checks the actor's project scope and the version-to-file relationship before opening storage. JSON requests max 64 KB, screenshots max 5 MB, import max 15 MB. Authenticated identities are limited to 120 requests/minute using atomic SQL counters. Registration has an installation-wide 10/minute limit and login routes 40/minute, plus Better Auth's maintained limiter. Internet-scale abuse protection remains a reverse proxy / Cloudflare operational concern.

## Local development and migrations

See the root README. Keep DATA_DIR outside the source tree for production and use an absolute path. Node startup applies the initial SQL migration and the additive username migration (0002), checking the schema under a write lock; `pnpm db:migrate` explicitly does the same. New migrations must be additive, versioned SQL files and wired into the local migration runner before releasing an upgrade. Back up before changes. D1 uses Wrangler migration tracking for both numbered SQL files. Apply pending migrations before deploying the username update.

There is no required LLM key. `NEXT_PUBLIC_APP_NAME` is the only public branding setting; rebuild after changing it. Never prefix credentials with NEXT_PUBLIC_. Credentials, .env files, databases, uploads and test browser session state are ignored by Git.

## Verification

- `pnpm typecheck`: strict TypeScript.
- `pnpm test`: domain rules (workflow, permissions, dependencies, review history, conflict checks).
- `node scripts/contracts.mjs`: real HTTP + stdio MCP against an isolated server. Configure TEST_URL, TEST_EMAIL, TEST_PASSWORD, SETUP_TOKEN. Creates test users, projects, images and credentials; never point it at real data.
- `pnpm test:e2e`: browser scenarios against a separate seeded demo. Configure TEST_URL and DEMO_PASSWORD. Tests desktop task creation/progress/review, canvas save/undo/redo, 360 px review with reduced motion, pins and image version history.
- `node scripts/accessibility.mjs`: rendered axe WCAG A/AA checks; adjust local demo settings in script if needed. It records the exact audited views, not a universal accessibility claim.
- `pnpm build` / `pnpm cf:build`: standard Next.js and adapter builds. Avoid running builds concurrently; they share `.next`.

See [VERIFICATION.md](VERIFICATION.md) for actual results, measurements and untested targets.

## Docker deployment

1. Install Docker Engine/Compose on your host.
2. Copy `.env.example` to `.env`; choose random BETTER_AUTH_SECRET/SETUP_TOKEN values and your exact HTTPS APP_URL.
3. Run `docker compose up --build -d`. The service binds host loopback:3000. Put a TLS reverse proxy in front for remote access.
4. Open the public URL and create the first owner. Copy the setup token privately; remove it from operational access once setup is complete (the installation remains closed regardless).
5. Keep the `backlog-data` named volume. It holds the SQLite database, WAL files, and uploads. `docker compose down` retains it; **never** use `down -v` unless intentionally deleting your installation.
6. Validate persistence: create an In progress task and an uploaded image, run `docker compose restart`, sign in again, and confirm both survive. This exact container restart test is provided as an operational check but was not run here because Docker is unavailable.

The runtime image runs as the non-root `node` user. Database migrations are copied with the standalone Next server. Resource sizing depends on workload; password hashing and Next execution have nonzero CPU/memory cost.

## Cloudflare deployment

Prepared and **locally tested**, not deployed live. Requires a Cloudflare account, a D1 database and R2 bucket. Recommend Workers Paid for password-authenticated usage (see hosting limits below).

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create custombacklog
pnpm exec wrangler r2 bucket create custombacklog-screenshots
```

Put your returned D1 ID in `wrangler.jsonc`, set bucket name and production APP_URL. Keep the bucket private. Set secrets interactively:

```sh
pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put SETUP_TOKEN
pnpm exec wrangler d1 migrations apply custombacklog --remote
pnpm cf:build
pnpm exec opennextjs-cloudflare deploy
```

For local emulation, create ignored `.dev.vars` with the two secrets, leave local APP_URL as `http://localhost:8787`, then:

```sh
pnpm cf:migrate
pnpm cf:build
pnpm cf:preview
```

The preview uses workerd, local D1 and local R2, not Node's storage adapter. Our foundation and full contract suites passed here. Live TLS, DNS, real account quotas, production D1 latency and R2 billing still require deployment-time verification. The build includes the Worker, assets and generated adapter configuration.

## Hosting costs and limits

Source checks dated 2026-09-20: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers/D1 pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

Workers Free currently allows 100,000 requests/day and 10 ms CPU per request. D1 Free allows 5 million rows read/day and 100,000 rows written/day. Every AI call reads the credential and project and writes last-used/rate counters; mutations additionally write the aggregate. These writes matter even when the UI is otherwise idle. Polling is only once per minute while visible and on focus.

The measured seven-call assistant workflow returned about 2.9 KB of JSON (full evidence in verification reports). Local D1 requests completed in roughly 6–10 ms wall time in that run; wall time is **not CPU time or a live free-tier guarantee**. Local workerd V8 sampling of password sign-in recorded about 216 ms of JavaScript sample time (1 ms sampling interval), and Node process CPU measurements for Better Auth's default hashing were about 69–75 ms. Both are far above 10 ms. Profiling adds overhead and is not Cloudflare's billed measurement; nevertheless, password authentication must not be advertised as safely within Workers Free. Use paid CPU allowances or the standard Docker path. R2 storage/operations and paid Workers remain account-dependent costs; no claim that the full app is free to host is made.

## Backup and restore

A **project export** is a portable, validated JSON envelope (`format=custombacklog-project`, `version=1`) with project relationships, reviews and screenshot bytes. Credentials, sessions, password hashes and idempotency receipts are excluded. File keys must be UUIDs; no filesystem paths or ZIP entries are accepted on import. Imports validate IDs, links, dependency cycles, version numbering, size/type limits, and create new UUID blob keys plus a new project. Current screenshot total limit is 10 MB; metadata limit is 1.5 MB. Export never replaces a full installation backup.

For Node/Docker full backup:

1. Stop writes by stopping the service (`docker compose stop` for Docker).
2. Copy the **entire data volume/directory**, including `backlog.sqlite`, any WAL/SHM files, and `uploads/`, to encrypted backup storage. Back up secrets separately with restricted access.
3. Start the service. Keep dated backups and test restoration periodically.
4. Restore into an empty data volume with the same application release and ownership (`node` user in Docker). Restore the original auth secret; start; verify login, In progress task state and private screenshot bytes. Do not mix a database snapshot with a different upload snapshot.

For Cloudflare, stop or restrict writes during a coordinated backup. Use D1 export/Time Travel as appropriate for your plan and independently copy all private R2 objects using authenticated R2/S3 tooling. Store the D1 export, R2 object set and secret configuration together in an encrypted backup. Restore into separate D1/R2 resources first, apply matching binding configuration, and verify before switching traffic. D1-only restore cannot restore R2 images. Live Cloudflare backup/restore was not executed here.

## Ideas

Optional `ideas` and `ideaTags` aggregate fields are backward compatible with existing installations and included in export/import. Humans can create ideas/tags; authors or owners edit/delete, enforced by shared services. Writes use the existing project compare-and-swap and activity mechanism; idea edits/deletes also require their current version. Creation requires an idempotency key. Limits: 500 ideas, 100 reusable tags, 12 tags per idea, 40 characters per tag, subject to the aggregate size cap. Tags deduplicate case-insensitively and persist independently of idea deletion.

## Project authorization upgrade

Migration 0003 creates partner_access (one versioned grants map per partner) and invitation_access. Existing partners receive the prior screen/idea reviewer permissions for projects that already exist when migrating; future projects are private. New accounts/invitations start with only the owner-selected grants. Old unconsumed invitation links have no project grants until assigned. Review assignments after upgrade. D1 must apply migration 0003 before deployment; Node applies it under a write lock.

Every authenticated partner request reads current grants. Project lists are filtered, project routes require membership, section reads require the corresponding view grant, and mutations enforce action grants. Snapshots redact ungranted sections and omit the broad activity feed; partner work-context/change-feed endpoints are unavailable to prevent cross-section leaks. Partners refresh through snapshots/task endpoints. File authorization requires both project access and screen viewing. Grant changes use version-checked SQL and take effect on the next request; open pages refresh on focus or within the existing polling interval. Already viewed data cannot be recalled from a person's browser.

Grant maps are capped at 100 project assignments per partner. Permission records and invitation grants are installation data included in full backups, excluded from portable project exports. AI credentials remain independent project-scoped service identities. MCP now exposes 12 tools, including update_task and add_task_comment, and continues to call only REST.
