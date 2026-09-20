import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
const output = resolve(".next/standalone");
if (!existsSync(resolve(output, "server.js")))
  throw new Error("Run pnpm build before pnpm start.");
cpSync(".next/static", resolve(output, ".next/static"), { recursive: true });
cpSync("public", resolve(output, "public"), { recursive: true });
cpSync("migrations", resolve(output, "migrations"), { recursive: true });
const args = process.argv.slice(2);
const portIndex = args.findIndex((a) => a === "--port" || a === "-p");
const child = spawn(process.execPath, [resolve(output, "server.js")], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATA_DIR: resolve(process.env.DATA_DIR || ".data"),
    HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
    PORT: portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || "3000",
  },
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));
