import { z } from "zod";
import { grantsInput, normalizeGrants } from "./access";
import { auth } from "./auth";
import { sql } from "./storage";
import { Problem, owner, type Actor } from "./model";
import { body, json } from "./http";
export async function checkedGrants(input: unknown) {
  const grants = normalizeGrants(grantsInput.parse(input));
  const projects = await sql<{ id: string }>("SELECT id FROM projects");
  if (Object.keys(grants).some((id) => !projects.some((p) => p.id === id)))
    throw new Problem(422, "Select existing projects only.");
  return grants;
}
export async function partnerRequest(req: Request, a: Actor, id?: string) {
  owner(a);
  if (req.method === "GET") {
    const members = await sql<{
      id: string;
      name: string;
      username: string;
      role: string;
      grants: string | null;
      version: number | null;
    }>(
      "SELECT user.id,user.name,user.username,members.role,partner_access.grants,partner_access.version FROM members JOIN user ON user.id=members.user_id LEFT JOIN partner_access ON partner_access.user_id=user.id",
    );
    return json(
      members.map((m) => ({
        ...m,
        grants: JSON.parse(m.grants || "{}"),
        version: m.version || 0,
      })),
    );
  }
  if (req.method === "PATCH" && id) {
    const d = z
      .object({ version: z.number().int().nonnegative(), grants: grantsInput })
      .strict()
      .parse(await body(req));
    const grants = await checkedGrants(d.grants);
    const [member] = await sql(
      "SELECT user_id FROM members WHERE user_id=? AND role='partner'",
      [id],
    );
    if (!member) throw new Problem(404, "Partner not found.");
    const rows = await sql(
      "INSERT INTO partner_access(user_id,grants,version) SELECT ?,?,1 WHERE ?=0 ON CONFLICT(user_id) DO UPDATE SET grants=excluded.grants, version=partner_access.version+1 WHERE partner_access.version=? RETURNING version",
      [id, JSON.stringify(grants), d.version, d.version],
    );
    // Existing rows need a version-checked UPDATE when INSERT's predicate is false.
    if (!rows.length && d.version > 0) {
      const updated = await sql(
        "UPDATE partner_access SET grants=?,version=version+1 WHERE user_id=? AND version=? RETURNING version",
        [JSON.stringify(grants), id, d.version],
      );
      if (!updated.length)
        throw new Problem(
          409,
          "Partner permissions changed. Reload and try again.",
        );
      return json(updated[0]);
    }
    if (!rows.length)
      throw new Problem(
        409,
        "Partner permissions changed. Reload and try again.",
      );
    return json(rows[0]);
  }
  if (req.method === "POST" && !id) {
    const d = z
      .object({
        username: z
          .string()
          .trim()
          .toLowerCase()
          .min(3)
          .max(40)
          .regex(/^[a-z0-9_.-]+$/),
        password: z.string().min(3).max(128),
        grants: grantsInput,
      })
      .strict()
      .parse(await body(req));
    const grants = await checkedGrants(d.grants);
    const result = await (
      await auth()
    ).api.signUpEmail({
      body: {
        email: `${d.username}@users.custombacklog.invalid`,
        username: d.username,
        name: d.username,
        password: d.password,
      },
    });
    try {
      await sql("INSERT INTO partner_access(user_id,grants) VALUES(?,?)", [
        result.user.id,
        JSON.stringify(grants),
      ]);
      await sql("INSERT INTO members(user_id,role) VALUES(?,'partner')", [
        result.user.id,
      ]);
    } catch (e) {
      await sql("DELETE FROM members WHERE user_id=?", [result.user.id]);
      await sql("DELETE FROM user WHERE id=?", [result.user.id]);
      throw e;
    }
    return json({ id: result.user.id, username: d.username }, 201);
  }
  throw new Problem(405, "Use GET/POST partners or PATCH partners/{id}.");
}
