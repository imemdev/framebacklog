import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it } from "vitest";
import { verifyPassword } from "better-auth/crypto";
import {
  ensureLocalOwner,
  localOwnerOptions,
} from "../scripts/ensure-local-owner";

const databases: DatabaseSync[] = [];
const credentials = { username: "local-owner", password: "local-password" };

function database() {
  const db = new DatabaseSync(":memory:");
  for (const migration of [
    "0001_initial.sql",
    "0002_usernames.sql",
    "0003_project_access.sql",
  ])
    db.exec(
      readFileSync(
        new URL(`../migrations/${migration}`, import.meta.url),
        "utf8",
      ),
    );
  databases.push(db);
  return db;
}

function user(db: DatabaseSync, username = credentials.username) {
  return db.prepare("SELECT * FROM user WHERE username=?").get(username)!;
}

function partner(db: DatabaseSync) {
  db.prepare(
    "INSERT INTO user(id,name,email,createdAt,updatedAt,username) VALUES('partner','Partner','partner@example.test',1,1,'partner')",
  ).run();
  db.prepare(
    "INSERT INTO members(user_id,role) VALUES('partner','partner')",
  ).run();
}

function session(db: DatabaseSync, userId: string) {
  db.prepare(
    "INSERT INTO session(id,expiresAt,token,createdAt,updatedAt,userId) VALUES(?,9999999999999,?,1,1,?)",
  ).run(`session-${userId}`, `token-${userId}`, userId);
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

it("skips absent configuration and rejects incomplete, invalid, or Cloudflare settings", () => {
  expect(localOwnerOptions({})).toBeUndefined();
  expect(() => localOwnerOptions({ LOCAL_OWNER_USERNAME: "owner" })).toThrow(
    "Set both",
  );
  expect(() =>
    localOwnerOptions({
      LOCAL_OWNER_USERNAME: "bad user",
      LOCAL_OWNER_PASSWORD: "password",
    }),
  ).toThrow("LOCAL_OWNER_USERNAME");
  expect(() =>
    localOwnerOptions({
      LOCAL_OWNER_USERNAME: "owner",
      LOCAL_OWNER_PASSWORD: "x",
    }),
  ).toThrow("LOCAL_OWNER_PASSWORD");
  for (const target of [{ STORAGE_TARGET: "cloudflare" }, { CF_BUILD: "1" }])
    expect(() =>
      localOwnerOptions({
        ...target,
        LOCAL_OWNER_USERNAME: "owner",
        LOCAL_OWNER_PASSWORD: "password",
      }),
    ).toThrow("Node SQLite");
  expect(
    localOwnerOptions({
      LOCAL_OWNER_USERNAME: " Local-Owner ",
      LOCAL_OWNER_PASSWORD: "password",
    }),
  ).toEqual({ username: "local-owner", password: "password" });
});

it("atomically creates the first owner with a compatible Better Auth password", async () => {
  const db = database();
  expect(await ensureLocalOwner(db, credentials)).toBe("created");
  const owner = user(db);
  expect(db.prepare("SELECT * FROM members").all()).toEqual([
    { user_id: owner.id, role: "owner" },
  ]);
  expect(db.prepare("SELECT * FROM installation").all()).toEqual([
    { id: 1, email: owner.email },
  ]);
  const account = db.prepare("SELECT * FROM account").get()!;
  expect(account.accountId).toBe(owner.id);
  expect(account.userId).toBe(owner.id);
  expect(account.providerId).toBe("credential");
  expect(
    await verifyPassword({
      hash: String(account.password),
      password: credentials.password,
    }),
  ).toBe(true);
});

it("keeps the same owner identity, project data, and partner while changing owner credentials", async () => {
  const db = database();
  await ensureLocalOwner(db, credentials);
  const previous = user(db);
  partner(db);
  session(db, String(previous.id));
  session(db, "partner");
  const project = JSON.stringify({
    name: "Real project",
    createdBy: previous.id,
    tasks: [{ title: "Keep me" }],
  });
  db.prepare(
    "INSERT INTO projects(id,revision,data) VALUES('real-project',7,?)",
  ).run(project);
  expect(
    await ensureLocalOwner(db, {
      username: "renamed-owner",
      password: "changed-password",
    }),
  ).toBe("updated");
  const current = user(db, "renamed-owner");
  expect(current.id).toBe(previous.id);
  expect(current.email).toBe(previous.email);
  expect(current.name).toBe(previous.name);
  expect(db.prepare("SELECT * FROM projects").all()).toEqual([
    { id: "real-project", revision: 7, data: project },
  ]);
  expect(db.prepare("SELECT userId FROM session").all()).toEqual([
    { userId: "partner" },
  ]);
  expect(
    db.prepare("SELECT role FROM members WHERE user_id='partner'").get()?.role,
  ).toBe("partner");
  expect(db.prepare("SELECT email FROM installation").get()?.email).toBe(
    previous.email,
  );
  const account = db
    .prepare("SELECT password FROM account WHERE userId=?")
    .get(current.id)!;
  expect(
    await verifyPassword({
      hash: String(account.password),
      password: "changed-password",
    }),
  ).toBe(true);
});

it("leaves unchanged credentials, timestamps, password hash, and owner sessions intact", async () => {
  const db = database();
  await ensureLocalOwner(db, credentials);
  session(db, String(user(db).id));
  const before = {
    users: db.prepare("SELECT * FROM user").all(),
    accounts: db.prepare("SELECT * FROM account").all(),
    sessions: db.prepare("SELECT * FROM session").all(),
  };
  expect(await ensureLocalOwner(db, credentials)).toBe("unchanged");
  expect({
    users: db.prepare("SELECT * FROM user").all(),
    accounts: db.prepare("SELECT * FROM account").all(),
    sessions: db.prepare("SELECT * FROM session").all(),
  }).toEqual(before);
});

it("rejects another member's username without changing accounts or sessions", async () => {
  const db = database();
  await ensureLocalOwner(db, credentials);
  partner(db);
  session(db, String(user(db).id));
  const before = db.prepare("SELECT * FROM account").all();
  await expect(
    ensureLocalOwner(db, { username: "PARTNER", password: "changed-password" }),
  ).rejects.toThrow("another account");
  expect(db.prepare("SELECT * FROM account").all()).toEqual(before);
  expect(db.prepare("SELECT * FROM session").all()).toHaveLength(1);
  expect(user(db).username).toBe(credentials.username);
  expect(
    db.prepare("SELECT role FROM members WHERE user_id='partner'").get()?.role,
  ).toBe("partner");
});

it("does not promote a colliding member or claim an unfinished installation reservation", async () => {
  const db = database();
  partner(db);
  await expect(
    ensureLocalOwner(db, { username: "partner", password: "password" }),
  ).rejects.toThrow("another account");
  expect(db.prepare("SELECT * FROM installation").all()).toEqual([]);
  db.prepare(
    "INSERT INTO installation(id,email) VALUES(1,'reserved@example.test')",
  ).run();
  await expect(ensureLocalOwner(db, credentials)).rejects.toThrow(
    "reservation",
  );
  expect(db.prepare("SELECT * FROM user").all()).toHaveLength(1);
  expect(db.prepare("SELECT role FROM members").get()?.role).toBe("partner");
});

it("rolls back all new-owner records if creating the password account fails", async () => {
  const db = database();
  db.exec(
    "CREATE TRIGGER fail_account BEFORE INSERT ON account BEGIN SELECT RAISE(ABORT, 'simulated account failure'); END",
  );
  await expect(ensureLocalOwner(db, credentials)).rejects.toThrow(
    "simulated account failure",
  );
  for (const table of ["user", "members", "installation", "account"])
    expect(db.prepare(`SELECT * FROM ${table}`).all()).toEqual([]);
});

it("does not overwrite an owner changed while the password is being checked", async () => {
  const db = database();
  await ensureLocalOwner(db, credentials);
  const before = db.prepare("SELECT * FROM account").all();
  const pending = ensureLocalOwner(db, {
    username: "requested-owner",
    password: "new-password",
  });
  db.prepare("UPDATE user SET username='concurrent-owner'").run();
  await expect(pending).rejects.toThrow("changed concurrently");
  expect(user(db, "concurrent-owner").username).toBe("concurrent-owner");
  expect(db.prepare("SELECT * FROM account").all()).toEqual(before);
});
