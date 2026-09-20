import { ZodError } from "zod";
import { Problem } from "./model";
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function failure(e: unknown) {
  if (e instanceof ZodError)
    return json(
      {
        error: "Invalid request. Correct the listed fields.",
        issues: e.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      422,
    );
  if (e instanceof Problem)
    return json({ error: e.message, details: e.details }, e.status);
  console.error("Request failed:", e instanceof Error ? e.message : "unknown");
  return json({ error: "The request could not be saved. Please retry." }, 500);
}
export async function body(req: Request, limit = 65536) {
  if (Number(req.headers.get("content-length") || 0) > limit)
    throw new Problem(413, "Request is too large.");
  const bytes = await readBytes(req, limit);
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Problem(400, "Provide a valid JSON body.");
  }
}
export async function readBytes(req: Request, limit: number) {
  const reader = req.body?.getReader();
  if (!reader) throw new Problem(400, "Request body required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Problem(413, `Maximum request size is ${limit} bytes.`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export function imageType(bytes: Uint8Array) {
  if (
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  )
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  throw new Problem(415, "Upload a PNG, JPEG, or WebP image.");
}
