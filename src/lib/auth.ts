import { betterAuth } from "better-auth";
import { bindings, settings, sql } from "./storage";
import { Problem, type Actor } from "./model";
export async function auth() {
  const env = await bindings();
  const config = await settings();
  if (!config.secret || config.secret.length < 32)
    throw new Problem(
      503,
      "Set BETTER_AUTH_SECRET to at least 32 random characters before starting.",
    );
  const database = env?.DB || (await import("@/lib/local")).localDatabase();
  return betterAuth({
    database,
    baseURL: config.url,
    secret: config.secret,
    emailAndPassword: { enabled: true, minPasswordLength: 12 },
    trustedOrigins: [config.url],
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, window: 60, max: 30 },
    advanced: { useSecureCookies: config.url.startsWith("https:") },
  });
}
export async function digest(value: string) {
  return Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  ).toString("hex");
}
export function secret() {
  return `cb_${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url")}`;
}
export async function csrf(req: Request) {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    !req.headers.get("authorization")?.startsWith("Bearer ")
  ) {
    const { url } = await settings();
    if (req.headers.get("origin") !== new URL(url).origin)
      throw new Problem(
        403,
        "Browser mutations require the configured application Origin.",
      );
  }
}
export async function actor(req: Request): Promise<Actor> {
  const bearer = req.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    const [c] = await sql<{
      id: string;
      project_id: string;
      name: string;
      permissions: string;
      expires: number | null;
      revoked: number;
    }>("SELECT * FROM credentials WHERE hash=?", [
      await digest(bearer.slice(7)),
    ]);
    if (!c || c.revoked || (c.expires && c.expires < Date.now()))
      throw new Problem(401, "Credential is invalid, expired, or revoked.");
    await sql("UPDATE credentials SET last_used=? WHERE id=?", [
      Date.now(),
      c.id,
    ]);
    return {
      id: c.id,
      name: c.name,
      role: "ai",
      projectId: c.project_id,
      permissions: JSON.parse(c.permissions),
    };
  }
  const session = await (await auth()).api.getSession({ headers: req.headers });
  if (!session) throw new Problem(401, "Sign in to continue.");
  const [m] = await sql<{ role: "owner" | "partner" }>(
    "SELECT role FROM members WHERE user_id=?",
    [session.user.id],
  );
  if (!m) throw new Problem(403, "This account is not a workspace member.");
  return {
    id: session.user.id,
    name: session.user.name,
    role: m.role,
    permissions: [],
  };
}
export async function limit(key: string, max = 120) {
  const time = Date.now();
  const [row] = await sql<{ count: number }>(
    "INSERT INTO rate_limits(key,count,reset) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset<? THEN 1 ELSE count+1 END,reset=CASE WHEN reset<? THEN ? ELSE reset END RETURNING count",
    [key, time + 60000, time, time, time + 60000],
  );
  if (row.count > max)
    throw new Problem(429, "Too many requests. Retry after 60 seconds.");
}
