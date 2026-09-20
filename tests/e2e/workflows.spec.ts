import { test, expect } from "@playwright/test";
const phoneComment = `Phone review ${Date.now()}: explain who can see this project.`;
async function login(page: import("@playwright/test").Page, partner = false) {
  await page.goto("/");
  await page
    .getByLabel("Email address")
    .fill(partner ? "partner@demo.local" : "owner@demo.local");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEMO_PASSWORD || "demo-local-password-2026");
  for (let attempt = 0; attempt < 3; attempt++) {
    const responsePromise = page.waitForResponse((r) =>
      r.url().endsWith("/api/auth/sign-in/email"),
    );
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const response = await responsePromise;
    if (response.status() !== 429) {
      expect(response.ok()).toBe(true);
      break;
    }
    await page.waitForTimeout(
      Math.min(
        20000,
        Number(response.headers()["retry-after"] || 15) * 1000 + 200,
      ),
    );
  }
  await expect(
    page.getByRole("heading", { name: "Backlog", exact: false }),
  ).toBeVisible();
}
test("desktop task: creation, progress, completion, human feedback, review, and context", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const title = `Browser verified task ${Date.now()}`;
  await page.getByLabel("Task title").fill(title);
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("In progress");
  await page
    .getByLabel("Acceptance criteria", { exact: true })
    .fill("Keyboard interaction and readable mobile layout.");
  await page.getByLabel("Progress summary").fill("Implementation is in place.");
  await page.getByLabel("Remaining work").fill("Run verification.");
  await page.getByLabel("Next step").fill("Inspect at phone width.");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.locator(".save-message")).toHaveText("Saved");
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.reload();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(page.getByLabel("Progress summary")).toHaveValue(
    "Implementation is in place.",
  );
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue(
    "In progress",
  );
  await page.getByText("Mark implementation done", { exact: true }).click();
  await page
    .getByLabel("Completion summary", { exact: true })
    .fill("Implemented the requested flow.");
  await page
    .getByLabel("Verification record", { exact: false })
    .fill(
      "Playwright desktop flow passed; phone checked in separate scenario.",
    );
  await page.getByRole("button", { name: "Mark done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mark done reviewed", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Review feedback", { exact: false })
    .fill("Please clarify the empty state.");
  await page
    .getByRole("button", { name: "Request changes", exact: true })
    .click();
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue(
    "In progress",
  );
  await expect(
    page.getByText("Please clarify the empty state.", { exact: true }).first(),
  ).toBeVisible();
  await page.getByText("Mark implementation done", { exact: true }).click();
  await page.getByRole("button", { name: "Mark done", exact: true }).click();
  await page
    .getByRole("button", { name: "Mark done reviewed", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reopen task", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("desktop canvas: save layout, undo/redo, connection forms and refresh", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await page.getByRole("button", { name: "User journey", exact: true }).click();
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await expect(page.locator(".save-indicator")).toHaveText("Saved");
  await page.getByRole("button", { name: "Undo layout" }).click();
  await expect(page.locator(".save-indicator")).toHaveText("Saved");
  await page.getByRole("button", { name: "Redo layout" }).click();
  await expect(page.locator(".save-indicator")).toHaveText("Saved");
  await page.getByRole("button", { name: "Connection", exact: true }).click();
  const options = await page.getByLabel("To screen").locator("option").all();
  await page
    .getByLabel("To screen")
    .selectOption((await options[1].getAttribute("value")) as string);
  await page
    .getByRole("dialog")
    .getByLabel("Connection label")
    .fill("Browser connection");
  await page
    .getByRole("button", { name: "Add connection", exact: true })
    .click();
  await expect(page.locator(".save-indicator")).toHaveText("Saved");
  await page.reload();
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(
    page.getByText("Browser connection", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/canvas-verified.png",
    fullPage: true,
  });
});
test("phone: partner pins, replies, approvals, branch navigation, and no overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page, true);
  await expect(page.locator(".task-list")).toBeVisible();
  await page.getByRole("button", { name: "Journey", exact: true }).click();
  await expect(page.locator(".screen-grid")).toBeVisible();
  await page
    .locator(".screen-open")
    .filter({
      has: page.getByRole("heading", { name: "Create a project", exact: true }),
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Add pin", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Place pin at center (keyboard)",
      exact: true,
    })
    .click();
  await page.getByLabel("Add a comment", { exact: true }).fill(phoneComment);
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(
    page
      .getByText(phoneComment, {
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await page
    .getByLabel("Review note", { exact: false })
    .fill("The sharing explanation needs to be clearer.");
  await page
    .getByRole("button", { name: "Request changes", exact: true })
    .click();
  await expect(page.locator(".save-message")).toHaveText("Saved");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator(".screen-panel-toolbar .review-status")).toHaveText(
    "Approved",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-screen-review.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close panel" }).click();
  await page
    .getByRole("button", { name: "Backlog", exact: true })
    .last()
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-360.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("owner converts feedback to one linked task, uploads replacement, and retains old review", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "User journey", exact: true }).click();
  await page
    .locator(".screen-open")
    .filter({
      has: page.getByRole("heading", { name: "Create a project", exact: true }),
    })
    .click();
  const comment = page
    .locator(".comment")
    .filter({ hasText: phoneComment })
    .first();
  await comment
    .getByRole("button", { name: "Create task", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create task", exact: true })
    .last()
    .click();
  await expect(
    comment.getByRole("button", { name: "View linked task", exact: true }),
  ).toBeVisible();
  await expect(
    comment.getByRole("button", { name: "Resolve", exact: true }),
  ).toBeVisible();
  const oldVersion = await page.getByLabel("Screen version").inputValue();
  await page.locator("input[type=file]").setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.locator(".screen-panel-toolbar .review-status")).toHaveText(
    "Awaiting review",
  );
  await page.getByLabel("Screen version").selectOption(oldVersion);
  await expect(
    page.getByText("You’re viewing an older version.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".screen-panel-toolbar .review-status")).toHaveText(
    "Approved",
  );
});

test("settings: scoped credential, connection test, secret-free kit, and invitation link", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Create credential", exact: true })
    .click();
  await page
    .getByLabel("Credential name")
    .fill(`Browser assistant ${Date.now()}`);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create credential", exact: true })
    .click();
  await expect(page.getByLabel("New API secret")).toBeVisible();
  const secret = await page.getByLabel("New API secret").inputValue();
  expect(secret.startsWith("cb_")).toBe(true);
  await page
    .getByRole("button", { name: "Test connection", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Connection verified");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download connection kit" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("custombacklog-agent-kit.zip");
  await page
    .getByRole("button", { name: "I’ve saved it", exact: true })
    .click();
  await expect(page.getByLabel("New API secret")).toHaveCount(0);
  await page.getByRole("button", { name: "People", exact: true }).click();
  await page
    .getByLabel("Partner’s email")
    .fill(`browser-partner-${Date.now()}@example.test`);
  await page.getByRole("button", { name: "Create invitation link" }).click();
  await expect(page.getByLabel("Invitation link")).toHaveValue(/invite=cb_/);
});

test("phone owner: quick creation, keyboard focus return, and offline draft survives failed save", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const title = `Phone task ${Date.now()}`;
  await page.getByLabel("Task title").fill(title);
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  const card = page.getByRole("button", { name: new RegExp(title) });
  await card.click();
  await page
    .getByLabel("Progress summary")
    .fill("A draft to keep while offline");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/fetch|network|offline/i);
  await expect(page.getByLabel("Progress summary")).toHaveValue(
    "A draft to keep while offline",
  );
  await context.setOffline(false);
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.locator(".save-message")).toHaveText("Saved");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
