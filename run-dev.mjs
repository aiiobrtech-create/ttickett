/**
 * Inicia o TTICKETT sem passar por npm.ps1 (útil quando a política do PowerShell bloqueia scripts).
 * Uso no PowerShell: node run-dev.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const freePort = path.join(root, "scripts", "free-port-3000.ps1");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const node = process.execPath;

const p1 = spawnSync(
  "powershell.exe",
  ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", freePort, "-Port", "3000"],
  { stdio: "inherit", cwd: root }
);
if (p1.status !== 0 && p1.status !== null) process.exit(p1.status);

const p2 = spawnSync(node, [tsxCli, "server.ts"], {
  stdio: "inherit",
  cwd: root,
  env: { ...process.env },
});
process.exit(p2.status ?? 1);
