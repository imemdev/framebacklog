# Initial-release boundaries

Implemented functionality is persistent and uses the same server rules for UI, REST and MCP. The following boundaries are intentional and visible:

- One shared workspace. All human members see every project; there are no per-project human memberships. Service credentials are project-scoped.
- Aggregate persistence is designed for small teams: 500 tasks/project; 100 screens/project; 20 versions/screen; 20 journeys; 100 nodes/300 edges per journey; 1,000 screen comments/project; 100 task comments/task; 1.5 MB metadata. A project at capacity must be exported/split. There is no deletion/archival UI yet.
- Latest 1,000 activity events and 24-hour idempotency receipts are retained. Task/screen review histories remain on their records. Large installations should migrate to normalized entity rows before raising limits.
- Layout conflicts are project-wide at the commit boundary, with item versions for task/journey edits. Undo/redo is local to the open canvas session. Explicit Arrange uses a simple grid, not graph optimization. Zoom/minimap preferences are session-local.
- Failed blob metadata saves can leave private orphaned uploads. They are never reachable through project routes. Automatic garbage collection is not implemented.
- Raster signatures and 5 MB upload limits are checked. Images are not recompressed or decoded on the server. Browser-side compression is not implemented; resize large images before uploading.
- Import/export is versioned JSON, not a ZIP archive. It caps screenshot totals at 10 MB and archive request size at 15 MB. Larger projects require full installation backup.
- Password authentication has no email verification, forgot-password delivery, MFA or OAuth. Invitations are partner-only, one-use, 24-hour links. Owners can remove partner access; owner-role transfer needs administrator intervention.
- Browser refresh on focus and at most once/minute while visible. No real-time collaboration, live cursors or full offline sync. Unsaved drafts stay only in the current page, so keep it open when a save fails.
- MCP is local stdio with REST bearer authentication. No remote MCP/SSE/OAuth transport or universal assistant compatibility.
- Live Cloudflare deployment, live quota enforcement and billing are not verified. Free Workers' 10 ms CPU budget is unsuitable as a guarantee for this password-authenticated Next app. Docker configuration is prepared; the Docker container restart test could not be run because Docker is not installed on the build host.
- Browser automation covers Chromium desktop and phone viewports, not physical mobile devices, Safari/Firefox, screen-reader user testing, or all possible data/layout states.
- No LLM key, embedded chatbot, hosted coding agent, billing, analytics dashboard or dark theme is included.
