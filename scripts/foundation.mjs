import assert from "node:assert/strict";
const base = process.env.TEST_URL || "http://localhost:3000";
let cookie = "";
async function req(path, data, options = {}) {
  const r = await fetch(base + path, {
    method: data ? "POST" : "GET",
    ...options,
    headers: {
      Origin: base,
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...options.headers,
    },
    body: data ? JSON.stringify(data) : options.body,
  });
  const c = r.headers.getSetCookie();
  if (c.length) cookie = c.map((v) => v.split(";")[0]).join("; ");
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (r.status >= 400) throw new Error(`${r.status}: ${JSON.stringify(json)}`);
  return json;
}
const suffix = Date.now();
const email = `owner${suffix}@example.test`;
await req("/api/v1/setup", {
  name: "Developer",
  email,
  password: "foundation-password-123",
  token: process.env.SETUP_TOKEN,
});
await req("/api/auth/sign-in/email", {
  email,
  password: "foundation-password-123",
});
const p = await req("/api/v1/projects", {
  name: "Foundation test",
  prefix: "TEST",
});
const c = await req(`/api/v1/projects/${p.id}/credentials`, {
  name: "Test assistant",
  permissions: ["read", "tasks", "upload"],
});
const headers = { Authorization: `Bearer ${c.secret}` };
const tasks = await req(
  `/api/v1/projects/${p.id}/tasks`,
  { tasks: [{ title: "Prove persistence" }] },
  { headers: { ...headers, "Idempotency-Key": `create-${suffix}` } },
);
assert.equal(tasks[0].title, "Prove persistence");
const screen = await req(
  `/api/v1/projects/${p.id}/screens`,
  { title: "Private upload" },
  { headers },
);
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
  "base64",
);
const upload = await req(
  `/api/v1/projects/${p.id}/screens/${screen.id}/versions`,
  null,
  {
    method: "POST",
    headers: { ...headers, "Content-Type": "image/png", "If-Match": "1" },
    body: png,
  },
);
const retrieved = await fetch(
  `${base}/api/v1/projects/${p.id}/files/${upload.key}`,
  { headers },
);
assert.equal(retrieved.status, 200);
assert.deepEqual(Buffer.from(await retrieved.arrayBuffer()), png);
assert.equal(
  (await fetch(`${base}/api/v1/projects/${p.id}/files/${upload.key}`)).status,
  401,
);
console.log(
  JSON.stringify({
    runtime: base,
    authenticated: true,
    writeRead: true,
    privateUpload: true,
    projectId: p.id,
  }),
);
