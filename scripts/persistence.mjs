import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const base = process.env.TEST_URL || "http://localhost:3001";
const report = JSON.parse(
  await readFile(
    process.env.REPORT || "docs/verification/node-contracts.json",
    "utf8",
  ),
);
const r = await fetch(`${base}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { Origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({
    email: process.env.TEST_EMAIL || "contract-owner@example.test",
    password: process.env.TEST_PASSWORD || "contract-password-2026",
  }),
});
assert.equal(r.status, 200, await r.clone().text());
const cookie = r.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
const saved = await fetch(
  `${base}/api/v1/projects/${report.persistence.projectId}/tasks/${report.persistence.taskId}`,
  { headers: { cookie } },
).then((r) => r.json());
assert.equal(saved.status, "In progress");
assert.equal(saved.progressSummary, "MCP wrote progress");
const result = {
  runtime: base,
  verifiedAfterProcessRestart: true,
  status: saved.status,
  progressSummary: saved.progressSummary,
  taskId: saved.id,
};
await writeFile(
  `docs/verification/restart-${new URL(base).port}.json`,
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
