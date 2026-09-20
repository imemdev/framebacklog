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
await expect(
  page.getByRole("heading", { name: "Backlog", exact: false }),
).toBeVisible();
const projects = await (
  await page.request.get(`${base}/api/v1/projects`)
).json();
const id = projects[0].id;
const project = await (
  await page.request.get(`${base}/api/v1/projects/${id}/snapshot`)
).json();
const task = project.tasks.find((t) => t.status === "Done reviewed");
if (!task) throw new Error("Use a disposable fixture with a reviewed task");
const stale = await page.request.delete(
  `${base}/api/v1/projects/${id}/tasks/${task.id}`,
  { headers: { Origin: base }, data: { version: task.version + 1 } },
);
expect(stale.status()).toBe(409);
await page.goto(`${base}/?page=backlog&task=${task.id}`);
await page.getByRole("button", { name: "Delete task", exact: true }).click();
await page.getByRole("button", { name: "Keep task", exact: true }).click();
await expect(
  page.getByRole("region", { name: "Confirm task deletion" }),
).toHaveCount(0);
await page.getByRole("button", { name: "Delete task", exact: true }).click();
await page
  .getByRole("button", { name: "Delete permanently", exact: true })
  .click();
await expect(page.getByRole("dialog")).toHaveCount(0);
expect(
  (
    await page.request.get(`${base}/api/v1/projects/${id}/tasks/${task.id}`)
  ).status(),
).toBe(404);
const fixture = await browser.newPage({
  viewport: { width: 360, height: 640 },
});
await fixture.setContent(
  '<html><body style="margin:0;background:#ecf1f8;font-family:Arial;height:640px;box-sizing:border-box;padding:24px;display:flex;flex-direction:column;justify-content:space-between"><header style="background:white;padding:22px;border-radius:12px">Portrait test · TOP</header><main style="font-size:30px">A complete<br>9:16 screen</main><footer style="background:#187245;color:white;padding:22px;border-radius:12px">BOTTOM · Nothing cropped</footer></body></html>',
);
const bytes = await fixture.screenshot();
await fixture.close();
const screen = project.screens[0];
const upload = await page.request.post(
  `${base}/api/v1/projects/${id}/screens/${screen.id}/versions`,
  {
    headers: {
      Origin: base,
      "Content-Type": "image/png",
      "If-Match": String(screen.versions.length),
    },
    data: bytes,
  },
);
expect(upload.ok()).toBe(true);
const version = await upload.json();
await page.goto(`${base}/?page=journey&screen=${screen.id}`);
await page
  .getByLabel("Screen version", { exact: true })
  .selectOption(version.id);
const image = page.locator(".image-relative > img");
await expect(image).toBeVisible();
await expect.poll(() => image.evaluate((i) => i.naturalWidth)).toBe(360);
const dims = await image.boundingBox();
expect(Math.abs(dims.width / dims.height - 9 / 16)).toBeLessThan(0.01);
await page.screenshot({ path: "test-results/portrait-desktop.png" });
await page.setViewportSize({ width: 390, height: 844 });
const phoneDims = await image.boundingBox();
expect(Math.abs(phoneDims.width / phoneDims.height - 9 / 16)).toBeLessThan(
  0.01,
);
expect(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
).toBe(true);
await page.screenshot({ path: "test-results/portrait-phone.png" });
await page
  .getByRole("button", { name: "Recommend this screen", exact: true })
  .click();
await expect(
  page.getByRole("button", { name: "Recommended screen", exact: true }),
).toBeVisible();
await page.keyboard.press("Escape");
await page.setViewportSize({ width: 1440, height: 1000 });
await page.getByRole("button", { name: "Canvas", exact: true }).click();
await expect(page.locator(".canvas-image img").first()).toHaveCSS(
  "object-fit",
  "contain",
);
await page.screenshot({ path: "test-results/portrait-canvas.png" });
expect(errors).toEqual([]);
console.log(
  "Passed: reviewed-task delete/cancel/404 and stale 409; real 360×640 upload; uncropped desktop/phone preview ratio; canvas contain; no overflow or page errors.",
);
await browser.close();
