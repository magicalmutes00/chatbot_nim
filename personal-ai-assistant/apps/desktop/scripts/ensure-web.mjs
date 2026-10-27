/**
 * Ensures the Aurora web dev server is reachable on port 5175.
 *
 * Tauri's `beforeDevCommand` runs this before the window opens. If the web app
 * is already running (the normal case during development) we just exit; this
 * keeps `npm run tauri:dev` idempotent and avoids Vite port collisions.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PORT = 5175;
const URL = `http://localhost:${PORT}/`;
const TIMEOUT_MS = 60_000;

async function reachable() {
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(1500) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

if (await reachable()) {
  console.log(`[desktop] web dev server already running at ${URL}`);
  process.exit(0);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, "..", "..", "web");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

console.log(`[desktop] starting web dev server in ${webDir}`);
const child = spawn(npm, ["run", "dev"], { cwd: webDir, stdio: "inherit", detached: true });
child.unref();

const started = Date.now();
while (Date.now() - started < TIMEOUT_MS) {
  if (await reachable()) {
    console.log(`[desktop] web dev server ready at ${URL}`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 800));
}

console.error(`[desktop] web dev server did not start within ${TIMEOUT_MS / 1000}s`);
process.exit(1);
