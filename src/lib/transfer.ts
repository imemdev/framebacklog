import { z } from "zod";
import {
  type Actor,
  type Project,
  owner,
  taskInput,
  layoutInput,
  commentInput,
  statuses,
  Problem,
  id,
} from "./model";
import { readProject } from "./repository";
import { body, json, imageType } from "./http";
import { getFile, putFile, sql } from "./storage";
const review = z.object({
  actor: z.string().max(100),
  at: z.iso.datetime(),
  decision: z.string().max(100),
  feedback: z.string().max(10000),
});
const version = z.object({
  id: z.uuid(),
  number: z.number().int().positive(),
  key: z.uuid().optional(),
  type: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
  status: z.enum(["Awaiting review", "Approved", "Changes requested"]),
  createdAt: z.iso.datetime(),
  reviews: z.array(review).max(100),
});
const task = taskInput.extend({
  id: z.uuid(),
  readableId: z.string().max(50),
  status: z.enum(statuses),
  version: z.number().int().positive(),
  progressSummary: z.string().max(10000),
  remainingWork: z.string().max(10000),
  nextStep: z.string().max(10000),
  blockerReason: z.string().max(10000),
  completionSummary: z.string().max(10000),
  verification: z.string().max(10000),
  reviews: z.array(review).max(100),
  comments: z
    .array(
      z.object({
        id: z.uuid(),
        text: z.string().max(4000),
        actor: z.string().max(100),
        at: z.iso.datetime(),
      }),
    )
    .max(100)
    .default([]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const project = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100),
  prefix: z.string().regex(/^[A-Z]{2,6}$/),
  description: z.string().max(10000),
  nextTask: z.number().int().positive(),
  tasks: z.array(task).max(500),
  screens: z
    .array(
      z.object({
        id: z.uuid(),
        title: z.string().max(150),
        versions: z.array(version).min(1).max(20),
      }),
    )
    .max(100),
  journeys: z
    .array(layoutInput.extend({ id: z.uuid(), name: z.string().max(100) }))
    .max(20),
  comments: z
    .array(
      commentInput.extend({
        id: z.uuid(),
        actor: z.string().max(100),
        at: z.iso.datetime(),
        resolved: z.boolean(),
      }),
    )
    .max(1000),
  activity: z
    .array(
      z.object({
        cursor: z.number().int(),
        actor: z.string(),
        at: z.iso.datetime(),
        action: z.string(),
        entityId: z.string(),
        detail: z.string(),
      }),
    )
    .max(1000),
  sequence: z.number().int().nonnegative(),
});
export async function transfer(req: Request, a: Actor, projectId: string) {
  owner(a);
  if (req.method === "GET") {
    const { project: p } = await readProject(projectId, a);
    const files: Record<string, string> = {};
    let total = 0;
    for (const v of p.screens.flatMap((s) => s.versions)) {
      if (v.key) {
        const bytes = await getFile(v.key);
        total += bytes.length;
        if (total > 10 * 1024 * 1024)
          throw new Problem(
            413,
            "Portable export currently supports 10 MB of screenshots. Use a full backup for larger projects.",
          );
        files[v.key] = Buffer.from(bytes).toString("base64");
      }
    }
    return new Response(
      JSON.stringify({
        format: "custombacklog-project",
        version: 1,
        project: { ...p, receipts: undefined },
        files,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${p.prefix}-export.json"`,
          "Cache-Control": "private, no-store",
        },
      },
    );
  }
  if (req.method !== "POST")
    throw new Problem(405, "Use GET export or POST import.");
  await readProject(projectId, a);
  const data = z
    .object({
      format: z.literal("custombacklog-project"),
      version: z.literal(1),
      project,
      files: z.record(z.uuid(), z.string().max(7 * 1024 * 1024)),
    })
    .strict()
    .parse(await body(req, 15 * 1024 * 1024));
  const p = {
    ...data.project,
    id: id(),
    name: `${data.project.name} (imported)`,
    receipts: {},
  } as Project;
  const taskIds = new Set(p.tasks.map((t) => t.id));
  const screenIds = new Set(p.screens.map((s) => s.id));
  const comments = new Set(p.comments.map((c) => c.id));
  const versions = new Set(
    p.screens.flatMap((s) => s.versions.map((v) => v.id)),
  );
  if (
    taskIds.size !== p.tasks.length ||
    screenIds.size !== p.screens.length ||
    comments.size !== p.comments.length
  )
    throw new Problem(422, "Duplicate identifiers in import.");
  const { checkDependencies } = await import("./model");
  if (
    new Set(p.tasks.map((t) => t.readableId)).size !== p.tasks.length ||
    new Set(p.journeys.map((j) => j.id)).size !== p.journeys.length
  )
    throw new Problem(422, "Duplicate readable task or journey IDs.");
  p.nextTask = Math.max(
    p.nextTask,
    ...p.tasks
      .map((t) => Number(t.readableId.split("-").at(-1)) + 1)
      .filter(Number.isFinite),
  );
  for (const s of p.screens)
    if (s.versions.some((v, i) => v.number !== i + 1))
      throw new Problem(
        422,
        "Screen versions must have consecutive version numbers.",
      );
  for (const t of p.tasks) {
    checkDependencies(p, t);
    if (
      t.screenIds.some((s) => !screenIds.has(s)) ||
      (t.sourceCommentId && !comments.has(t.sourceCommentId))
    )
      throw new Problem(422, "Invalid task relationship.");
  }
  for (const c of p.comments)
    if (
      !p.screens
        .find((s) => s.id === c.screenId)
        ?.versions.some((v) => v.id === c.versionId) ||
      (c.parentId &&
        !p.comments.some(
          (parent) =>
            parent.id === c.parentId &&
            !parent.parentId &&
            parent.versionId === c.versionId &&
            parent.screenId === c.screenId,
        ))
    )
      throw new Problem(422, "Invalid comment relationship.");
  for (const j of p.journeys) {
    const ids = new Set(j.nodes.map((n) => n.id));
    if (
      ids.size !== j.nodes.length ||
      new Set(j.edges.map((e) => e.id)).size !== j.edges.length
    )
      throw new Problem(422, "Duplicate journey node or edge IDs.");
    if (
      j.nodes.some((n) => !screenIds.has(n.screenId)) ||
      j.edges.some((e) => !ids.has(e.source) || !ids.has(e.target))
    )
      throw new Problem(422, "Invalid journey relationship.");
  }
  if (versions.size !== p.screens.reduce((n, s) => n + s.versions.length, 0))
    throw new Problem(422, "Duplicate screen version IDs.");
  let total = 0;
  const uploads: { key: string; bytes: Uint8Array; type: string }[] = [];
  for (const v of p.screens.flatMap((s) => s.versions)) {
    if (v.key) {
      const encoded = data.files[v.key];
      if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
        throw new Problem(422, "Missing or invalid screenshot data.");
      const bytes = new Uint8Array(Buffer.from(encoded, "base64"));
      total += bytes.length;
      if (bytes.length > 5 * 1024 * 1024 || total > 10 * 1024 * 1024)
        throw new Problem(413, "Import screenshot limits exceeded.");
      v.type = imageType(bytes);
      v.key = id();
      uploads.push({ key: v.key, bytes, type: v.type });
    }
  }
  const serialized = JSON.stringify(p);
  if (new TextEncoder().encode(serialized).length > 1500000)
    throw new Problem(413, "Project metadata is too large.");
  for (const file of uploads) await putFile(file.key, file.bytes, file.type);
  await sql("INSERT INTO projects(id,data) VALUES(?,?)", [p.id, serialized]);
  return json({ id: p.id }, 201);
}
