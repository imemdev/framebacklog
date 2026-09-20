import { sql } from "./storage";
import { Problem, type Project, type Actor, authorize } from "./model";
export async function readProject(key: string, actor: Actor) {
  authorize(actor, key);
  const [row] = await sql<{ data: string; revision: number }>(
    "SELECT data, revision FROM projects WHERE id=?",
    [key],
  );
  if (!row) throw new Problem(404, "Project not found.");
  return { project: JSON.parse(row.data) as Project, revision: row.revision };
}
export async function mutate<T>(
  key: string,
  actor: Actor,
  fn: (p: Project) => T,
  receipt?: { key: string; fingerprint: string },
): Promise<T> {
  const { project, revision } = await readProject(key, actor);
  for (const [key, value] of Object.entries(project.receipts))
    if (value.at < Date.now() - 86400000) delete project.receipts[key];
  const receiptKey = receipt ? `${actor.id}:${receipt.key}` : undefined;
  if (receiptKey && project.receipts[receiptKey]) {
    const old = project.receipts[receiptKey];
    if (old.fingerprint !== receipt!.fingerprint)
      throw new Problem(
        409,
        "Idempotency key already used for a different request.",
      );
    return old.result as T;
  }
  const result = fn(project);
  if (receiptKey)
    project.receipts[receiptKey] = {
      fingerprint: receipt!.fingerprint,
      result,
      at: Date.now(),
    };
  const data = JSON.stringify(project);
  if (new TextEncoder().encode(data).length > 1500000)
    throw new Problem(
      413,
      "Project data exceeds the 1.5 MB initial edition limit. Export and split the project.",
    );
  const rows = await sql(
    "UPDATE projects SET data=?,revision=revision+1 WHERE id=? AND revision=? RETURNING revision",
    [data, key, revision],
  );
  if (!rows.length)
    throw new Problem(
      409,
      "Another change was saved at the same time. Reload and retry; your changes were not applied.",
    );
  return result;
}
