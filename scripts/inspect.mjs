import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.log("PAGE ERROR", e.message);
});
await page.goto("http://localhost:3000");
await page.getByLabel("Email address").fill("owner@demo.local");
await page
  .getByLabel("Password", { exact: true })
  .fill("demo-local-password-2026");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.getByRole("heading", { name: "Backlog", exact: false }).waitFor();
await mkdir("test-results", { recursive: true });
await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
await page.getByRole("button", { name: "User journey", exact: true }).click();
await page
  .getByRole("heading", { name: "User journey", exact: true })
  .waitFor();
await page.screenshot({ path: "test-results/journey.png", fullPage: true });
await page.getByRole("button", { name: "Canvas", exact: true }).click();
await page.locator(".react-flow__node").first().waitFor();
await page.screenshot({ path: "test-results/canvas.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Backlog", exact: true }).last().click();
await page.getByRole("button", { name: "List", exact: true }).click();
await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
console.log({
  errors,
  overflow: await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  ),
});
await browser.close();
if (errors.length) process.exit(1);
