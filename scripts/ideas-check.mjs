import { chromium, expect } from "@playwright/test";
const base = process.env.TEST_URL || "http://localhost:3004";
const browser = await chromium.launch();
const errors = [];
async function login(username, password, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Ideas", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ideas", exact: true }),
  ).toBeVisible();
  return page;
}
const partner = await login(
  process.env.PARTNER_USERNAME,
  process.env.PARTNER_PASSWORD,
  390,
);
const tag = `Launch ${Date.now()}`;
await partner.getByRole("button", { name: "Add idea", exact: true }).click();
await partner.getByLabel("New tag", { exact: true }).fill(tag);
await partner.getByRole("button", { name: "Save tag", exact: true }).click();
await expect(
  partner.getByRole("button", { name: tag, exact: true }),
).toHaveAttribute("aria-pressed", "true");
await partner.getByRole("button", { name: "Cancel", exact: true }).click();
await partner.reload();
await partner.getByRole("button", { name: "Add idea", exact: true }).click();
await expect(
  partner.getByRole("button", { name: tag, exact: true }),
).toBeVisible();
await partner
  .getByLabel("Idea title", { exact: true })
  .fill("Share our first mobile preview");
await partner
  .getByLabel("Details", { exact: true })
  .fill("Show the new onboarding screens in a short launch video.");
await partner.getByRole("button", { name: tag, exact: true }).click();
await partner.getByRole("button", { name: "Marketing", exact: true }).click();
await partner.getByRole("button", { name: "Save idea", exact: true }).click();
await expect(partner.getByRole("dialog")).toHaveCount(0);
await partner.reload();
await expect(
  partner.getByRole("heading", {
    name: "Share our first mobile preview",
    exact: true,
  }),
).toBeVisible();
await partner
  .getByLabel("Filter ideas by tag", { exact: true })
  .selectOption(tag);
expect(
  await partner.evaluate(
    () => document.documentElement.scrollWidth <= innerWidth,
  ),
).toBe(true);
await partner.screenshot({ path: "test-results/ideas-phone.png" });
const owner = await login(
  process.env.OWNER_USERNAME,
  process.env.OWNER_PASSWORD,
  1440,
);
await expect(
  owner.getByRole("heading", {
    name: "Share our first mobile preview",
    exact: true,
  }),
).toBeVisible();
await owner.getByRole("button", { name: "Add idea", exact: true }).click();
await owner
  .getByLabel("Idea title", { exact: true })
  .fill("Try a simpler navigation");
await owner.getByRole("button", { name: tag, exact: true }).click();
await owner.getByRole("button", { name: "Mobile app UI", exact: true }).click();
await owner.getByRole("button", { name: "Save idea", exact: true }).click();
await expect(owner.getByRole("dialog")).toHaveCount(0);
await owner
  .getByLabel("Filter ideas by tag", { exact: true })
  .selectOption(tag);
await expect(owner.locator(".idea-card")).toHaveCount(2);
await owner.screenshot({ path: "test-results/ideas-desktop.png" });
const projects = await (
  await owner.request.get(`${base}/api/v1/projects`)
).json();
const projectId = projects[0].id;
const tags = await (
  await owner.request.get(`${base}/api/v1/projects/${projectId}/idea-tags`)
).json();
expect(tags.filter((t) => t === tag)).toHaveLength(1);
const ideas = await (
  await owner.request.get(`${base}/api/v1/projects/${projectId}/ideas`)
).json();
const own = ideas.find((i) => i.title === "Try a simpler navigation");
const denied = await partner.request.patch(
  `${base}/api/v1/projects/${projectId}/ideas/${own.id}`,
  {
    headers: { Origin: base },
    data: { title: "Not mine", tags: [], version: own.version },
  },
);
expect(denied.status()).toBe(403);
expect(errors).toEqual([]);
console.log(
  "Passed: Kai and owner create shared ideas; tags survive cancelled form and refresh; both reuse one saved tag; filtering; phone layout; ownership enforced; no page errors.",
);
await browser.close();
