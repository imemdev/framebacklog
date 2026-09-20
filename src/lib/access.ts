import { z } from "zod";
import type { Actor } from "./model";
export const permissionOptions = [
  ["view-backlog", "View backlog and task details"],
  ["tasks", "Create/edit tasks and move To do, In progress, Done"],
  ["task-delete", "Delete tasks"],
  ["task-review", "Review tasks and reopen completed work"],
  ["view-screens", "View journey, screenshots and discussions"],
  ["comment", "Add, reply to and resolve screen comments"],
  ["screen-review", "Recommend, approve or request changes on screens"],
  ["upload", "Add screens and upload versions"],
  ["journey-edit", "Create journeys and edit layout/connections"],
  ["view-ideas", "View ideas and tags"],
  ["ideas", "Create ideas/tags and edit/delete own ideas"],
  ["ideas-manage", "Edit/delete anyone’s ideas"],
] as const;
export type Permission = (typeof permissionOptions)[number][0];
export const permissionNames = permissionOptions.map(([key]) => key);
export const grantsInput = z
  .record(
    z.uuid(),
    z.array(z.enum(permissionNames as [Permission, ...Permission[]])).max(12),
  )
  .refine(
    (v) => Object.keys(v).length <= 100,
    "Maximum 100 project assignments.",
  );
export const dependencies: Record<string, string[]> = {
  tasks: ["view-backlog"],
  "task-delete": ["view-backlog"],
  "task-review": ["view-backlog"],
  comment: ["view-screens"],
  "screen-review": ["view-screens"],
  upload: ["view-screens"],
  "journey-edit": ["view-screens"],
  ideas: ["view-ideas"],
  "ideas-manage": ["view-ideas", "ideas"],
};
export function normalizeGrants(input: Record<string, string[]>) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([, values]) => values.length)
      .map(([id, values]) => [
        id,
        [...new Set(values.flatMap((v) => [v, ...(dependencies[v] || [])]))],
      ]),
  );
}
export function can(a: Actor, projectId: string, permission = "read") {
  if (a.role === "owner") return true;
  if (a.role === "ai")
    return a.projectId === projectId && a.permissions.includes(permission);
  const grants = a.projectAccess?.[projectId];
  return (
    !!grants?.length && (permission === "read" || grants.includes(permission))
  );
}
