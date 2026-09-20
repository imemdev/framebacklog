import { can } from "./access";
import { z } from "zod";
export const statuses = [
  "To do",
  "In progress",
  "Done",
  "Done reviewed",
] as const;
export const priorities = ["Low", "Medium", "High", "Urgent"] as const;
const text = z.string().max(10000);
export const taskInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: text.default(""),
    acceptanceCriteria: text.default(""),
    priority: z.enum(priorities).default("Medium"),
    assignee: z.string().max(100).default(""),
    dependencies: z.array(z.string()).max(50).default([]),
    screenIds: z.array(z.string()).max(30).default([]),
    sourceCommentId: z.string().optional(),
  })
  .strict();
export const progressInput = z
  .object({
    version: z.number().int().positive(),
    status: z.enum(["To do", "In progress"]).optional(),
    progressSummary: text.optional(),
    remainingWork: text.optional(),
    nextStep: text.optional(),
    blockerReason: text.optional(),
    title: z.string().trim().min(1).max(200).optional(),
    description: text.optional(),
    acceptanceCriteria: text.optional(),
    priority: z.enum(priorities).optional(),
    assignee: z.string().max(100).optional(),
    dependencies: z.array(z.string()).max(50).optional(),
    screenIds: z.array(z.string()).max(30).optional(),
  })
  .strict();
export const completionInput = z
  .object({
    version: z.number().int().positive(),
    completionSummary: z.string().trim().min(1).max(10000),
    verification: z.string().trim().min(1).max(10000),
  })
  .strict();
export const reviewInput = z
  .object({
    version: z.number().int().positive(),
    decision: z.enum(["approve", "changes", "reopen"]),
    feedback: text.default(""),
  })
  .strict();
export const commentInput = z
  .object({
    screenId: z.string(),
    versionId: z.string(),
    text: z.string().trim().min(1).max(4000),
    parentId: z.string().optional(),
    pin: z
      .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
      .optional(),
  })
  .strict();
export const layoutInput = z
  .object({
    version: z.number().int().positive(),
    nodes: z
      .array(
        z.object({
          id: z.string(),
          screenId: z.string(),
          position: z.object({
            x: z.number().finite().min(-50000).max(50000),
            y: z.number().finite().min(-50000).max(50000),
          }),
        }),
      )
      .max(100),
    edges: z
      .array(
        z.object({
          id: z.string(),
          source: z.string(),
          target: z.string(),
          label: z.string().max(100),
        }),
      )
      .max(300),
  })
  .strict();
