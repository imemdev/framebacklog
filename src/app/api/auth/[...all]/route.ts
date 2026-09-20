import { auth, csrf, limit } from "@/lib/auth";
import { failure } from "@/lib/http";
async function handle(req: Request) {
  try {
    const path = new URL(req.url).pathname;
    if (
      ![
        "/api/auth/sign-in/email",
        "/api/auth/sign-in/username",
        "/api/auth/sign-out",
        "/api/auth/get-session",
      ].includes(path)
    )
      return Response.json(
        {
          error:
            "Use installation setup or a workspace invitation to register.",
        },
        { status: 403 },
      );
    await csrf(req);
    await limit("auth-global", 40);
    return await (await auth()).handler(req);
  } catch (e) {
    return failure(e);
  }
}
export { handle as GET, handle as POST };
