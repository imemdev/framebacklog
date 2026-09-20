import { describe, it, expect } from "vitest";
import {
  newProject,
  deleteTask,
  recommendScreen,
  screenVersions,
  createTask,
  taskInput,
  progress,
  complete,
  reviewTask,
  type Actor,
} from "../src/lib/model";
const owner: Actor = {
  id: "owner",
  name: "Owner",
  role: "owner",
  permissions: [],
};
const make = () => {
  const p = newProject("Test", "TEST");
  const ai: Actor = {
    id: "ai",
    name: "AI",
    role: "ai",
    projectId: p.id,
    permissions: ["read", "tasks"],
  };
  const t = createTask(p, ai, taskInput.parse({ title: "Do work" }));
  return { p, ai, t };
};
describe("Task workflow shared by UI, REST, and MCP", () => {
  it("preserves unfinished progress and requires a separate completion action", () => {
    const { p, ai, t } = make();
    progress(p, ai, t.id, {
      version: 1,
      status: "In progress",
      progressSummary: "Started",
      remainingWork: "Tests",
      nextStep: "Run tests",
    });
    expect(JSON.parse(JSON.stringify(p)).tasks[0]).toMatchObject({
      status: "In progress",
      nextStep: "Run tests",
    });
  });
  it("rejects AI human review and preserves prior reviews when reopened", () => {
    const { p, ai, t } = make();
    complete(p, ai, t.id, {
      version: 1,
      completionSummary: "Built",
      verification: "Not run: unavailable runtime",
    });
    expect(() =>
      reviewTask(p, ai, t.id, {
        version: 2,
        decision: "approve",
        feedback: "",
      }),
    ).toThrow("human");
    reviewTask(p, owner, t.id, {
      version: 2,
      decision: "approve",
      feedback: "Checked",
    });
    reviewTask(p, owner, t.id, {
      version: 3,
      decision: "reopen",
      feedback: "New requirement",
    });
    expect(t.status).toBe("In progress");
    expect(t.reviews).toHaveLength(2);
  });
  it("requires feedback and returns rejected work to In progress", () => {
    const { p, ai, t } = make();
    complete(p, ai, t.id, {
      version: 1,
      completionSummary: "Built",
      verification: "Passed",
    });
    expect(() =>
      reviewTask(p, owner, t.id, {
        version: 2,
        decision: "changes",
        feedback: "",
      }),
    ).toThrow("Explain");
    reviewTask(p, owner, t.id, {
      version: 2,
      decision: "changes",
      feedback: "Fix focus",
    });
    expect(t.status).toBe("In progress");
  });
  it("rejects stale edits, blockers, incomplete dependencies, and cycles", () => {
    const { p, ai, t } = make();
    expect(() =>
      progress(p, ai, t.id, { version: 9, status: "In progress" }),
    ).toThrow("changed");
    progress(p, ai, t.id, { version: 1, blockerReason: "Missing access" });
    expect(() =>
      complete(p, ai, t.id, {
        version: 2,
        completionSummary: "Done",
        verification: "Pass",
      }),
    ).toThrow("blocker");
    progress(p, ai, t.id, { version: 2, blockerReason: "" });
    const second = createTask(
      p,
      ai,
      taskInput.parse({ title: "Second", dependencies: [t.id] }),
    );
    expect(() =>
      complete(p, ai, second.id, {
        version: 1,
        completionSummary: "Done",
        verification: "Pass",
      }),
    ).toThrow("dependencies");
    expect(() =>
      progress(p, ai, t.id, { version: 3, dependencies: [second.id] }),
    ).toThrow("cycle");
  });
  it("checks project scope and partner restrictions", () => {
    const { p, ai } = make();
    expect(() =>
      createTask(
        p,
        { ...ai, projectId: "another" },
        taskInput.parse({ title: "No" }),
      ),
    ).toThrow("access");
    expect(() =>
      createTask(
        p,
        { ...owner, role: "partner" },
        taskInput.parse({ title: "No" }),
      ),
    ).toThrow("permission");
  });
  it("deduplicates explicitly linked feedback without resolving it", () => {
    const { p, ai } = make();
    const s = {
      id: "screen",
      title: "Screen",
      versions: [
        {
          id: "v",
          number: 1,
          status: "Awaiting review" as const,
          createdAt: new Date().toISOString(),
          reviews: [],
        },
      ],
    };
    p.screens.push(s);
    p.comments.push({
      id: "comment",
      screenId: "screen",
      versionId: "v",
      text: "Fix this",
      actor: "Partner",
      at: new Date().toISOString(),
      resolved: false,
    });
    const input = taskInput.parse({
      title: "Feedback",
      sourceCommentId: "comment",
    });
    const a = createTask(p, ai, input);
    const b = createTask(p, ai, input);
    expect(a.id).toBe(b.id);
    expect(p.comments[0].resolved).toBe(false);
  });
});

it("recommends a screen version without moving its history and rejects stale or AI decisions", () => {
  const { p, ai } = make();
  const partner: Actor = {
    id: "partner",
    name: "partner",
    role: "partner",
    permissions: [],
  };
  partner.projectAccess = { [p.id]: ["view-screens", "screen-review"] };
  p.screens.push({
    id: "screen",
    title: "Welcome",
    versions: [1, 2].map((number) => ({
      id: `v${number}`,
      number,
      status: "Awaiting review",
      createdAt: new Date().toISOString(),
      reviews: [],
    })),
  });
  recommendScreen(p, partner, "screen", "v1", 0);
  expect(screenVersions(p.screens[0]).map((v) => v.id)).toEqual(["v1", "v2"]);
  expect(p.screens[0].versions.map((v) => v.number)).toEqual([1, 2]);
  expect(p.screens[0].versions[0].status).toBe("Awaiting review");
  expect(() => recommendScreen(p, partner, "screen", "v2", 0)).toThrow();
  expect(() => recommendScreen(p, ai, "screen", "v2", 1)).toThrow();
  expect(() => recommendScreen(p, partner, "screen", "missing", 1)).toThrow();
  expect(p.screens[0].recommendation?.versionId).toBe("v1");
  recommendScreen(p, partner, "screen", "v2", 1);
  expect(screenVersions(JSON.parse(JSON.stringify(p.screens[0])))[0].id).toBe(
    "v2",
  );
});

it("lets only owners delete any task status and removes dependency references atomically", () => {
  for (const status of [
    "To do",
    "In progress",
    "Done",
    "Done reviewed",
  ] as const) {
    const { p, t, ai } = make();
    t.status = status;
    const dependent = createTask(
      p,
      owner,
      taskInput.parse({ title: "Depends", dependencies: [t.id] }),
    );
    expect(() => deleteTask(p, ai, t.id, t.version)).toThrow();
    expect(() =>
      deleteTask(p, { ...owner, role: "partner" }, t.id, t.version),
    ).toThrow();
    expect(() => deleteTask(p, owner, t.id, t.version + 1)).toThrow();
    deleteTask(p, owner, t.id, t.version);
    expect(p.tasks.some((task) => task.id === t.id)).toBe(false);
    expect(dependent.dependencies).toEqual([]);
    expect(dependent.version).toBe(2);
    expect(p.activity.at(-1)?.action).toBe("Task deleted");
  }
});
