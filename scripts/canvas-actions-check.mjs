import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.TEST_URL || "http://localhost:3006";
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
const ranks = { Urgent: 3, High: 2, Medium: 1, Low: 0 };
for (const col of await page.locator(".column").all()) {
  const txt = await col.innerText();
  const ps = txt
    .split("\n")
    .filter((x) => x in ranks)
    .map((x) => ranks[x]);
  if (ps.some((x, i) => i && ps[i - 1] < x)) throw Error("Unsorted " + txt);
}
await page.getByRole("button", { name: "User journey", exact: true }).click();
await page.getByRole("button", { name: "Canvas", exact: true }).click();
await expect(page.locator(".react-flow")).toBeVisible();
const edge = page.locator(".react-flow__edge").first();
await expect(edge).toBeVisible();
const count = await page.locator(".react-flow__edge").count();
await edge.dispatchEvent("click");
await expect(
  page.getByRole("dialog", { name: "Delete connection?" }),
).toBeVisible();
await page
  .getByRole("button", { name: "Keep connection", exact: true })
  .click();
await expect(page.locator(".react-flow__edge")).toHaveCount(count);
await edge.dispatchEvent("click");
await page
  .getByRole("button", { name: "Delete connection", exact: true })
  .click();
await expect(page.locator(".react-flow__edge")).toHaveCount(count - 1);
await expect(page.locator(".save-indicator")).toContainText("Saved");
await page.getByRole("button", { name: "Undo layout" }).click();
await expect(page.locator(".react-flow__edge")).toHaveCount(count);
await expect(page.locator(".save-indicator")).toContainText("Saved");
const pane = page.locator(".react-flow__pane");
await pane.evaluate((el) =>
  el.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 650,
      clientY: 450,
    }),
  ),
);
await page.getByRole("button", { name: "Create screen here" }).click();
await page.getByLabel("Screen title").fill("Canvas position test");
await page
  .getByRole("button", { name: "Add screen", exact: true })
  .last()
  .click();
await expect(
  page.locator(".canvas-screen").filter({ hasText: "Canvas position test" }),
).toBeVisible();
await pane.evaluate((el) =>
  el.dispatchEvent(
    new MouseEvent("dblclick", { bubbles: true, clientX: 700, clientY: 500 }),
  ),
);
await expect(page.getByRole("dialog", { name: "Add a screen" })).toBeVisible();
await page.keyboard.press("Escape");
await page.reload();
await page.getByRole("button", { name: "Canvas", exact: true }).click();
await expect(
  page.locator(".canvas-screen").filter({ hasText: "Canvas position test" }),
).toBeVisible();
await expect(page.locator(".react-flow__edge")).toHaveCount(count);
await page.setViewportSize({ width: 390, height: 844 });
await page.locator(".react-flow__edge").first().dispatchEvent("click");
await expect(
  page.getByRole("button", { name: "Keep connection", exact: true }),
).toBeVisible();
await page
  .getByRole("button", { name: "Keep connection", exact: true })
  .click();
if (errors.length) throw Error(errors.join("\n"));
console.log(
  "PASS: priority ordering, connection confirmation/cancel/delete/undo, context creation, double-click form, refresh persistence and phone dialog",
);
await browser.close();
