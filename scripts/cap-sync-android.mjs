import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, renameSync } from "node:fs";

function loadEnvLocal() {
  const p = ".env.local";
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvLocal();

const remote = process.env.CAPACITOR_REMOTE === "1";
const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  process.env.CAPACITOR_DEV_URL?.trim();

if (remote && !serverUrl) {
  console.error(`
[cap:sync:remote] Necesitas CAPACITOR_SERVER_URL o CAPACITOR_DEV_URL en .env.local.
`);
  process.exit(1);
}

if (!remote) {
  const mw = "src/middleware.ts";
  const mwBak = "src/middleware.cap-bak.ts";
  const apiDir = "src/app/api";
  const apiBakLegacy = "src/app/api.cap-bak";
  const apiBak = "src/_cap_tmp_api_bak";

  // Autorreparar restos de una ejecución previa interrumpida.
  if (!existsSync(mw) && existsSync(mwBak)) renameSync(mwBak, mw);
  if (!existsSync(apiDir) && existsSync(apiBakLegacy)) renameSync(apiBakLegacy, apiDir);
  if (!existsSync(apiDir) && existsSync(apiBak)) renameSync(apiBak, apiDir);

  const hadMiddleware = existsSync(mw);
  const hadApiRoutes = existsSync(apiDir);
  if (hadMiddleware) renameSync(mw, mwBak);
  if (hadApiRoutes) renameSync(apiDir, apiBak);
  try {
    const nb = spawnSync("npx", ["next", "build"], {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, CAPACITOR_STATIC: "1" },
    });
    if (nb.status !== 0) process.exit(nb.status ?? 1);
  } finally {
    if (existsSync(apiBakLegacy)) renameSync(apiBakLegacy, apiDir);
    if (hadApiRoutes && existsSync(apiBak)) renameSync(apiBak, apiDir);
    if (hadMiddleware && existsSync(mwBak)) renameSync(mwBak, mw);
  }
}

const syncEnv = { ...process.env };
if (remote) {
  delete syncEnv.CAPACITOR_STATIC;
} else {
  syncEnv.CAPACITOR_STATIC = "1";
}

const r = spawnSync("npx", ["cap", "sync", "android"], {
  stdio: "inherit",
  shell: true,
  env: syncEnv,
});
process.exit(r.status ?? 1);
