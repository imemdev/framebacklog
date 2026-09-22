# A shared workflow

## People and projects

Sign in with your username and password; no email address is required. The first owner chooses a username and password directly in the app. Setup closes after the first successful owner registration in every environment. Owners create projects and invite partners from Settings → People. Copy an invitation link manually; it expires in 24 hours and works once for the specified username. Only the owner sees every project. Partners see only assigned projects and can perform only their granted actions. AI credentials are project-scoped and have individually selected permissions.

## Tasks

Create a task with a title, then add requirements, acceptance criteria, priority, assignee, linked screens and dependencies in its detail panel. Board and list show the same records. Filters and selected task are reflected in the URL, so closing a detail panel preserves the backlog context and a task link can be shared with signed-in members.

Use In progress for unfinished work. Record progress, remaining work, a next step and any blocker reason. A blocker is a flag, not a separate workflow status. Dependencies cannot form cycles and must be completed before the dependent task can be Done.

The completion form requires what changed and a verification record. A check that was not run must say so and explain why. Done goes into the Reviews queue. An owner can mark Done reviewed or request changes with feedback. Requests for changes return work to In progress. Reopening reviewed work requires a reason and preserves previous reviews.

On desktop, drag cards between To do and In progress. Dropping into a completed status opens details so the required completion or review action can be performed. The detail form works with keyboard and touch without dragging. Mobile opens a task list by default and task details fill the screen.

## Journeys and screenshots

Create a named journey and add a screen with an optional first PNG, JPEG or WebP screenshot up to 5 MB. If you skip the file, Version 1 remains an editable placeholder. Open a screen to upload, replace, or remove the image for any version, or create a separate new version when you want to preserve an earlier image. Renaming and deleting a screen are available in Screen settings; deleting also removes its journey/task/comment links and private image files. No image processing service is required.

Screens view is the easiest review path on a phone. Next-screen links expose branching choices. Canvas offers pan, zoom, fit-to-view, a minimap toggle, connections, manual arrangement and alignment of selected nodes. Undo/redo covers the current session's layout and connection edits. Layout saves on drag end or a deliberate command, not on each pointer movement. A connection form and label editor avoid precise dragging.

If someone else saves first, your save reports a conflict. Fetch the latest state and compare before discarding your local layout or explicitly retrying it against the latest version. Unsaved edits are kept in the open page; there is no offline synchronization or recovery after closing the browser.

## Screen feedback

Open Add pin, tap the intended location, then write the comment. Keyboard users can place a pin at center and edit its horizontal/vertical percentages. Pins stay relative to the image. General comments, replies and resolved threads remain attached to their exact version.

Approve with an optional note, or request changes with an explanation. A new uploaded version always awaits its own review. Selecting an older version shows an explicit warning. Previous/next navigation follows the journey's connections.

An owner can choose Create task on a comment. The draft is prefilled, and the resulting task links to the original comment/version. Existing linked tasks are shown instead of another create action. Completing a task does not resolve the comment automatically.

## External assistants and data

Create an AI credential under Settings → AI access. Choose permissions, optionally set expiry, copy the secret once, test it and download the connection kit. Credentials show last use and can be revoked. Assistants work in their existing coding environment through REST or the local stdio MCP adapter.

Project export/import includes screenshot bytes, relationships and history, excluding authentication secrets. Imports create new projects. This is different from a full installation backup, which also includes members and authentication data; administrators should follow the maintainer backup instructions.

## Version stacks and recommendations

Partners open directly to the journey canvas; the default reviewer preset shows User journey and Ideas. Additional sections appear only when the owner grants their viewing permissions. Settings stays owner-only. Screen comments, recommendations and decisions remain available inside a screen. The Screens toggle offers a list when preferred. Each screen remains one journey node and connection target. Multiple uploaded versions appear as a stack. Open the stack and browse thumbnails or use Previous/Next version; comments and pins apply only to the selected version. The green Recommend this screen action saves a shared preferred version and brings it to the front of both list and canvas stacks. Recommendations are separate from approval; historical version numbers and review decisions stay unchanged. The latest human recommendation wins, with stale simultaneous choices rejected for refresh/retry.

## Pins, portrait screenshots, and deleting tasks

Pinned comments show numbered badges matching the screenshot markers. Click a marker to focus its thread, or its Pin badge to return to the image. Numbers include resolved threads, so hiding them does not renumber other pins. General comments are labeled separately.

Screenshot cards, canvas nodes and carousel thumbnails display the complete 9:16 portrait image without cropping or stretching. Other raster aspect ratios remain supported.

Owners can open any task, including Done reviewed, and choose Delete task. Confirm Delete permanently or Keep task. Deletion removes the task and its task discussion, clears incoming dependency references, and records an activity event. Screens and their comments remain. This action cannot be undone.

## Ideas and reusable tags

Open Ideas from desktop or mobile navigation. Both owners and partners can add ideas to the selected project, with a title, optional details and up to 12 tags. Marketing, Mobile app UI and Features are starter choices. Save tag immediately stores a new tag for everyone in the project, even if the idea form is later cancelled. Tags are deduplicated without case sensitivity and remain after ideas are deleted. Search ideas or filter by a tag. Authors can edit/delete their own ideas; owners can manage all ideas. Ideas and tags are included in project export/import.

## Partners and private projects

As owner, open Settings → People → Create partner. Enter a username and initial password, or choose an invitation so the partner picks their own password. Select one or several projects, then choose permitted actions. All project actions, Screen reviewer and View only presets are available; each checkbox can be adjusted. Manage access changes or removes assignments later. Projects you have not selected are private to that partner; newly created projects are never shared automatically.

Available grants: view backlog; create/edit tasks and move unfinished work/complete with evidence; delete tasks; human task review/reopening; view screenshots/journeys/discussions; comment/reply/resolve; recommend/approve/request screen changes; add/rename/delete screens and manage their images; edit journey layouts/connections; view ideas; add ideas/tags and manage own ideas; manage all ideas. Editing grants automatically include necessary viewing grants. Project creation, accounts, permissions, credentials, export/import and installation settings stay owner-only.

For AI assistants use Settings → AI access for the selected project, rather than giving the assistant a human password. The stdio MCP adapter supports task creation, editing, progress, completion, comments and context retrieval. Give it the selected project's URL, ID and bearer token. AI credentials never grant human review or account administration.

### Play through a journey

Choose **Run journey** in User journey (Canvas or Screens). Playback shows each screen's recommended version, or newest version if none is recommended, for one second at 1× speed. Select 0.5×, 0.75×, 1×, or 1.25×; Pause/Resume and Restart are always nearby. At a branch, playback waits for you to choose a route by its label and destination screen, then continues automatically. Multiple starting screens prompt a choice. Repeated loops require an explicit choice and end screens stop playback. Closing the player stops its timer; hiding the browser tab pauses playback. Playback does not change saved layouts or review decisions, and uses the journey snapshot from when you opened it.
