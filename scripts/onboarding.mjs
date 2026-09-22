import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const base = process.env.TEST_URL || "http://localhost:3002";
await page.goto(base);
await page.getByLabel("Username").fill("onboarding-owner");
await page
  .getByLabel("Password", { exact: true })
  .fill("onboarding-password-2026");
await expect(page.locator(".auth-form input")).toHaveCount(2);
await page.getByRole("button", { name: "Create owner account" }).click();
await page
  .getByRole("button", { name: "Create a project", exact: true })
  .click();
await page.getByLabel("Project name").fill("New installation");
await page.getByLabel("Task ID prefix").fill("NEW");
await page.getByRole("button", { name: "Create project", exact: true }).click();
await expect(
  page.getByRole("heading", { name: "Backlog", exact: false }),
).toBeVisible();
await page.getByRole("button", { name: "Settings", exact: true }).click();
await page.getByRole("button", { name: "People", exact: true }).click();
await page.getByRole("button", { name: "Create partner", exact: true }).click();
await page
  .getByLabel("Partner username", { exact: true })
  .fill("onboarding-partner");
await page
  .getByRole("checkbox", {
    name: "Let the partner choose a password using an invitation",
  })
  .check();
await page
  .locator(".partner-project")
  .first()
  .getByRole("checkbox")
  .first()
  .check();
await page
  .locator(".partner-project")
  .first()
  .getByRole("button", { name: "Screen reviewer", exact: true })
  .click();
await page
  .getByRole("button", { name: "Create invitation", exact: true })
  .click();
const invitation = await page.getByLabel("Invitation link").inputValue();
const partnerContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const partner = await partnerContext.newPage();
await partner.goto(invitation);
await partner.getByLabel("Username").fill("onboarding-partner");
await partner
  .getByLabel("Password", { exact: true })
  .fill("onboarding-partner-password-2026");
await partner.getByRole("button", { name: "Join workspace" }).click();
await expect(
  partner.getByRole("heading", { name: "User journey", exact: false }),
).toBeVisible();
await expect(
  partner.getByRole("button", { name: "New task", exact: true }),
).toHaveCount(0);
await expect(
  partner.getByRole("button", { name: "More", exact: true }),
).toHaveCount(0);
await expect(
  partner.getByRole("button", { name: "Reviews", exact: true }),
).toHaveCount(0);
expect(errors).toEqual([]);
const report = {
  runtime: base,
  ownerSetupUI: true,
  projectCreationUI: true,
  invitationCreationUI: true,
  partnerJoinUI: true,
  partnerPermissionState: true,
  ownerPageAndConsoleErrors: errors,
};
await writeFile(
  "docs/verification/onboarding.json",
  JSON.stringify(report, null, 2),
);
console.log(report);
await browser.close();
