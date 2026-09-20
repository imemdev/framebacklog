import { it, expect } from "vitest";
import { can, normalizeGrants, permissionNames } from "../src/lib/access";
import {
  authorize,
  newProject,
  createTask,
  taskInput,
  complete,
  reviewTask,
  type Actor,
} from "../src/lib/model";
it("fails closed for partners and isolates selected project grants", () => {
  const partner: Actor = {
    id: "p",
    name: "Partner",
    role: "partner",
    permissions: [],
  };
  expect(() => authorize(partner, "a")).toThrow();
  partner.projectAccess = normalizeGrants({ a: ["tasks"], b: ["comment"] });
  expect(can(partner, "a", "view-backlog")).toBe(true);
  expect(can(partner, "a", "view-screens")).toBe(false);
  expect(can(partner, "b", "tasks")).toBe(false);
  expect(can(partner, "c")).toBe(false);
  expect(() => authorize(partner, "b", "upload")).toThrow();
});
it("explicit human review grants work without owner/admin promotion", () => {
  const p = newProject("Delegated", "DLG");
  const a: Actor = {
    id: "p",
    name: "Partner",
    role: "partner",
    permissions: [],
    projectAccess: { [p.id]: [...permissionNames] },
  };
  const t = createTask(p, a, taskInput.parse({ title: "Work" }));
  complete(p, a, t.id, {
    version: 1,
    completionSummary: "Finished",
    verification: "Not run: test fixture",
  });
  reviewTask(p, a, t.id, {
    version: 2,
    decision: "approve",
    feedback: "Checked",
  });
  expect(t.status).toBe("Done reviewed");
  expect(a.role).toBe("partner");
});
