import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { hashPassword, verifyPassword } from "better-auth/crypto";

export type LocalOwnerOptions = { username: string; password: string };

export function localOwnerOptions(
  env: Readonly<Record<string, string | undefined>> = process.env,
): LocalOwnerOptions | undefined {
  const username = env.LOCAL_OWNER_USERNAME;
  const password = env.LOCAL_OWNER_PASSWORD;
  if (username === undefined && password === undefined) return undefined;
  if (env.STORAGE_TARGET === "cloudflare" || env.CF_BUILD === "1")
    throw new Error("Local owner configuration only supports Node SQLite.");
  if (username === undefined || password === undefined)
    throw new Error(
      "Set both LOCAL_OWNER_USERNAME and LOCAL_OWNER_PASSWORD, or neither.",
    );
  return validateOptions({ username, password });
}

function validateOptions(options: LocalOwnerOptions): LocalOwnerOptions {
  const username = options.username.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,40}$/.test(username))
    throw new Error(
      "LOCAL_OWNER_USERNAME must contain 3–40 letters, numbers, dots, underscores or hyphens.",
    );
  if (options.password.length < 3 || options.password.length > 128)
    throw new Error("LOCAL_OWNER_PASSWORD must contain 3–128 characters.");
  return { username, password: options.password };
}

type Owner = {
  id: string;
  email: string;
  username: string | null;
  displayUsername: string | null;
};
type Credential = { id: string; password: string | null };

function snapshot(db: DatabaseSync, username: string) {
  const owners = db
    .prepare(
      "SELECT u.id,u.email,u.username,u.displayUsername FROM members m LEFT JOIN user u ON u.id=m.user_id WHERE m.role='owner' ORDER BY m.user_id",
    )
    .all() as unknown as Owner[];
  if (owners.length > 1 || (owners.length === 1 && !owners[0].id))
    throw new Error("The installation must have at most one valid owner.");
  const owner = owners[0];
  const installation = db
    .prepare("SELECT email FROM installation WHERE id=1")
    .get() as { email: string } | undefined;
  if (installation && (!owner || installation.email !== owner.email))
    throw new Error(
      "The installation reservation does not match an existing owner. No accounts were changed.",
    );
  const collision = db
    .prepare("SELECT id FROM user WHERE lower(username)=? AND id<>?")
    .get(username, owner?.id || "");
  if (collision)
    throw new Error("LOCAL_OWNER_USERNAME belongs to another account.");
  const email = `${username}@users.custombacklog.invalid`;
  if (
    !owner &&
    db.prepare("SELECT id FROM user WHERE lower(email)=?").get(email)
  )
    throw new Error("The local owner's email belongs to another account.");
  const credentials = owner
    ? (db
        .prepare(
          "SELECT id,password FROM account WHERE userId=? AND providerId='credential' ORDER BY id",
        )
        .all(owner.id) as unknown as Credential[])
    : [];
  if (credentials.length > 1)
    throw new Error("The owner has multiple password accounts.");
  return { owner, installation, credential: credentials[0], email };
}

/** Call before starting the local server, after applying the SQLite migrations. */
export async function ensureLocalOwner(
  db: DatabaseSync,
  input: LocalOwnerOptions,
): Promise<"created" | "updated" | "unchanged"> {
  const options = validateOptions(input);
  const before = snapshot(db, options.username);
  const passwordMatches = before.credential?.password
    ? await verifyPassword({
        hash: before.credential.password,
        password: options.password,
      })
    : false;
  const changed =
    !before.owner ||
    before.owner.username !== options.username ||
    !passwordMatches;
  // Password hashing is asynchronous; finish it before holding SQLite's lock.
  const passwordHash = passwordMatches
    ? before.credential!.password!
    : await hashPassword(options.password);
  db.exec("BEGIN IMMEDIATE");
  try {
    if (
      JSON.stringify(snapshot(db, options.username)) !== JSON.stringify(before)
    )
      throw new Error(
        "Owner configuration changed concurrently. Retry startup.",
      );
    const time = Date.now();
    const ownerId = before.owner?.id || randomUUID();
    if (!before.owner) {
      db.prepare(
        "INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt,username,displayUsername) VALUES(?,?,?,0,?,?,?,?)",
      ).run(
        ownerId,
        options.username,
        before.email,
        time,
        time,
        options.username,
        options.username,
      );
      db.prepare("INSERT INTO members(user_id,role) VALUES(?,'owner')").run(
        ownerId,
      );
    } else if (changed) {
      db.prepare(
        "UPDATE user SET username=?,displayUsername=?,updatedAt=? WHERE id=?",
      ).run(options.username, options.username, time, ownerId);
    }
    if (!before.credential) {
      db.prepare(
        "INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,'credential',?,?,?,?)",
      ).run(randomUUID(), ownerId, ownerId, passwordHash, time, time);
    } else if (!passwordMatches) {
      db.prepare("UPDATE account SET password=?,updatedAt=? WHERE id=?").run(
        passwordHash,
        time,
        before.credential.id,
      );
    }
    if (!before.installation)
      db.prepare("INSERT INTO installation(id,email) VALUES(1,?)").run(
        before.owner?.email || before.email,
      );
    if (changed && before.owner)
      db.prepare("DELETE FROM session WHERE userId=?").run(ownerId);
    db.exec("COMMIT");
    return !before.owner ? "created" : changed ? "updated" : "unchanged";
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const options = localOwnerOptions();
    if (options) {
      const { localDatabase } = await import("../src/lib/local");
      const result = await ensureLocalOwner(localDatabase(), options);
      console.log(`Local owner credentials ${result}.`);
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Local owner setup failed.",
    );
    process.exitCode = 1;
  }
}
