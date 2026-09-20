# A shared workflow

## People and projects

The first owner creates the installation with the private setup token. Owners create projects and invite partners from Settings → People. Copy an invitation link manually; it expires in 24 hours and works once for the specified email. All human members share this installation's workspace and can view its projects. Partners review screens and discuss feedback; owners manage implementation and final task review. AI credentials are project-scoped and have individually selected permissions.

## Tasks

Create a task with a title, then add requirements, acceptance criteria, priority, assignee, linked screens and dependencies in its detail panel. Board and list show the same records. Filters and selected task are reflected in the URL, so closing a detail panel preserves the backlog context and a task link can be shared with signed-in members.

Use In progress for unfinished work. Record progress, remaining work, a next step and any blocker reason. A blocker is a flag, not a separate workflow status. Dependencies cannot form cycles and must be completed before the dependent task can be Done.

The completion form requires what changed and a verification record. A check that was not run must say so and explain why. Done goes into the Reviews queue. An owner can mark Done reviewed or request changes with feedback. Requests for changes return work to In progress. Reopening reviewed work requires a reason and preserves previous reviews.

On desktop, drag cards between To do and In progress. Dropping into a completed status opens details so the required completion or review action can be performed. The detail form works with keyboard and touch without dragging. Mobile opens a task list by default and task details fill the screen.

## Journeys and screenshots

Create a named journey and add placeholder screens. Open a screen to upload PNG, JPEG or WebP, up to 5 MB. The first upload replaces the placeholder with a new immutable version; older versions remain accessible. No image processing service is required.

Screens view is the easiest review path on a phone. Next-screen links expose branching choices. Canvas offers pan, zoom, fit-to-view, a minimap toggle, connections, manual arrangement and alignment of selected nodes. Undo/redo covers the current session's layout and connection edits. Layout saves on drag end or a deliberate command, not on each pointer movement. A connection form and label editor avoid precise dragging.

If someone else saves first, your save reports a conflict. Fetch the latest state and compare before discarding your local layout or explicitly retrying it against the latest version. Unsaved edits are kept in the open page; there is no offline synchronization or recovery after closing the browser.

## Screen feedback

Open Add pin, tap the intended location, then write the comment. Keyboard users can place a pin at center and edit its horizontal/vertical percentages. Pins stay relative to the image. General comments, replies and resolved threads remain attached to their exact version.

Approve with an optional note, or request changes with an explanation. A new uploaded version always awaits its own review. Selecting an older version shows an explicit warning. Previous/next navigation follows the journey's connections.

An owner can choose Create task on a comment. The draft is prefilled, and the resulting task links to the original comment/version. Existing linked tasks are shown instead of another create action. Completing a task does not resolve the comment automatically.

## External assistants and data

Create an AI credential under Settings → AI access. Choose permissions, optionally set expiry, copy the secret once, test it and download the connection kit. Credentials show last use and can be revoked. Assistants work in their existing coding environment through REST or the local stdio MCP adapter.

Project export/import includes screenshot bytes, relationships and history, excluding authentication secrets. Imports create new projects. This is different from a full installation backup, which also includes members and authentication data; administrators should follow the maintainer backup instructions.
