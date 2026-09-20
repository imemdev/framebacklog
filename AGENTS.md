<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## CustomBacklog maintenance

Read docs/MAINTAINER.md before changing storage/authentication. Preserve Next.js compatibility and both Node and OpenNext builds. Keep domain authorization on the server and the MCP adapter REST-only. Never put demo data into real installations or commit .env files, API secrets, databases, private screenshots, or browser auth state. Run strict typing and the tests relevant to changes. Update IMPLEMENTATION.md and docs/VERIFICATION.md with actual evidence; never imply live deployment or a Docker run without executing it.
