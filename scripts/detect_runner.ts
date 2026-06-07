import { spawnSync } from "node:child_process";

const candidates = ["bun", "pnpm", "npm", "yarn", "node"];

function exists(command: string): boolean {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

for (const candidate of candidates) {
  if (exists(candidate)) {
    process.stdout.write(`${candidate}\n`);
    process.exit(0);
  }
}

process.stderr.write("no JavaScript runner found; install bun, pnpm, npm, yarn, or node\n");
process.exit(1);
