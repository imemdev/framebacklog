# Local MCP adapter

Supported transport: **stdio**, launched as a local process. Supported authentication: a project-scoped REST bearer token supplied through the environment. No HTTP, SSE, OAuth or universal assistant compatibility is claimed.

Install the project dependencies, then configure your MCP client to launch:

```json
{
  "mcpServers": {
    "framebacklog": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/framebacklog", "mcp"],
      "env": {
        "CUSTOMBACKLOG_URL": "https://backlog.example.com",
        "CUSTOMBACKLOG_PROJECT": "project-uuid",
        "CUSTOMBACKLOG_TOKEN": "<resolve-from-your-private-environment>"
      }
    }
  }
}
```

Clients differ in environment-variable interpolation. The downloaded template uses environment variable names as placeholders; replace them using your client's supported secret mechanism. Do not commit a populated configuration. A local server must be reachable from the adapter process. Cloud-based assistants need their own compatible network connector.

Tools: get_work_context, list_tasks, get_task, create_tasks, update_progress, update_task, add_task_comment, complete_task, get_changes, get_screen_context, add_comment, upload_screen_version. The last tool reads a regular raster file from the **local adapter host**, at a path provided by the user/assistant; it never asks the web server to fetch arbitrary URLs. No human review tools are exposed. REST still rejects attempts made outside the tool list.

The contract suite starts this adapter as a real child process, discovers tools, creates a task, and saves In progress state. All business rules and permissions are enforced by the REST service. The adapter has no database access. Errors are returned as MCP tool errors with the API's actionable message.

`update_task` edits titles, descriptions, acceptance criteria, priorities, assignees, dependencies, linked screens and To do/In progress status. `complete_task` moves to Done with evidence. AI credentials cannot submit human reviews, delete tasks or manage partners. Human project grants are separate from AI credentials: create one credential per project in owner Settings → AI access.
