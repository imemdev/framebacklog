import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.TEST_URL || "http://localhost:3000");
await page.waitForTimeout(1500);
console.log({
  title: await page.title(),
  body: (await page.locator("body").innerText()).slice(0, 900),
  errors,
});
await mkdir("test-results", { recursive: true });
await page.screenshot({ path: "test-results/smoke.png" });
await browser.close();
if (errors.length) process.exit(1);
