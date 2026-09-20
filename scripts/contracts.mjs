import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const base = process.env.TEST_URL || "http://localhost:3001";
let cookie = "";
const measurements = [];
async function req(
  path,
  {
    data,
    method = data ? "POST" : "GET",
    bearer,
    headers = {},
    raw,
    expected = 200,
    measure = false,
    noCookie = false,
  } = {},
) {
  const start = performance.now();
  const r = await fetch(`${base}/api/v1/${path}`, {
    method,
    headers: {
      Origin: base,
      ...(!noCookie && cookie ? { cookie } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: data ? JSON.stringify(data) : raw,
  });
  const bytes = new Uint8Array(await r.arrayBuffer());
  let result;
  try {
    result = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    result = bytes;
  }
  assert.equal(
    r.status,
    expected,
    `${method} ${path}: ${JSON.stringify(result)}`,
  );
  if (measure)
    measurements.push({
      path,
      method,
      status: r.status,
      bytes: bytes.length,
      elapsedMs: Math.round((performance.now() - start) * 100) / 100,
    });
  return result;
}
async function signIn(email, password) {
  const r = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(r.status, 200, await r.clone().text());
  return r.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
}
const install = await req("installation");
const password = process.env.TEST_PASSWORD || "contract-password-2026";
const email = process.env.TEST_EMAIL || "contract-owner@example.test";
if (install.setupRequired)
  await req("setup", {
    data: {
      name: "Contract owner",
      email,
      password,
      token: process.env.SETUP_TOKEN || "contract-setup-token",
    },
  });
cookie = await signIn(email, password);
await req("setup", {
  data: {
    name: "Intruder",
    email: "intruder@example.test",
    password,
    token: process.env.SETUP_TOKEN || "contract-setup-token",
  },
  expected: 409,
});
const invitation = await req("invitations", {
  data: { email: `partner-${Date.now()}@example.test` },
});
const token = new URL(invitation.url).searchParams.get("invite");
const partnerEmail = `partner-${Date.now()}@example.test`;
const invitation2 = await req("invitations", { data: { email: partnerEmail } });
const token2 = new URL(invitation2.url).searchParams.get("invite");
await req("join", {
  data: { name: "Partner", email: partnerEmail, password, token: token2 },
});
await req("join", {
  data: { name: "Partner", email: partnerEmail, password, token: token2 },
  expected: 403,
});
const ownerCookie = cookie;
const partnerCookie = await signIn(partnerEmail, password);
const p = await req("projects", {
  data: { name: "Contract suite", prefix: "TST" },
  expected: 201,
});
const other = await req("projects", {
  data: { name: "Isolated", prefix: "ISO" },
  expected: 201,
});
const path = `projects/${p.id}`;
const credential = await req(`${path}/credentials`, {
  data: {
    name: "Contract AI",
    permissions: ["read", "tasks", "comment", "upload"],
  },
  expected: 201,
});
const ai = credential.secret;
await req(`${path}/work-context`, { bearer: ai, measure: true });
const taskInput = {
  tasks: [
    {
      title: "A documented task",
      description: "Implement something useful",
      acceptanceCriteria: "Keyboard and phone verified",
      assignee: "Contract AI",
    },
  ],
};
const idem = crypto.randomUUID();
const created = await req(`${path}/tasks`, {
  data: taskInput,
  bearer: ai,
  headers: { "Idempotency-Key": idem },
  expected: 201,
  measure: true,
});
let task = created[0];
const duplicate = await req(`${path}/tasks`, {
  data: taskInput,
  bearer: ai,
  headers: { "Idempotency-Key": idem },
  expected: 201,
});
assert.equal(duplicate[0].id, task.id);
await req(`${path}/tasks`, {
  data: { tasks: [{ title: "Different" }] },
  bearer: ai,
  headers: { "Idempotency-Key": idem },
  expected: 409,
});
task = await req(`${path}/tasks/${task.id}/progress`, {
  method: "PATCH",
  data: {
    version: 1,
    status: "In progress",
    progressSummary: "Working",
    remainingWork: "One check",
    nextStep: "Run it",
  },
  bearer: ai,
  measure: true,
});
await req(`${path}/tasks/${task.id}/progress`, {
  method: "PATCH",
  data: { version: 1, status: "To do" },
  bearer: ai,
  expected: 409,
});
let full = await req(`${path}/tasks/${task.id}`, { bearer: ai, measure: true });
assert.equal(full.status, "In progress");
assert.equal(full.nextStep, "Run it");
const concurrent = await Promise.all([
  req(`${path}/tasks/${task.id}/progress`, {
    method: "PATCH",
    data: { version: 2, progressSummary: "Worker A" },
    bearer: ai,
  })
    .then(() => 200)
    .catch((e) => {
      if (e.message.includes("409")) return 409;
      throw e;
    }),
  req(`${path}/tasks/${task.id}/progress`, {
    method: "PATCH",
    data: { version: 2, progressSummary: "Worker B" },
    bearer: ai,
  })
    .then(() => 200)
    .catch((e) => {
      if (e.message.includes("409")) return 409;
      throw e;
    }),
]);
assert.deepEqual(concurrent.sort(), [200, 409]);
full = await req(`${path}/tasks/${task.id}`, { bearer: ai });
task = await req(`${path}/tasks/${task.id}/progress`, {
  method: "PATCH",
  data: { version: full.version, remainingWork: "", nextStep: "Human review" },
  bearer: ai,
  measure: true,
});
await req(`${path}/tasks/${task.id}/complete`, {
  data: { version: task.version, completionSummary: "", verification: "" },
  bearer: ai,
  headers: { "Idempotency-Key": crypto.randomUUID() },
  expected: 422,
});
const completion = {
  version: task.version,
  completionSummary: "Implemented and checked",
  verification:
    "Not run: intentionally testing an explicit unperformed-check record",
};
const completeKey = crypto.randomUUID();
task = await req(`${path}/tasks/${task.id}/complete`, {
  data: completion,
  bearer: ai,
  headers: { "Idempotency-Key": completeKey },
  measure: true,
});
await req(`${path}/tasks/${task.id}/complete`, {
  data: completion,
  bearer: ai,
  headers: { "Idempotency-Key": completeKey },
});
await req(`${path}/changes?cursor=0`, { bearer: ai, measure: true });
await req(`${path}/tasks/${task.id}/review`, {
  data: { version: task.version, decision: "approve", feedback: "" },
  bearer: ai,
  expected: 403,
});
await req(`${path}/tasks/${task.id}/review`, {
  data: { version: task.version, decision: "changes", feedback: "" },
  expected: 422,
});
task = await req(`${path}/tasks/${task.id}/review`, {
  data: {
    version: task.version,
    decision: "changes",
    feedback: "Please fix the keyboard focus",
  },
});
assert.equal(task.status, "In progress");
task = await req(`${path}/tasks/${task.id}/complete`, {
  data: {
    version: task.version,
    completionSummary: "Fixed focus",
    verification: "Browser check passed in this contract example",
  },
  bearer: ai,
  headers: { "Idempotency-Key": crypto.randomUUID() },
});
task = await req(`${path}/tasks/${task.id}/review`, {
  data: { version: task.version, decision: "approve", feedback: "Accepted" },
});
assert.equal(task.status, "Done reviewed");
const j = await req(`${path}/journeys`, {
  data: { name: "Happy path" },
  expected: 201,
});
const screen = await req(`${path}/screens`, {
  data: { title: "A private screen", journeyId: j.id },
  bearer: ai,
  expected: 201,
});
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
  "base64",
);
const version = await req(`${path}/screens/${screen.id}/versions`, {
  method: "POST",
  raw: png,
  bearer: ai,
  headers: { "Content-Type": "image/png", "If-Match": "1" },
  expected: 201,
});
await req(`${path}/screens/${screen.id}/versions`, {
  method: "POST",
  raw: Buffer.from('<svg onload="alert(1)"></svg>'),
  bearer: ai,
  headers: { "Content-Type": "image/png", "If-Match": "2" },
  expected: 415,
});
await req(`${path}/screens/${screen.id}/review`, {
  data: {
    versionId: version.id,
    reviewVersion: 0,
    decision: "Approved",
    feedback: "",
  },
  bearer: ai,
  expected: 403,
});
cookie = partnerCookie;
await req(`${path}/tasks`, {
  data: { tasks: [{ title: "Forbidden partner task" }] },
  headers: { "Idempotency-Key": crypto.randomUUID() },
  expected: 403,
});
const comment = await req(`${path}/comments`, {
  data: {
    screenId: screen.id,
    versionId: version.id,
    text: "Move this label",
    pin: { x: 0.3, y: 0.7 },
  },
  expected: 201,
});
await req(`${path}/comments`, {
  data: {
    screenId: screen.id,
    versionId: version.id,
    text: "This is why",
    parentId: comment.id,
  },
  expected: 201,
});
await req(`${path}/screens/${screen.id}/review`, {
  data: {
    versionId: version.id,
    reviewVersion: 0,
    decision: "Changes requested",
    feedback: "Explain this label",
  },
});
await req(`${path}/screens/${screen.id}/review`, {
  data: {
    versionId: version.id,
    reviewVersion: 0,
    decision: "Approved",
    feedback: "",
  },
  expected: 409,
});
await req(`${path}/screens/${screen.id}/review`, {
  data: {
    versionId: version.id,
    reviewVersion: 1,
    decision: "Approved",
    feedback: "Ready",
  },
});
cookie = ownerCookie;
const newVersion = await req(`${path}/screens/${screen.id}/versions`, {
  method: "POST",
  raw: png,
  bearer: ai,
  headers: { "Content-Type": "image/png", "If-Match": "2" },
  expected: 201,
});
assert.equal(newVersion.status, "Awaiting review");
const context = await req(`${path}/screens/${screen.id}?comments=true`, {
  bearer: ai,
});
assert.equal(context.versions[1].status, "Approved");
assert.equal(context.comments[0].versionId, version.id);
const linkedBody = {
  tasks: [{ title: "Move label", sourceCommentId: comment.id }],
};
const linked = await req(`${path}/tasks`, {
  data: linkedBody,
  headers: { "Idempotency-Key": crypto.randomUUID() },
  expected: 201,
});
const linkedAgain = await req(`${path}/tasks`, {
  data: linkedBody,
  headers: { "Idempotency-Key": crypto.randomUUID() },
  expected: 201,
});
assert.equal(linked[0].id, linkedAgain[0].id);
let journeys = await req(`${path}/journeys`);
const layout = {
  version: journeys[0].version,
  nodes: journeys[0].nodes.map((n) => ({ ...n, position: { x: 125, y: 275 } })),
  edges: [],
};
await req(`${path}/journeys/${j.id}`, { method: "PUT", data: layout });
await req(`${path}/journeys/${j.id}`, {
  method: "PUT",
  data: layout,
  expected: 409,
});
journeys = await req(`${path}/journeys`);
assert.equal(journeys[0].nodes[0].position.x, 125);
await req(`projects/${other.id}/work-context`, { bearer: ai, expected: 403 });
await req(`projects/${other.id}/files/${version.key}`, {
  bearer: ai,
  expected: 403,
});
await req(`${path}/files/${version.key}`, { noCookie: true, expected: 401 });
const image = await req(`${path}/files/${version.key}`, { bearer: ai });
assert.deepEqual(Buffer.from(image), png);

await req(`${path}/tasks/${task.id}/comments`, {
  data: { text: "Persistent task discussion" },
  bearer: ai,
  expected: 200,
});
const discussed = await req(`${path}/tasks/${task.id}`, { bearer: ai });
assert.equal(discussed.comments[0].text, "Persistent task discussion");
await req(`${path}/tasks?limit=51`, { bearer: ai, expected: 422 });
await req(`${path}/changes?cursor=999999`, { bearer: ai, expected: 410 });
const noOrigin = await fetch(`${base}/api/v1/${path}/tasks/${task.id}/review`, {
  method: "POST",
  headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({
    version: task.version,
    decision: "reopen",
    feedback: "No origin",
  }),
});
assert.equal(noOrigin.status, 403);

const exported = await req(`${path}/export`);
assert.equal(exported.project.receipts, undefined);
assert.equal(JSON.stringify(exported).includes(ai), false);
const imported = await req(`${path}/import`, { data: exported, expected: 201 });
const importedProject = await req(`projects/${imported.id}/snapshot`);
assert.equal(importedProject.tasks.length, 2);
assert.equal(importedProject.comments.length, 2);
assert.equal(importedProject.screens[0].versions.length, 3);
assert.equal(importedProject.journeys[0].nodes[0].position.y, 275);
assert.deepEqual(
  Buffer.from(
    await req(
      `projects/${imported.id}/files/${importedProject.screens[0].versions[1].key}`,
    ),
  ),
  png,
);
const bad = structuredClone(exported);
bad.files["../../evil"] = "a";
await req(`${path}/import`, { data: bad, expected: 422 });
const kit = await fetch(`${base}/api/v1/${path}/connection-kit`, {
  headers: { cookie },
});
assert.equal(kit.status, 200);
assert.equal(kit.headers.get("content-type"), "application/zip");
const client = new Client({ name: "contract-consumer", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["--import", "tsx", "mcp/server.ts"],
  env: {
    ...process.env,
    CUSTOMBACKLOG_URL: base,
    CUSTOMBACKLOG_PROJECT: p.id,
    CUSTOMBACKLOG_TOKEN: ai,
  },
  stderr: "pipe",
});
await client.connect(transport);
const tools = await client.listTools();
assert.equal(tools.tools.length, 10);
assert.equal(
  tools.tools.some((t) => t.name.includes("review")),
  false,
);
const mcpContext = await client.callTool({
  name: "get_work_context",
  arguments: {},
});
assert.equal(mcpContext.isError, false);
const mcpCreated = await client.callTool({
  name: "create_tasks",
  arguments: {
    idempotencyKey: crypto.randomUUID(),
    tasks: [{ title: "MCP task" }],
  },
});
assert.equal(mcpCreated.isError, false);
const mcpTask = JSON.parse(mcpCreated.content[0].text)[0];
const mcpProgress = await client.callTool({
  name: "update_progress",
  arguments: {
    id: mcpTask.id,
    version: 1,
    status: "In progress",
    progressSummary: "MCP wrote progress",
    remainingWork: "Resume later",
    nextStep: "Read requirements",
  },
});
assert.equal(mcpProgress.isError, false);
await client.close();

const members = await req("members");
const partner = members.find((m) => m.email === partnerEmail);
await req(`members/${partner.id}`, { method: "DELETE" });
cookie = partnerCookie;
await req("me", { expected: 401 });
cookie = ownerCookie;

await req(`${path}/credentials/${credential.id}`, { method: "DELETE" });
await req(`${path}/work-context`, { bearer: ai, expected: 401 });
await mkdir("test-results", { recursive: true });
const result = {
  runtime: base,
  checks: [
    "owner setup closes",
    "single-use partner invitation",
    "project-scoped AI credentials",
    "progress persistence",
    "idempotent creation and completion",
    "concurrent edits conflict",
    "completion evidence required",
    "human-only task review",
    "changes return to In progress",
    "version-specific screen review",
    "screen review conflicts",
    "pinned comments and replies",
    "comment task deduplication",
    "canvas persistence",
    "upload type validation",
    "private images",
    "project isolation",
    "portable import/export",
    "MCP stdio using REST",
    "revocation",
    "persistent task discussion",
    "partner session revocation",
    "CSRF origin rejection",
    "bounded pagination",
    "cursor resync response",
  ],
  measurements,
  workflowRequests: measurements.length,
  totalResponseBytes: measurements.reduce((s, m) => s + m.bytes, 0),
  persistence: {
    projectId: p.id,
    taskId: mcpTask.id,
    status: "In progress",
    progressSummary: "MCP wrote progress",
  },
};
await writeFile(
  `test-results/contracts-${new URL(base).port}.json`,
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
