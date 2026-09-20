import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
await page.goto("http://localhost:3000");
await page.getByLabel("Email address").fill("owner@demo.local");
await page
  .getByLabel("Password", { exact: true })
  .fill("demo-local-password-2026");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.getByRole("heading", { name: "Backlog", exact: false }).waitFor();
const reports = [];
for (const view of [
  "backlog",
  "journey",
  "canvas",
  "mobile",
  "task-panel",
  "settings",
  "screen-review",
]) {
  if (view === "journey")
    await page
      .getByRole("button", { name: "User journey", exact: true })
      .click();
  if (view === "canvas") {
    await page.getByRole("button", { name: "Canvas", exact: true }).click();
    await page.locator(".react-flow__node").first().waitFor();
  }
  if (view === "mobile") {
    await page.setViewportSize({ width: 360, height: 800 });
    await page
      .getByRole("button", { name: "Backlog", exact: true })
      .last()
      .click();
    await page.getByRole("button", { name: "List", exact: true }).click();
  }
  if (view === "task-panel") {
    await page.locator(".task-row").first().click();
    await page.getByRole("dialog").waitFor();
  }
  if (view === "settings") {
    await page.getByRole("button", { name: "Close panel" }).click();
    await page.getByRole("button", { name: "More", exact: true }).click();
  }
  if (view === "screen-review") {
    await page.getByRole("button", { name: "Journey", exact: true }).click();
    await page.locator(".screen-open").first().click();
    await page.getByRole("dialog").waitFor();
  }
  await page.waitForTimeout(300);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  const violations = result.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    nodes: v.nodes.map((n) => ({
      target: n.target,
      summary: n.failureSummary,
    })),
  }));
  reports.push({ view, violations });
  console.log(JSON.stringify({ view, violations }, null, 2));
  if (view === "canvas")
    await page.screenshot({
      path: "test-results/canvas-current.png",
      fullPage: true,
    });
}
await mkdir("docs/verification", { recursive: true });
await writeFile(
  "docs/verification/accessibility.json",
  JSON.stringify(reports, null, 2),
);
await browser.close();