export type Actor = {
  id: string;
  name: string;
  role: "owner" | "partner" | "ai";
  projectId?: string;
  projectAccess?: Record<string, string[]>;
  permissions: string[];
};
export type Review = {
  actor: string;
  at: string;
  decision: string;
  feedback: string;
};
export type Task = z.infer<typeof taskInput> & {
  id: string;
  readableId: string;
  status: (typeof statuses)[number];
  version: number;
  progressSummary: string;
  remainingWork: string;
  nextStep: string;
  blockerReason: string;
  completionSummary: string;
  verification: string;
  reviews: Review[];
  comments: { id: string; text: string; actor: string; at: string }[];
  createdAt: string;
  updatedAt: string;
};
export type ScreenVersion = {
  id: string;
  number: number;
  key?: string;
  type?: string;
  status: "Awaiting review" | "Approved" | "Changes requested";
  createdAt: string;
  reviews: Review[];
};
export type Screen = {
  id: string;
  title: string;
  versions: ScreenVersion[];
  recommendation?: { versionId: string; actor: string; at: string };
  recommendationVersion?: number;
};
export function screenVersions(screen: Screen) {
  const versions = screen.versions.toReversed();
  const preferred = versions.find(
    (v) => v.id === screen.recommendation?.versionId,
  );
  return preferred
    ? [preferred, ...versions.filter((v) => v.id !== preferred.id)]
    : versions;
}
export function recommendScreen(
  p: Project,
  a: Actor,
  screenId: string,
  versionId: string,
  version: number,
) {
  authorize(a, p.id, "screen-review");
  if (a.role === "ai")
    throw new Problem(403, "Recommendations require a human reviewer.");
  const screen = p.screens.find((s) => s.id === screenId);
  if (!screen?.versions.some((v) => v.id === versionId))
    throw new Problem(404, "Screen version not found.");
  assertVersion(screen.recommendationVersion || 0, version);
  screen.recommendation = { versionId, actor: a.name, at: now() };
  screen.recommendationVersion = version + 1;
  event(p, a, "Screen version recommended", screenId, versionId);
  return { ok: true, version: screen.recommendationVersion };
}
export type Comment = z.infer<typeof commentInput> & {
  id: string;
  actor: string;
  at: string;
  resolved: boolean;
};
export type Journey = {
  id: string;
  name: string;
  version: number;
  nodes: z.infer<typeof layoutInput>["nodes"];
  edges: z.infer<typeof layoutInput>["edges"];
};
export type Activity = {
  cursor: number;
  actor: string;
  at: string;
  action: string;
  entityId: string;
  detail: string;
};
export type Project = {
  ideas?: import("./ideas").Idea[];
  ideaTags?: string[];
  id: string;
  name: string;
  prefix: string;
  description: string;
  nextTask: number;
  tasks: Task[];
  screens: Screen[];
  journeys: Journey[];
  comments: Comment[];
  activity: Activity[];
  sequence: number;
  receipts: Record<
    string,
    { fingerprint: string; result: unknown; at: number }
  >;
};
export class Problem extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export function newProject(name: string, prefix: string): Project {
  return {
    id: id(),
    name,
    prefix,
    description: "A shared space for thoughtful product work.",
    nextTask: 1,
    tasks: [],
    screens: [],
    journeys: [],
    comments: [],
    activity: [],
    sequence: 0,
    receipts: {},
  };
}
export function authorize(
  actor: Actor,
  projectId: string,
  permission = "read",
) {
  if (
    actor.role === "ai" &&
    (actor.projectId !== projectId || !actor.permissions.includes(permission))
  )
    throw new Problem(
      403,
      "This credential does not have access to this project or operation.",
    );
  if (actor.role === "partner" && !can(actor, projectId, permission))
    throw new Problem(403, "You do not have this permission for this project.");
}
export function owner(actor: Actor) {
  if (actor.role !== "owner")
    throw new Problem(403, "Only a human owner can perform this action.");
}
export function event(
  p: Project,
  a: Actor,
  action: string,
  entityId: string,
  detail = "",
) {
  p.activity.push({
    cursor: ++p.sequence,
    actor: a.name,
    at: now(),
    action,
    entityId,
    detail,
  });
  p.activity = p.activity.slice(-1000);
}
export function findTask(p: Project, key: string) {
  const t = p.tasks.find((t) => t.id === key || t.readableId === key);
  if (!t) throw new Problem(404, "Task not found.");
  return t;
}
export function assertVersion(actual: number, expected: number) {
  if (actual !== expected)
    throw new Problem(
      409,
      "This item changed. Reload the latest version, compare your draft, and try again.",
      { currentVersion: actual },
    );
}
export function checkDependencies(p: Project, task: Task) {
  for (const dep of task.dependencies)
    if (!p.tasks.some((t) => t.id === dep))
      throw new Problem(
        422,
        "Dependencies must reference tasks in this project.",
      );
  const visited = new Set<string>();
  const lookup = new Map(p.tasks.map((t) => [t.id, t]));
  const visit = (current: string, path: Set<string>) => {
    if (path.has(current))
      throw new Problem(422, "This dependency would create a cycle.");
    if (visited.has(current)) return;
    const t = lookup.get(current);
    if (t)
      for (const d of t.dependencies) visit(d, new Set([...path, current]));
    visited.add(current);
  };
  visit(task.id, new Set());
}
export function createTask(
  p: Project,
  a: Actor,
  input: z.infer<typeof taskInput>,
) {
  authorize(a, p.id, "tasks");
  if (p.tasks.length >= 500)
    throw new Problem(
      422,
      "This project has reached the initial 500-task limit. Export or create a new project.",
    );
  if (input.sourceCommentId) {
    const c = p.comments.find((c) => c.id === input.sourceCommentId);
    if (!c) throw new Problem(422, "Source comment not found.");
    const existing = p.tasks.find((t) => t.sourceCommentId === c.id);
    if (existing) return existing;
    input.screenIds = [...new Set([...input.screenIds, c.screenId])];
  }
  if (input.screenIds.some((id) => !p.screens.some((s) => s.id === id)))
    throw new Problem(422, "Linked screen not found.");
  const t: Task = {
    ...input,
    id: id(),
    readableId: `${p.prefix}-${p.nextTask++}`,
    status: "To do",
    version: 1,
    progressSummary: "",
    remainingWork: "",
    nextStep: "",
    blockerReason: "",
    completionSummary: "",
    verification: "",
    reviews: [],
    comments: [],
    createdAt: now(),
    updatedAt: now(),
  };
  p.tasks.push(t);
  checkDependencies(p, t);
  event(p, a, "Task created", t.id, t.title);
  return t;
}
export function progress(
  p: Project,
  a: Actor,
  key: string,
  input: z.infer<typeof progressInput>,
) {
  authorize(a, p.id, "tasks");
  const t = findTask(p, key);
  assertVersion(t.version, input.version);
  if (["Done", "Done reviewed"].includes(t.status))
    throw new Problem(
      422,
      "Reopen or request changes before editing completed work.",
    );
  const { version, ...patch } = input;
  Object.assign(t, patch);
  checkDependencies(p, t);
  if (t.screenIds.some((id) => !p.screens.some((s) => s.id === id)))
    throw new Problem(422, "Linked screen not found.");
  t.version++;
  t.updatedAt = now();
  event(p, a, "Progress updated", t.id, JSON.stringify(patch));
  return t;
}
export function complete(
  p: Project,
  a: Actor,
  key: string,
  input: z.infer<typeof completionInput>,
) {
  authorize(a, p.id, "tasks");
  const t = findTask(p, key);
  assertVersion(t.version, input.version);
  if (t.status === "Done reviewed")
    throw new Problem(
      422,
      "Reviewed work must be explicitly reopened by its owner.",
    );
  const incomplete = t.dependencies.filter(
    (d) => !["Done", "Done reviewed"].includes(findTask(p, d).status),
  );
  if (incomplete.length)
    throw new Problem(
      422,
      "Complete dependencies before marking this task Done.",
      { incomplete },
    );
  if (t.blockerReason)
    throw new Problem(422, "Clear the blocker before marking Done.");
  t.status = "Done";
  t.completionSummary = input.completionSummary;
  t.verification = input.verification;
  t.version++;
  t.updatedAt = now();
  event(p, a, "Task completed", t.id, input.completionSummary);
  return t;
}
export function reviewTask(
  p: Project,
  a: Actor,
  key: string,
  input: z.infer<typeof reviewInput>,
) {
  if (a.role === "ai") throw new Problem(403, "Task review requires a human.");
  authorize(a, p.id, "task-review");
  const t = findTask(p, key);
  assertVersion(t.version, input.version);
  if (input.decision !== "approve" && !input.feedback.trim())
    throw new Problem(
      422,
      "Explain the changes needed or why work is being reopened.",
    );
  if (input.decision === "reopen") {
    if (!["Done", "Done reviewed"].includes(t.status))
      throw new Problem(422, "Only completed work can be reopened.");
  } else if (t.status !== "Done")
    throw new Problem(422, "Only Done tasks are ready for review.");
  t.status = input.decision === "approve" ? "Done reviewed" : "In progress";
  t.reviews.push({
    actor: a.name,
    at: now(),
    decision: input.decision,
    feedback: input.feedback,
  });
  t.version++;
  t.updatedAt = now();
  event(
    p,
    a,
    input.decision === "approve" ? "Task reviewed" : "Changes requested",
    t.id,
    input.feedback,
  );
  return t;
}

export function deleteTask(
  p: Project,
  a: Actor,
  taskId: string,
  version: number,
) {
  if (a.role === "ai")
    throw new Problem(403, "Task deletion requires a human.");
  authorize(a, p.id, "task-delete");
  const task = findTask(p, taskId);
  assertVersion(task.version, version);
  p.tasks = p.tasks.filter((t) => t.id !== taskId);
  for (const dependent of p.tasks) {
    if (dependent.dependencies.includes(taskId)) {
      dependent.dependencies = dependent.dependencies.filter(
        (id) => id !== taskId,
      );
      dependent.version += 1;
      dependent.updatedAt = now();
      event(p, a, "Deleted dependency removed", dependent.id, task.readableId);
    }
  }
  event(p, a, "Task deleted", taskId, `${task.readableId}: ${task.title}`);
  return { deleted: true, id: taskId };
}
