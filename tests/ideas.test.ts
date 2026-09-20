import { it, expect } from "vitest";
import { newProject, type Actor } from "../src/lib/model";
import { saveIdea, saveTag, deleteIdea, ideaInput } from "../src/lib/ideas";
const owner: Actor = {
  id: "owner",
  name: "owner",
  role: "owner",
  permissions: [],
};
const partner: Actor = {
  id: "partner",
  name: "partner",
  role: "partner",
  permissions: [],
};
it("persists reusable normalized tags and shared ideas from either member", () => {
  const p = newProject("Ideas", "IDEA");
  partner.projectAccess = { [p.id]: ["view-ideas", "ideas"] };
  expect(saveTag(p, partner, "  App   Store ")).toBe("App Store");
  expect(saveTag(p, owner, "app store")).toBe("App Store");
  expect(
    p.ideaTags?.filter((t) => t.toLowerCase() === "app store"),
  ).toHaveLength(1);
  const idea = saveIdea(
    p,
    partner,
    ideaInput.parse({
      title: "Better onboarding",
      tags: ["APP STORE", "Features"],
    }),
  );
  expect(idea.tags).toEqual(["App Store", "Features"]);
  expect(JSON.parse(JSON.stringify(p)).ideas[0].author).toBe("partner");
  saveIdea(
    p,
    owner,
    ideaInput.parse({ title: "Updated", tags: [] }),
    idea.id,
    1,
  );
  expect(() =>
    saveIdea(p, partner, ideaInput.parse({ title: "Stale" }), idea.id, 1),
  ).toThrow();
  deleteIdea(p, partner, idea.id, 2);
  expect(p.ideas).toHaveLength(0);
  expect(p.ideaTags).toContain("App Store");
});
it("enforces edit ownership and rejects AI writes", () => {
  const p = newProject("Ideas", "IDEA");
  partner.projectAccess = { [p.id]: ["view-ideas", "ideas"] };
  const idea = saveIdea(p, owner, ideaInput.parse({ title: "Owner idea" }));
  expect(() =>
    saveIdea(p, partner, ideaInput.parse({ title: "Changed" }), idea.id, 1),
  ).toThrow();
  expect(() => deleteIdea(p, partner, idea.id, 1)).toThrow();
  expect(() => saveTag(p, { ...owner, role: "ai" }, "New")).toThrow();
  expect(() =>
    saveIdea(p, { ...owner, role: "ai" }, ideaInput.parse({ title: "AI" })),
  ).toThrow();
});
