import { writeFileSync } from "node:fs";
import { openapi } from "../src/lib/openapi";
writeFileSync("docs/openapi.json", JSON.stringify(openapi(), null, 2) + "\n");
console.log("Generated docs/openapi.json from shared request schemas.");
