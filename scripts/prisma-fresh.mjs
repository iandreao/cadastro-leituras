import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const alvos = [join(root, "node_modules", ".prisma")];

for (const alvo of alvos) {
  if (existsSync(alvo)) {
    rmSync(alvo, { recursive: true, force: true });
  }
}

const resultado = spawnSync("npx prisma generate", {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

if (resultado.status !== 0) {
  process.exit(resultado.status ?? 1);
}
