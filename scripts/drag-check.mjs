import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://localhost:3000");
await page.getByLabel("Username").fill(process.env.TEST_USERNAME || "owner");
await page
  .getByLabel("Password", { exact: true })
  .fill(process.env.TEST_PASSWORD || "demo-local-password-2026");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.getByRole("button", { name: "User journey", exact: true }).click();
await page.getByRole("button", { name: "Canvas", exact: true }).click();
const node = page.locator(".react-flow__node").first();
await node.waitFor();
const project = await page.evaluate(async () => {
  const p = await fetch("/api/v1/projects").then((r) => r.json());
  return p[0].id;
});
const before = await page.evaluate(
  async (id) => fetch(`/api/v1/projects/${id}/journeys`).then((r) => r.json()),
  project,
);
const box = await node.boundingBox();
await page.mouse.move(box.x + 100, box.y + 80);
await page.mouse.down();
await page.mouse.move(box.x + 150, box.y + 120, { steps: 12 });
await page.mouse.up();
await expect(page.locator(".save-indicator")).toHaveText("Saved");
await expect(page.getByRole("dialog")).toHaveCount(0);
const after = await page.evaluate(
  async (id) => fetch(`/api/v1/projects/${id}/journeys`).then((r) => r.json()),
  project,
);
expect(after[0].nodes[0].position.x).not.toBe(before[0].nodes[0].position.x);
await page.reload();
await page.getByRole("button", { name: "Canvas", exact: true }).click();
await page.locator(".react-flow__node").first().waitFor();
const loaded = await page.evaluate(
  async (id) => fetch(`/api/v1/projects/${id}/journeys`).then((r) => r.json()),
  project,
);
expect(loaded[0].nodes[0].position).toEqual(after[0].nodes[0].position);
const restored = await page.evaluate(
  async ({ project, before, version }) =>
    fetch(`/api/v1/projects/${project}/journeys/${before.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodes: before.nodes,
        edges: before.edges,
        version,
      }),
    }).then((r) => r.status),
  { project, before: before[0], version: loaded[0].version },
);
expect(restored).toBe(200);
const result = {
  dragSaved: true,
  refreshPreserved: true,
  openedUnexpectedDialog: false,
  restoredDemoLayout: true,
};
await writeFile("docs/verification/drag.json", JSON.stringify(result, null, 2));
console.log(result);
await browser.close();
