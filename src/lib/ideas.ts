import { can } from "./access";
import { z } from "zod";
import {
  type Actor,
  type Project,
  Problem,
  assertVersion,
  event,
  id,
  now,
} from "./model";
export const starterTags = ["Marketing", "Mobile app UI", "Features"];
export const tagInput = z.string().trim().min(1).max(40);
export const ideaInput = z
  .object({
    title: z.string().trim().min(1).max(150),
    description: z.string().trim().max(10000).default(""),
    tags: z.array(tagInput).max(12).default([]),
  })
  .strict();
export const ideaSchema = ideaInput.extend({
  id: z.uuid(),
  authorId: z.string(),
  author: z.string().max(100),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.number().int().positive(),
});
export type Idea = z.infer<typeof ideaSchema>;
export function humanIdeas(a: Actor) {
  if (a.role === "ai")
    throw new Problem(403, "Ideas are managed by workspace members.");
}
export function saveTag(p: Project, a: Actor, input: string) {
  humanIdeas(a);
  if (!can(a, p.id, "ideas"))
    throw new Problem(403, "Idea editing is not enabled for this project.");
  const name = tagInput.parse(input).replace(/\s+/g, " ");
  p.ideaTags ||= [...starterTags];
  const found = p.ideaTags.find(
    (tag) => tag.toLowerCase() === name.toLowerCase(),
  );
  if (found) return found;
  if (p.ideaTags.length >= 100)
    throw new Problem(422, "Limit: 100 idea tags per project.");
  p.ideaTags.push(name);
  event(p, a, "Idea tag created", p.id, name);
  return name;
}
export function saveIdea(
  p: Project,
  a: Actor,
  input: z.infer<typeof ideaInput>,
  ideaId?: string,
  version?: number,
) {
  humanIdeas(a);
  if (!can(a, p.id, "ideas"))
    throw new Problem(403, "Idea editing is not enabled for this project.");
  p.ideas ||= [];
  let idea = ideaId ? p.ideas.find((i) => i.id === ideaId) : undefined;
  if (ideaId && !idea) throw new Problem(404, "Idea not found.");
  if (idea) {
    if (!can(a, p.id, "ideas-manage") && idea.authorId !== a.id)
      throw new Problem(403, "Only the author or owner can edit this idea.");
    assertVersion(idea.version, version!);
  } else if (p.ideas.length >= 500)
    throw new Problem(422, "Limit: 500 ideas per project.");
  const tags = [...new Set(input.tags.map((tag) => saveTag(p, a, tag)))];
  const at = now();
  if (idea)
    Object.assign(idea, input, {
      tags,
      version: idea.version + 1,
      updatedAt: at,
    });
  else {
    idea = {
      ...input,
      tags,
      id: id(),
      authorId: a.id,
      author: a.name,
      createdAt: at,
      updatedAt: at,
      version: 1,
    };
    p.ideas.push(idea);
  }
  event(p, a, ideaId ? "Idea updated" : "Idea created", idea.id, idea.title);
  return idea;
}
export function deleteIdea(
  p: Project,
  a: Actor,
  ideaId: string,
  version: number,
) {
  humanIdeas(a);
  if (!can(a, p.id, "ideas"))
    throw new Problem(403, "Idea editing is not enabled for this project.");
  const idea = p.ideas?.find((i) => i.id === ideaId);
  if (!idea) throw new Problem(404, "Idea not found.");
  if (!can(a, p.id, "ideas-manage") && idea.authorId !== a.id)
    throw new Problem(403, "Only the author or owner can delete this idea.");
  assertVersion(idea.version, version);
  p.ideas = p.ideas!.filter((i) => i.id !== ideaId);
  event(p, a, "Idea deleted", ideaId, idea.title);
  return { deleted: true, id: ideaId };
}
