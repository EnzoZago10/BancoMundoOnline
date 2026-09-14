import fs from "node:fs";
import { fileURLToPath } from "node:url";
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith(".js") && context.parentURL?.startsWith("file:")) {
    const candidate = new URL(specifier.slice(0,-3)+".ts", context.parentURL);
    try { if (fs.existsSync(fileURLToPath(candidate))) return { url:candidate.href, shortCircuit:true }; } catch {}
  }
  return nextResolve(specifier, context);
}
