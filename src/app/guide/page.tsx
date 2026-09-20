import Link from "next/link";
const brand = process.env.NEXT_PUBLIC_APP_NAME || "FrameBacklog";
export default function GuidePage() {
  return (
    <main className="public-guide">
      <nav>
        <Link href="/">← Sign in</Link>
        <a href="https://github.com/imemdev/framebacklog">Source on GitHub</a>
      </nav>
      <header>
        <p className="eyebrow">PEOPLE + THEIR CODING ASSISTANTS</p>
        <h1>Use {brand} with your AI</h1>
        <p>
          Plan work, review screens, and let your existing coding assistant
          update the backlog. No embedded chatbot or AI subscription is required
          by this app.
        </p>
      </header>
      <section>
        <h2>1. Get access to a project</h2>
        <p>
          The installation owner creates projects and partner accounts, then
          chooses which projects and actions each person can access. Ask the
          owner for an account or invitation. Reading this guide does not give
          access to private workspace data.
        </p>
      </section>
      <section>
        <h2>2. Create a separate key for your assistant</h2>
        <p>
          As the owner, select the project, open{" "}
          <strong>Settings → AI access</strong>, and create a named credential.
          Choose only the permissions it needs: read context, edit tasks, add
          comments, or upload screens. Set an expiry when appropriate.
        </p>
        <p>
          Copy the secret once, test the connection, and download the connection
          kit. Share the secret privately with its intended operator. Each key
          belongs to exactly one project; create separate keys for other
          projects and for different assistants so they can be revoked
          independently.
        </p>
      </section>
      <section>
        <h2>3. Connect through MCP</h2>
        <p>
          The included MCP adapter runs as a{" "}
          <strong>local stdio process</strong>. It calls the server’s REST API
          using your project key. Install Node and pnpm following the repository
          README, clone the repository, and run{" "}
          <code>pnpm install --frozen-lockfile</code>.
        </p>
        <p>
          Configure your MCP-capable client to launch{" "}
          <code>pnpm --dir /absolute/path/to/framebacklog mcp</code> with these
          environment variables:
        </p>
        <pre>{`CUSTOMBACKLOG_URL=https://your-server.example.com
CUSTOMBACKLOG_PROJECT=your-project-id
CUSTOMBACKLOG_TOKEN=your-private-project-key`}</pre>
        <p>
          These environment variable names remain unchanged for compatibility.
          The downloaded kit includes a configuration template; clients differ
          in how they inject secrets. Use your client’s private environment or
          secret settings, and never commit a populated configuration.
        </p>
        <p>
          <a href="https://github.com/imemdev/framebacklog/blob/main/mcp/README.md">
            MCP configuration and supported tools →
          </a>
        </p>
      </section>
      <section>
        <h2>4. Give the assistant a task</h2>
        <blockquote>
          Connect to my assigned project. Get the work context, read the
          relevant task requirements, and start the task. Keep it In progress
          while unfinished. Save progress, remaining work, and the next step.
          Mark Done only with a completion summary and an honest verification
          record.
        </blockquote>
        <p>
          The tools can create tasks, edit titles and descriptions, change
          priority, save progress, add comments, and mark completed work Done.
          Only an authorized human can mark Done reviewed. AI keys cannot manage
          accounts, grant permissions, delete tasks, or approve screens.
        </p>
        <p>
          <a href="https://github.com/imemdev/framebacklog/blob/main/docs/AGENT_QUICKSTART.md">
            Short agent guide
          </a>{" "}
          · <a href="/api/openapi">Full OpenAPI specification</a>
        </p>
      </section>
      <section>
        <h2>Let other people use it</h2>
        <p>
          You can invite people into your hosted installation, or they can clone
          the MIT-licensed repository and host their own installation.
          Publishing source on GitHub does not publish a running server or your
          local data. Use the Docker or Cloudflare deployment instructions in
          the README.
        </p>
        <p>
          A server at localhost is accessible only on that computer. Other
          people and remote assistants need a reachable server and appropriate
          credentials. Cloud-only assistants also need a compatible connector or
          a place to run the stdio adapter; an API key alone does not add
          network access. HTTP/SSE MCP hosting and OAuth are not included.
        </p>
      </section>
      <section>
        <h2>Why one project per AI key?</h2>
        <p>
          The server rejects requests to any other project, even if an assistant
          changes the project ID in its request. This limits accidental edits
          and unnecessary context. It does not prevent mistakes inside the
          allowed project: grant only needed permissions, keep human review, and
          revoke a key when work ends.
        </p>
      </section>
    </main>
  );
}
