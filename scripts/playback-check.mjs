import { chromium, expect } from "@playwright/test";
const base = process.env.TEST_URL || "http://localhost:3006";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
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
  page.getByRole("button", { name: "New task", exact: true }),
).toBeVisible();
async function req(path, method = "GET", data) {
  const r = await page.request.fetch(`${base}/api/v1/${path}`, {
    method,
    headers: { Origin: base },
    ...(data ? { data } : {}),
  });
  if (!r.ok()) throw Error(await r.text());
  return r.json();
}
const projects = await req("projects");
const p = await req(`projects/${projects[0].id}/snapshot`);
const j = p.journeys[0];
const ns = j.nodes.slice(0, 5);
if (ns.length < 5) throw Error("Need five screens in disposable fixture");
const edges = [
  [0, 1],
  [1, 2],
  [1, 3],
  [2, 4],
].map(([a, b], i) => ({
  id: `playback-${i}`,
  source: ns[a].id,
  target: ns[b].id,
  label: `Path ${i}`,
}));
await req(`projects/${p.id}/journeys/${j.id}`, "PUT", {
  version: j.version,
  nodes: ns,
  edges,
});
await page.goto(`${base}/?page=journey&project=${p.id}`);
await page.getByRole("button", { name: "Canvas", exact: true }).click();
await page.clock.install();
await page.getByRole("button", { name: "Run journey" }).click();
const title = (i) => p.screens.find((s) => s.id === ns[i].screenId).title;
const current = page.getByRole("region", { name: "Current screen" });
await expect(current.getByRole("heading")).toHaveText(title(0));
await page.getByRole("button", { name: "Pause", exact: true }).click();
await page.clock.fastForward(9000);
await expect(current.getByRole("heading")).toHaveText(title(0));
await page.getByRole("button", { name: "Resume", exact: true }).click();
await page.getByLabel("Playback speed").selectOption("0.5");
await page.clock.fastForward(7000);
await expect(current.getByRole("heading")).toHaveText(title(0));
await page.clock.fastForward(1001);
await expect(current.getByRole("heading")).toHaveText(title(1));
await expect(page.getByRole("region", { name: "Choose a path" })).toBeVisible();
await page.clock.fastForward(20000);
await expect(current.getByRole("heading")).toHaveText(title(1));
await page.getByRole("button", { name: `Path 1 → ${title(2)}` }).click();
await page.getByLabel("Playback speed").selectOption("1.25");
await page.clock.fastForward(3201);
await expect(current.getByRole("heading")).toHaveText(title(4));
await expect(page.getByText("Journey complete", { exact: true })).toBeVisible();
await page.getByRole("button", { name: "Restart", exact: true }).click();
await page.getByLabel("Playback speed").selectOption("0.75");
await page.clock.fastForward(5334);
await expect(current.getByRole("heading")).toHaveText(title(1));
await page.getByRole("button", { name: `Path 2 → ${title(3)}` }).click();
await expect(page.getByText("Journey complete", { exact: true })).toBeVisible();
await page.setViewportSize({ width: 390, height: 844 });
await expect(page.getByLabel("Playback speed")).toBeVisible();
await page.screenshot({ path: "test-results/journey-playback-phone.png" });
if (
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
)
  throw Error("Overflow");
await page.keyboard.press("Escape");
await expect(page.getByRole("dialog")).toHaveCount(0);
if (errors.length) throw Error(errors.join("\n"));
console.log(
  "PASS: pause/resume, four speed options, automatic progression, branch wait and both choices, end/restart, phone and reduced-motion mode",
);
await browser.close();
