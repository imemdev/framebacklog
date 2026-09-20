import { chromium, expect } from "@playwright/test";
const base = process.env.TEST_URL || "http://localhost:3006";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base);
await page
  .getByLabel("Username", { exact: true })
  .fill(process.env.TEST_USERNAME);
await page
  .getByLabel("Password", { exact: true })
  .fill(process.env.TEST_PASSWORD);
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await expect(
  page.getByRole("button", { name: "New task", exact: true }),
).toBeVisible();
async function req(path, method = "GET", data) {
  const r = await page.request.fetch(`${base}/api/v1/${path}`, {
    method,
    headers: { Origin: base },
    ...(data ? { data } : {}),
  });
  if (!r.ok()) throw Error(await r.text());
  return r.json();
}
const ps = await req("projects");
const p = await req(`projects/${ps[0].id}/snapshot`),
  j = p.journeys[0];
const nodes = j.nodes
  .slice(0, 3)
  .map((n, i) => ({ ...n, position: { x: i * 360, y: 100 } }));
const edges = [
  [0, 1, "Continue"],
  [1, 2, "Next"],
  [2, 0, "Back to welcome"],
  [0, 2, "Skip sign in"],
].map(([a, b, label], i) => ({
  id: `routing-${i}`,
  source: nodes[a].id,
  target: nodes[b].id,
  label,
}));
await req(`projects/${p.id}/journeys/${j.id}`, "PUT", {
  version: j.version,
  nodes,
  edges,
});
await page.goto(`${base}/?page=journey&project=${p.id}`);
await page.getByRole("button", { name: "Canvas", exact: true }).click();
await expect(page.locator(".react-flow__edge")).toHaveCount(4);
await expect(page.getByText("Back to welcome", { exact: true })).toBeVisible();
const back = page
  .locator(".react-flow__edge")
  .filter({ hasText: "Back to welcome" });
await back.dispatchEvent("click");
await expect(
  page.getByRole("dialog", { name: "Delete connection?" }),
).toBeVisible();
await page
  .getByRole("button", { name: "Keep connection", exact: true })
  .click();
await page.screenshot({ path: "test-results/edge-routing-desktop.png" });
await page.reload();
await page.getByRole("button", { name: "Canvas", exact: true }).click();
await expect(page.locator(".react-flow__edge")).toHaveCount(4);
await page.setViewportSize({ width: 390, height: 844 });
await page.locator(".react-flow__controls-fitview").click();
await page.screenshot({ path: "test-results/edge-routing-phone.png" });
if (errors.length) throw Error(errors.join("\n"));
console.log(
  "PASS: return/forward/skip edges render, click confirmation, refresh persistence, desktop and phone",
);
await browser.close();
