import { handle } from "@/lib/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as PUT,
  handle as DELETE,
};
