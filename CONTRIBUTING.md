# Contributing to FrameBacklog

Read README.md for local setup and docs/MAINTAINER.md for architecture and migrations. Use a separate demo workspace; never test destructive flows against real project data.

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` before submitting a pull request. Changes involving runtime imports, storage, or deployment should also pass `pnpm cf:build`. Browser scripts under scripts/ describe which disposable fixtures and environment variables they require.

Keep authorization in shared server rules, MCP REST-only, screenshots private, and AI credentials restricted to one project. Preserve Node/SQLite and Workers/D1/R2 support. Describe the behavior change and actual verification in your pull request. Update the public guide for connection changes and the agent quick-start for API workflow changes.

Never include .env files, real API keys, session state, database files, private screenshots, or project exports in an issue or pull request. Synthetic examples are welcome. The project is MIT licensed.
