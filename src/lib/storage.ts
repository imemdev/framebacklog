import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
export type Bindings = {
  DB: D1Database;
  SCREENSHOTS: R2Bucket;
  APP_URL?: string;
  BETTER_AUTH_SECRET?: string;
};
export async function bindings(): Promise<Bindings | null> {
  if (
    process.env.CF_BUILD !== "1" &&
    process.env.STORAGE_TARGET !== "cloudflare"
  )
    return null;
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  return (await getCloudflareContext({ async: true }))
    .env as unknown as Bindings;
}
export async function settings() {
  const env = await bindings();
  return {
    url: env?.APP_URL || process.env.APP_URL || "http://localhost:3000",
    secret: env?.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET,
  };
}
export async function sql<T = Record<string, unknown>>(
  query: string,
  values: (string | number | null)[] = [],
): Promise<T[]> {
  const env = await bindings();
  if (env)
    return (
      await env.DB.prepare(query)
        .bind(...values)
        .all<T>()
    ).results;
  const { localDatabase } = await import("@/lib/local");
  return localDatabase()
    .prepare(query)
    .all(...values) as T[];
}
export async function putFile(key: string, bytes: Uint8Array, type: string) {
  const env = await bindings();
  if (env) {
    await env.SCREENSHOTS.put(key, bytes, {
      httpMetadata: { contentType: type },
    });
    return;
  }
  const { putLocal } = await import("@/lib/local");
  await putLocal(key, bytes);
}
export async function getFile(key: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(key)) throw new Error("Invalid file key");
  const env = await bindings();
  if (env) {
    const file = await env.SCREENSHOTS.get(key);
    if (!file) throw new Error("File not found");
    return new Uint8Array(await file.arrayBuffer());
  }
  const { getLocal } = await import("@/lib/local");
  return getLocal(key);
}
export async function deleteFile(key: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(key)) throw new Error("Invalid file key");
  const env = await bindings();
  if (env) {
    await env.SCREENSHOTS.delete(key);
    return;
  }
  const { deleteLocal } = await import("@/lib/local");
  await deleteLocal(key);
}
