import { chromium, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const base = process.env.TEST_URL || "http://localhost:3005";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base);
await page
  .getByLabel("Username", { exact: true })
  .fill(process.env.OWNER_USERNAME);
await page
  .getByLabel("Password", { exact: true })
  .fill(process.env.OWNER_PASSWORD);
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await expect(
  page.getByRole("button", { name: "Settings", exact: true }),
).toBeVisible();
async function req(
  context,
  path,
  method = "GET",
  data,
  expected = 200,
  headers = {},
) {
  const r = await context.fetch(`${base}/api/v1/${path}`, {
    method,
    headers: { Origin: base, ...headers },
    ...(data ? { data } : {}),
  });
  if (r.status() !== expected)
    throw new Error(`${method} ${path}: ${r.status()} ${await r.text()}`);
  return r.json();
}
const suffix = Date.now();
const alpha = await req(
  page.request,
  "projects",
  "POST",
  { name: `Alpha ${suffix}`, prefix: "ALP" },
  201,
);
const beta = await req(
  page.request,
  "projects",
  "POST",
  { name: `Beta ${suffix}`, prefix: "BET" },
  201,
);
const existing = await req(page.request, "projects");
const old = existing.find((p) => p.id !== alpha.id && p.id !== beta.id);
const oldSnapshot = await req(page.request, `projects/${old.id}/snapshot`);
const file = oldSnapshot.screens
  .flatMap((s) => s.versions)
  .find((v) => v.key)?.key;
await page.getByRole("button", { name: "Settings", exact: true }).click();
await page.getByRole("button", { name: "People", exact: true }).click();
await page.getByRole("button", { name: "Create partner", exact: true }).click();
const username = `partner${suffix}`;
const password = process.env.PARTNER_PASSWORD;
await page.getByLabel("Partner username", { exact: true }).fill(username);
await page.getByLabel("Initial password", { exact: true }).fill(password);
const alphaSection = page
  .locator(".partner-project")
  .filter({ hasText: `Alpha ${suffix}` });
await alphaSection
  .getByRole("checkbox", { name: `Alpha ${suffix}`, exact: true })
  .check();
await alphaSection
  .getByRole("button", { name: "All project actions", exact: true })
  .click();
await page
  .getByRole("dialog")
  .getByRole("button", { name: "Create partner", exact: true })
  .click();
await expect(page.getByRole("dialog")).toHaveCount(0);
const people = await req(page.request, "partners");
const partner = people.find((p) => p.username === username);
expect(partner.grants[alpha.id]).toContain("tasks");
expect(partner.grants[beta.id]).toBeUndefined();
const pp = await b.newPage({ viewport: { width: 390, height: 844 } });
pp.on("pageerror", (e) => errors.push(e.message));
await pp.goto(base);
await pp.getByLabel("Username", { exact: true }).fill(username);
await pp.getByLabel("Password", { exact: true }).fill(password);
await pp.getByRole("button", { name: "Sign in", exact: true }).click();
await expect(
  pp.getByRole("heading", { name: /User journey|Backlog/ }),
).toBeVisible();
expect((await req(pp.request, "projects")).map((p) => p.id)).toEqual([
  alpha.id,
]);
await req(pp.request, `projects/${beta.id}/snapshot`, "GET", undefined, 403);
if (file)
  await req(
    pp.request,
    `projects/${old.id}/files/${file}`,
    "GET",
    undefined,
    403,
  );
await req(
  pp.request,
  "projects",
  "POST",
  { name: "Forbidden", prefix: "NO" },
  403,
);
await req(
  pp.request,
  "partners",
  "POST",
  { username: "escalation", password, grants: {} },
  403,
);
await req(
  pp.request,
  `partners/${partner.id}`,
  "PATCH",
  { version: 1, grants: { [beta.id]: ["tasks"] } },
  403,
);
await req(
  pp.request,
  `projects/${alpha.id}/credentials`,
  "POST",
  { name: "Forbidden", permissions: ["read"] },
  403,
);
await pp
  .getByRole("button", { name: "Backlog", exact: true })
  .filter({ visible: true })
  .click();
