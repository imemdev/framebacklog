# CustomBacklog

A small, open-source workspace for developers, nontechnical reviewers, and external coding assistants. Persistent task planning, a visual screen journey, versioned screen feedback, and human review—all without an embedded chatbot or LLM subscription.

**Initial release:** working Node/SQLite and locally verified Cloudflare Workers/D1/R2 application. Cloudflare live deployment and Docker container execution are not verified in this environment. See [verification](docs/VERIFICATION.md) and [limitations](docs/LIMITATIONS.md).

## Start locally

Use Node 24.15+ (Node 26.8.2 used for local verification) and pnpm 11.19.0.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Set `BETTER_AUTH_SECRET` and `SETUP_TOKEN` to different randomly generated values of at least 32 characters. Generate each with `openssl rand -hex 32`. Keep `.env.local` private. Set `APP_URL` to the exact browser origin.

```sh
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000. Create the owner using your installation setup token. Setup closes after the first owner. Create a project; invite a partner under **Settings → People**. A partner can see all projects in this single workspace; AI tokens see only their assigned project.

For a production Node run, set the environment variables and use `pnpm build && pnpm start` (the start script prepares and launches the standalone output). The equivalent manual procedure is:

```sh
pnpm build
cp -R .next/static .next/standalone/.next/static
cp -R public migrations .next/standalone/
# Set APP_URL, BETTER_AUTH_SECRET, SETUP_TOKEN and an absolute DATA_DIR in the environment.
cd .next/standalone
node server.js
```

## Separate demo

The demo seed refuses to run unless `DATA_DIR` contains `demo`, and refuses to modify an initialized installation. It creates six raster example screens, a branching journey, all task states, a blocked task, comments and version-specific reviews. Demo completion records explicitly say they are examples.

```sh
pnpm exec playwright install chromium
DATA_DIR=.data/demo DEMO_PASSWORD='<choose-12-or-more-characters>' \
BETTER_AUTH_SECRET='<your-random-demo-session-secret>' pnpm demo
DATA_DIR=.data/demo BETTER_AUTH_SECRET='<same-demo-session-secret>' pnpm dev
```

Sign in as `owner@demo.local` or `partner@demo.local` using your chosen demo password. Never seed demo data into a real workspace.

## Use an external assistant

Under **Settings → AI access**, create a named project-scoped token, copy its secret once, and download the secret-free connection kit. Test connection before leaving the secret screen.

- [Agent quick-start](docs/AGENT_QUICKSTART.md): small consumer guide; no codebase inspection required.
- [People guide](docs/USER_GUIDE.md): backlog, review, journeys, and invitations.
- Live OpenAPI: `/api/openapi`. Shared Zod request schemas feed the specification.
- [MCP stdio adapter](mcp/README.md): local process using REST bearer authentication.
- [Maintainer guide](docs/MAINTAINER.md): architecture, migrations, deployment, backups, and tests.

## Verify

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm cf:build
```

Run `pnpm test:e2e` against a separately seeded demo at `TEST_URL` (default localhost:3000), with `DEMO_PASSWORD` set. Tests intentionally create tasks and screen versions. `node scripts/contracts.mjs` exercises REST and MCP against an isolated server at `TEST_URL` (default localhost:3001). Configure `TEST_EMAIL`, `TEST_PASSWORD`, and `SETUP_TOKEN`; it creates the first owner only when setup is open. Do not run mutation suites against a real workspace.

The working name is configured with `NEXT_PUBLIC_APP_NAME` at build time. MIT licensed. No required paid identity, email, AI, queue, or real-time service.
