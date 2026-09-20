import { writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const WebSocket = require("next/dist/compiled/ws");
const base = "http://localhost:8787";
const inspected = await fetch("http://localhost:9229/json/list").then((r) =>
  r.json(),
);
console.log(
  "Inspector targets:",
  inspected.map((t) => ({ id: t.id, title: t.title })),
);
const target = inspected.find((t) => t.webSocketDebuggerUrl);
if (!target) throw new Error("No Workers inspector target");
const ws = new WebSocket(target.webSocketDebuggerUrl, {
  origin: "http://localhost:9229",
});
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let sequence = 1000000;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id) {
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.error) p.reject(new Error(JSON.stringify(m.error)));
    else p.resolve(m.result);
  }
};
function cmd(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
await cmd("Profiler.enable");
await cmd("Profiler.setSamplingInterval", { interval: 1000 });
await cmd("Profiler.start");
const start = performance.now();
const response = await fetch(`${base}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { Origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({
    email: process.env.TEST_EMAIL,
    password: process.env.TEST_PASSWORD,
  }),
});
await response.arrayBuffer();
const wallMs = performance.now() - start;
const { profile } = await cmd("Profiler.stop");
ws.close();
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const classified = { idle: 0, program: 0, javascript: 0 };
for (let i = 0; i < (profile.samples || []).length; i++) {
  const node = byId.get(profile.samples[i]);
  const name = node?.callFrame?.functionName;
  const kind =
    name === "(idle)"
      ? "idle"
      : name === "(program)" || name === "(root)"
        ? "program"
        : "javascript";
  classified[kind] += (profile.timeDeltas?.[i] || 1000) / 1000;
}
const result = {
  method:
    "workerd V8 CPU sampling through local Wrangler inspector, 1 ms sampling interval. Approximate non-idle sample time; not billed Cloudflare CPU, not production quota enforcement.",
  status: response.status,
  wallMs,
  samples: profile.samples?.length,
  classifiedMs: classified,
};
await mkdir("docs/verification", { recursive: true });
await writeFile(
  "docs/verification/workers-cpu.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