await pp.getByRole("button", { name: "New task", exact: true }).click();
await pp
  .getByLabel("Task title", { exact: true })
  .fill("Partner implementation");
await pp.getByRole("button", { name: "Create task", exact: true }).click();
await expect(pp.getByRole("dialog")).toHaveCount(0);
let tasks = await req(pp.request, `projects/${alpha.id}/tasks`);
let task = (tasks.items || tasks)[0];
expect(task.title).toBe("Partner implementation");
await req(page.request, `partners/${partner.id}`, "PATCH", {
  version: partner.version,
  grants: { [beta.id]: ["view-backlog"] },
});
await req(pp.request, `projects/${alpha.id}/tasks`, "GET", undefined, 403);
expect((await req(pp.request, "projects")).map((p) => p.id)).toEqual([beta.id]);
await req(
  pp.request,
  `projects/${beta.id}/tasks`,
  "POST",
  { tasks: [{ title: "Forbidden" }] },
  403,
  { "Idempotency-Key": crypto.randomUUID() },
);
const filtered = await req(pp.request, `projects/${beta.id}/snapshot`);
expect(filtered.screens).toEqual([]);
expect(filtered.comments).toEqual([]);
expect(filtered.activity).toEqual([]);
await pp.reload();
await expect(pp.getByRole("heading", { name: /Backlog/ })).toBeVisible();
await expect(
  pp.getByRole("button", { name: "New task", exact: true }),
).toHaveCount(0);
await expect(
  pp.getByRole("button", { name: "Journey", exact: true }),
).toHaveCount(0);
expect(
  await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
).toBe(true);
const stale = await req(
  page.request,
  `partners/${partner.id}`,
  "PATCH",
  { version: partner.version, grants: {} },
  409,
);
const ai = await req(
  page.request,
  `projects/${alpha.id}/credentials`,
  "POST",
  { name: "MCP project tester", permissions: ["read", "tasks", "comment"] },
  201,
);
const client = new Client({ name: "access-test", version: "1" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["--import", "tsx", "mcp/server.ts"],
  env: {
    ...process.env,
    CUSTOMBACKLOG_URL: base,
    CUSTOMBACKLOG_PROJECT: alpha.id,
    CUSTOMBACKLOG_TOKEN: ai.secret,
  },
  stderr: "pipe",
});
await client.connect(transport);
expect((await client.listTools()).tools.map((t) => t.name)).toContain(
  "update_task",
);
const result = await client.callTool({
  name: "update_task",
  arguments: {
    id: task.id,
    version: task.version,
    title: "Edited through MCP",
    description: "Full description from the external assistant",
    priority: "High",
    status: "In progress",
  },
});
expect(result.isError).toBe(false);
task = JSON.parse(result.content[0].text);
const full = await req(page.request, `projects/${alpha.id}/tasks/${task.id}`);
expect(full.description).toBe("Full description from the external assistant");
expect(full.status).toBe("In progress");
const comment = await client.callTool({
  name: "add_task_comment",
  arguments: { id: task.id, text: "MCP progress note" },
});
expect(comment.isError).toBe(false);
await req(page.request, `projects/${beta.id}/tasks`, "GET", undefined, 403, {
  Authorization: `Bearer ${ai.secret}`,
});
await req(
  page.request,
  `projects/${alpha.id}/tasks/${task.id}/review`,
  "POST",
  { version: task.version, decision: "approve" },
  403,
  { Authorization: `Bearer ${ai.secret}` },
);
await client.close();
await transport.close();
await page.reload();
await page.getByRole("button", { name: "Settings", exact: true }).click();
await page.getByRole("button", { name: "People", exact: true }).click();
await page
  .locator(".member")
  .filter({ hasText: username })
  .getByRole("button", { name: "Manage access", exact: true })
  .click();
await page.screenshot({ path: "test-results/partner-project-access.png" });
expect(errors).toEqual([]);
console.log(
  "Passed: owner creates partner with scoped grants; only assigned project visible; private data/files denied; no self escalation; delegated backlog creation; live revoke; read-only controls; stale grants409; real MCP update/title/description/status/comment; AI cross-project/review denied; phone fits.",
);
await b.close();
