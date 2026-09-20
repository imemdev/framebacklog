import { localDatabase, putLocal } from "../src/lib/local";
import {
  newProject,
  createTask,
  taskInput,
  progress,
  complete,
  reviewTask,
  id,
  now,
  type Actor,
} from "../src/lib/model";
import { betterAuth } from "better-auth";
import { chromium } from "@playwright/test";
if (!process.env.DATA_DIR?.includes("demo"))
  throw new Error(
    "Set DATA_DIR=.data/demo. The demo seed refuses to write to a real installation.",
  );
if (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 12)
  throw new Error("Set DEMO_PASSWORD to a password of at least 12 characters.");
const db = localDatabase();
if (db.prepare("SELECT id FROM installation").get())
  throw new Error(
    "Demo installation already exists. Use a new demo directory.",
  );
const auth = betterAuth({
  database: db,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: "http://localhost:3000",
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
});
const u = await auth.api.signUpEmail({
  body: {
    name: "Alex Morgan",
    email: "owner@demo.local",
    password: process.env.DEMO_PASSWORD,
  },
});
const partner = await auth.api.signUpEmail({
  body: {
    name: "Jamie Chen",
    email: "partner@demo.local",
    password: process.env.DEMO_PASSWORD,
  },
});
db.prepare("INSERT INTO installation(id,email) VALUES(1,?)").run(u.user.email);
db.prepare("INSERT INTO members(user_id,role) VALUES(?,?)").run(
  u.user.id,
  "owner",
);
db.prepare("INSERT INTO members(user_id,role) VALUES(?,?)").run(
  partner.user.id,
  "partner",
);
const owner: Actor = {
  id: u.user.id,
  name: u.user.name,
  role: "owner",
  permissions: [],
};
const p = newProject("Gather • Client portal", "GTH");
p.description = "A welcoming client portal for independent creative teams.";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 840, height: 620 },
  deviceScaleFactor: 1,
});
const titles = [
  "Welcome",
  "Sign in",
  "Your workspace",
  "Create a project",
  "Project overview",
  "Account settings",
];
const subtitles = [
  "Great work starts with a little space.",
  "Welcome back to your creative space.",
  "A little clarity. A lot of possibility.",
  "Let’s make something worth sharing.",
  "Everything in its right place.",
  "Make yourself at home.",
];
for (let i = 0; i < 6; i++) {
  await page.setContent(
    `<html><head><style>*{box-sizing:border-box}body{margin:0;font-family:Arial;color:#223a3e;background:#f8faf7}nav{height:62px;display:flex;align-items:center;justify-content:space-between;padding:0 40px;border-bottom:1px solid #e2e9e0;background:#fff}.logo{font-size:22px;letter-spacing:-1px;font-weight:bold;color:#355e4d}.navlinks{font-size:12px;color:#7d8b83}main{padding:48px 62px}.eyebrow{font-size:10px;letter-spacing:2px;color:#8b9b81;margin-bottom:15px}h1{font-size:34px;font-weight:500;letter-spacing:-1px;margin:0 0 14px}p{font-size:13px;color:#77877c;line-height:1.8}button{background:#365e4b;color:#fff;border:0;padding:14px 22px;border-radius:6px;margin:16px 0}.hero{display:grid;grid-template-columns:1fr 220px;gap:30px}.art{height:255px;background:#e8eedf;border-radius:90px 90px 8px 8px;display:flex;align-items:center;justify-content:center}.art span{display:block;width:110px;height:145px;background:#b0c2a0;border-radius:60px 60px 8px 8px;transform:rotate(-12deg);box-shadow:25px 22px 0 #cfdbc0}.fields{width:370px;margin-top:25px}.label{font-size:11px;margin:12px 0 8px}.input{background:white;border:1px solid #dce4db;border-radius:6px;padding:14px;font-size:11px;color:#a1aba4}.cards{display:flex;gap:15px;margin-top:30px}.card{border:1px solid #dfe7da;background:#fff;border-radius:8px;padding:21px;flex:1;font-size:13px}.swatch{height:70px;border-radius:4px;background:#e9eee4;margin-bottom:15px}.card small{font-size:10px;color:#8b988e}footer{margin-top:36px;font-size:10px;color:#8c9b90}.pill{border:1px solid #d9e4d6;background:#edf4e9;padding:5px 8px;border-radius:4px;font-size:10px;color:#5a7853}</style></head><body><nav><span class="logo">gather<span style="color:#a3b99a">.</span></span><span class="navlinks">Workspace &nbsp;&nbsp;&nbsp; Projects &nbsp;&nbsp;&nbsp; AM</span></nav><main><div class="eyebrow">${i === 0 ? "A SPACE FOR GOOD WORK" : "YOUR CREATIVE WORKSPACE"}</div><div class="${i === 0 ? "hero" : ""}"><div><h1>${titles[i]}</h1><p>${subtitles[i]}</p>${i === 0 ? "<p>Bring your ideas, your projects, and your people<br/>together in one thoughtful space.</p><button>Get started →</button>" : i === 1 || i === 3 || i === 5 ? `<div class="fields"><div class="label">${i === 1 ? "Email address" : i === 3 ? "Project name" : "Full name"}</div><div class="input">${i === 1 ? "you@example.com" : i === 3 ? "e.g. Brand refresh" : "Alex Morgan"}</div><div class="label">${i === 1 ? "Password" : i === 3 ? "A short description" : "Email address"}</div><div class="input">${i === 1 ? "••••••••••••" : i === 3 ? "What are we creating together?" : "alex@example.com"}</div><button>${i === 1 ? "Sign in" : i === 3 ? "Create project" : "Save changes"} →</button></div>` : '<div class="cards"><div class="card"><div class="swatch"></div>Brand refresh<br/><small>Updated today</small></div><div class="card"><div class="swatch" style="background:#efebe2"></div>Spring collection<br/><small>3 new comments</small></div><div class="card"><div class="swatch" style="background:#e3eaf0"></div>Website redesign<br/><small>Ready for your review</small></div></div><button>+ Create a project</button>'}</div>${i === 0 ? '<div class="art"><span></span></div>' : ""}</div><footer>Good things take shape together. &nbsp; <span class="pill">Your space, simplified</span></footer></main></body></html>`,
  );
  const key = id();
  await putLocal(key, new Uint8Array(await page.screenshot()));
  const sid = id();
  p.screens.push({
    id: sid,
    title: titles[i],
    versions: [
      {
        id: id(),
        number: 1,
        key,
        type: "image/png",
        status:
          i === 0 || i === 1
            ? "Approved"
            : i === 3
              ? "Changes requested"
              : "Awaiting review",
        createdAt: now(),
        reviews:
          i < 2
            ? [
                {
                  actor: "Jamie Chen",
                  at: now(),
                  decision: "Approved",
                  feedback: "Clear and welcoming. Ready to go.",
                },
              ]
            : [],
      },
    ],
  });
}
await browser.close();
const welcome = p.screens[0];
welcome.versions.push({
  ...welcome.versions[0],
  id: id(),
  number: 2,
  status: "Awaiting review",
  reviews: [],
});
p.journeys.push({
  id: id(),
  name: "First-time client experience",
  version: 1,
  nodes: p.screens.map((s, i) => ({
    id: s.id,
    screenId: s.id,
    position: { x: (i % 3) * 330, y: Math.floor(i / 3) * 320 },
  })),
  edges: [
    [0, 1, "Get started"],
    [1, 2, "Sign in"],
    [2, 3, "New project"],
    [3, 4, "Create"],
    [2, 5, "Your account"],
  ].map(([a, b, label]) => ({
    id: id(),
    source: p.screens[a as number].id,
    target: p.screens[b as number].id,
    label: String(label),
  })),
});
const c = {
  id: id(),
  screenId: p.screens[3].id,
  versionId: p.screens[3].versions[0].id,
  text: "Could we explain who can see a project before someone creates it?",
  actor: "Jamie Chen",
  at: now(),
  resolved: false,
  pin: { x: 0.46, y: 0.69 },
};
p.comments.push(c, {
  id: id(),
  screenId: p.screens[2].id,
  versionId: p.screens[2].versions[0].id,
  text: "The project cards are easy to scan. Love the calmer layout.",
  actor: "Jamie Chen",
  at: now(),
  resolved: false,
});
const tasks = [
  [
    "Clarify project visibility before creation",
    "High",
    "Alex Morgan",
    3,
    "To do",
  ],
  [
    "Add a helpful empty state for new clients",
    "Medium",
    "AI Assistant",
    2,
    "To do",
  ],
  ["Write the welcome screen copy", "Low", "Jamie Chen", 0, "To do"],
  ["Build the project creation form", "High", "AI Assistant", 3, "In progress"],
  ["Connect workspace invitations", "High", "Alex Morgan", 2, "In progress"],
  ["Improve keyboard navigation on sign in", "High", "AI Assistant", 1, "Done"],
  ["Save account preferences", "Medium", "Alex Morgan", 5, "Done"],
  [
    "Create the reusable project card",
    "Medium",
    "AI Assistant",
    4,
    "Done reviewed",
  ],
  ["Set up accessible form fields", "Low", "Alex Morgan", 1, "Done reviewed"],
];
for (const [title, priority, assignee, screenIndex, status] of tasks) {
  const t = createTask(
    p,
    owner,
    taskInput.parse({
      title,
      priority,
      assignee,
      screenIds: [p.screens[screenIndex as number].id],
      description: `${title}. Keep the experience simple and welcoming for first-time clients.`,
      acceptanceCriteria:
        "Works at phone and desktop widths. Keyboard users can complete the flow. Errors explain the next step.",
      sourceCommentId: title === tasks[0][0] ? c.id : undefined,
    }),
  );
  if (status !== "To do")
    progress(p, owner, t.id, {
      version: t.version,
      status: "In progress",
      progressSummary:
        "The core implementation is in place. Responsive behavior is being checked.",
      remainingWork: "Finish validation and run the critical browser flow.",
      nextStep: "Check keyboard interaction and submit behavior.",
    });
  if (status === "Done" || status === "Done reviewed") {
    complete(p, owner, t.id, {
      version: t.version,
      completionSummary:
        "Implemented the full interaction, including validation and responsive layouts.",
      verification:
        "Demo evidence only: illustrates where actual test results belong. No production checks are implied.",
    });
    if (status === "Done reviewed")
      reviewTask(p, owner, t.id, {
        version: t.version,
        decision: "approve",
        feedback:
          "Demo review: the interaction is clear and the details look consistent.",
      });
  }
  if (title === "Connect workspace invitations")
    progress(p, owner, t.id, {
      version: t.version,
      blockerReason: "Waiting for invitation copy",
      nextStep: "Agree on the welcome message with Jamie.",
    });
}
db.prepare("INSERT INTO projects(id,data) VALUES(?,?)").run(
  p.id,
  JSON.stringify(p),
);
console.log(
  `Demo ready: ${p.name}. Sign in as owner@demo.local or partner@demo.local using your DEMO_PASSWORD. No real workspace was modified.`,
);
