import { describe, it, expect } from "vitest";
import {
  newProject,
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
    ).toThrow("human owner");
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
    ).toThrow("owner");
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
