import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.TEST_URL || "http://localhost:3004";
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
await expect(page.locator(".react-flow")).toBeVisible();
await expect(
  page.getByRole("button", { name: "Backlog", exact: true }),
).toHaveCount(0);
const projects = await (
  await page.request.get(`${base}/api/v1/projects`)
).json();
const projectId = projects[0].id;
let project = await (
  await page.request.get(`${base}/api/v1/projects/${projectId}/snapshot`)
).json();
const screen = project.screens.find((s) => s.versions.length > 1);
if (!screen) throw new Error("Fixture needs multiple screen versions");
const commentText = `Preferred direction ${Date.now()}`;
const edges = JSON.stringify(project.journeys.map((j) => j.edges));
await page
  .locator(".canvas-screen.version-stack")
  .filter({ hasText: screen.title })
  .click();
await expect(page.getByRole("dialog")).toBeVisible();
const chosen = screen.versions.find(
  (v) => v.id !== screen.recommendation?.versionId,
);
await page
  .getByRole("button", {
    name: `Preview version ${chosen.number}`,
    exact: true,
  })
  .click();
await page
  .getByRole("button", { name: "Recommend this screen", exact: true })
  .click();
await expect(
  page.getByRole("button", { name: "Recommended screen", exact: true }),
).toBeVisible();
await page.getByLabel("Add a comment", { exact: true }).fill(commentText);
await page.getByRole("button", { name: "Post comment", exact: true }).click();
await expect(page.getByLabel("Add a comment", { exact: true })).toHaveValue("");
await expect(page.getByText(commentText, { exact: true })).toBeVisible();
await mkdir("test-results", { recursive: true });
await page.screenshot({
  path: "test-results/version-carousel-desktop.png",
  fullPage: false,
});
await page.keyboard.press("Escape");
await page.reload();
await expect(
  page
    .locator(".canvas-screen.version-stack")
    .filter({ hasText: screen.title }),
).toContainText(`VERSION ${chosen.number}`);
await expect(
  page
    .locator(".canvas-screen.version-stack")
    .filter({ hasText: screen.title }),
).toContainText("Recommended");
project = await (
  await page.request.get(`${base}/api/v1/projects/${projectId}/snapshot`)
).json();
expect(JSON.stringify(project.journeys.map((j) => j.edges))).toBe(edges);
expect(
  project.comments.some(
    (c) => c.versionId === chosen.id && c.text === commentText,
  ),
).toBe(true);
const conflict = await page.request.post(
  `${base}/api/v1/projects/${projectId}/screens/${screen.id}/recommend`,
  {
    headers: { Origin: base },
    data: { versionId: chosen.id, version: screen.recommendationVersion || 0 },
  },
);
expect(conflict.status()).toBe(409);
await page.getByRole("button", { name: "Screens", exact: true }).click();
await expect(
  page.locator(".screen-card.version-stack").filter({ hasText: screen.title }),
).toContainText(`VERSION ${chosen.number}`);
await page.setViewportSize({ width: 390, height: 844 });
await page
  .locator(".screen-card.version-stack")
  .filter({ hasText: screen.title })
  .locator(".screen-open")
  .click();
await expect(page.getByLabel("Screen version", { exact: true })).toHaveValue(
  chosen.id,
);
await expect(
  page.getByRole("button", { name: "Recommended screen", exact: true }),
).toBeVisible();
await page.getByRole("button", { name: "Next version", exact: true }).click();
await expect(
  page.getByLabel("Screen version", { exact: true }),
).not.toHaveValue(chosen.id);
await page
  .getByRole("button", { name: "Previous version", exact: true })
  .click();
await expect(page.getByLabel("Screen version", { exact: true })).toHaveValue(
  chosen.id,
);
expect(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
).toBe(true);
await page.screenshot({
  path: "test-results/version-carousel-phone.png",
  fullPage: false,
});
await page.keyboard.press("Escape");
await page.goto(`${base}/?page=backlog&task=${project.tasks[0].id}`);
await expect(page.locator(".react-flow")).toBeVisible();
await expect(page.getByRole("dialog")).toHaveCount(0);
await page.setViewportSize({ width: 1440, height: 1000 });
await page.screenshot({ path: "test-results/version-stack-canvas.png" });
expect(errors).toEqual([]);
const report = {
  partnerCanvasLanding: true,
  noBacklogNavigation: true,
  backlogDeepLinkShowsCanvas: true,
  stackedCanvasAndList: true,
  recommendationPersists: true,
  versionSpecificComment: true,
  connectionsUnchanged: true,
  staleRecommendation409: true,
  desktopAndPhoneCarousel: true,
  noPhonePageOverflow: true,
  pageErrors: errors,
};
await writeFile(
  "docs/verification/version-stacks.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(report);
await browser.close();
