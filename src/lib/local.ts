import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
let db: DatabaseSync;
export function localDatabase() {
  if (!db) {
    const dir = resolve(process.env.DATA_DIR || ".data");
    mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(resolve(dir, "backlog.sqlite"));
    db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;",
    );
    db.exec(readFileSync(resolve("migrations/0001_initial.sql"), "utf8"));
    const columns = db.prepare("PRAGMA table_info(user)").all();
    if (!columns.some((column) => column.name === "username")) {
      db.exec("BEGIN IMMEDIATE");
      try {
        if (
          !db
            .prepare("PRAGMA table_info(user)")
            .all()
            .some((column) => column.name === "username")
        )
          db.exec(
            readFileSync(resolve("migrations/0002_usernames.sql"), "utf8"),
          );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
    db.exec("BEGIN IMMEDIATE");
    try {
      if (
        !db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='partner_access'",
          )
          .get()
      )
        db.exec(
          readFileSync(resolve("migrations/0003_project_access.sql"), "utf8"),
        );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  return db;
}
export async function putLocal(key: string, bytes: Uint8Array) {
  const { writeFile, mkdir } = await import("node:fs/promises");
  const dir = resolve(process.env.DATA_DIR || ".data", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, key), bytes, { flag: "wx" });
}
export async function getLocal(key: string) {
  const { readFile } = await import("node:fs/promises");
  return new Uint8Array(
    await readFile(resolve(process.env.DATA_DIR || ".data", "uploads", key)),
  );
}
export async function deleteLocal(key: string) {
  const { unlink } = await import("node:fs/promises");
  try {
    await unlink(resolve(process.env.DATA_DIR || ".data", "uploads", key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
