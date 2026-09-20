import { chromium, expect } from "@playwright/test";
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
const projects = await (
  await page.request.get(`${base}/api/v1/projects`)
).json();
const id = projects[0].id;
const project = await (
  await page.request.get(`${base}/api/v1/projects/${id}/snapshot`)
).json();
const screen = project.screens.find((s) => s.versions.some((v) => v.key));
const version = screen.versions.find((v) => v.key);
const offset = project.comments.filter(
  (c) => c.versionId === version.id && c.pin && !c.parentId,
).length;
const texts = [`Pin check A ${Date.now()}`, `Pin check B ${Date.now()}`];
for (let i = 0; i < 2; i++) {
  const r = await page.request.post(`${base}/api/v1/projects/${id}/comments`, {
    headers: { Origin: base },
    data: {
      screenId: screen.id,
      versionId: version.id,
      text: texts[i],
      pin: { x: 0.3 + i * 0.3, y: 0.4 },
    },
  });
  expect(r.ok()).toBe(true);
}
await page.goto(`${base}/?page=journey&screen=${screen.id}`);
await page
  .getByLabel("Screen version", { exact: true })
  .selectOption(version.id);
const number = offset + 2;
const marker = page.getByRole("button", {
  name: `View pin ${number}: ${texts[1]}`,
  exact: true,
});
await expect(marker).toHaveText(String(number));
await marker.click();
const comment = page.locator(".comment").filter({ hasText: texts[1] });
await expect(comment).toHaveClass(/active-comment/);
await expect(comment).toBeFocused();
await comment
  .getByRole("button", { name: `Show pin ${number} on screen`, exact: true })
  .click();
await expect(marker).toBeFocused();
await page
  .locator(".comment")
  .filter({ hasText: texts[0] })
  .getByRole("button", { name: "Resolve", exact: true })
  .click();
await expect(
  page.locator(".comment").filter({ hasText: texts[0] }),
).toHaveCount(0);
await expect(marker).toHaveText(String(number));
await page.getByLabel("Show resolved threads").check();
await expect(
  page.getByRole("button", {
    name: `View pin ${offset + 1}: ${texts[0]}`,
    exact: true,
  }),
).toHaveText(String(offset + 1));
await expect(marker).toHaveText(String(number));
await page.setViewportSize({ width: 390, height: 844 });
await comment
  .getByRole("button", { name: `Show pin ${number} on screen`, exact: true })
  .click();
await expect(marker).toBeFocused();
expect(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
).toBe(true);
expect(errors).toEqual([]);
console.log(
  "Passed: matching pin labels, two-way focus/highlight, stable numbering after resolution, desktop and phone, no page errors.",
);
await browser.close();
