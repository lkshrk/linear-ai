import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const SCAN_PATHS = [
  "agents",
  "docs",
  "skills",
  "templates",
  "README.md",
  "Makefile",
  "package.json"
];

const STALE_PATTERNS = [
  { pattern: /\bruby\b/i, message: "legacy Ruby helper reference" },
  { pattern: /linear-clarify-plan/, message: "old skill name linear-clarify-plan" },
  { pattern: /linear-ship-work/, message: "old skill name linear-ship-work" },
  { pattern: /team_tag|team tag|--team-tag/i, message: "removed team tag routing field" }
];

async function filesUnder(relativePath: string): Promise<string[]> {
  const absolutePath = path.join(ROOT, relativePath);
  const fileStat = await stat(absolutePath);
  if (fileStat.isFile()) return [relativePath];

  const entries = await readdir(absolutePath, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) return filesUnder(child);
    if (entry.isFile()) return [child];
    return [];
  }));
  return files.flat();
}

async function main(): Promise<number> {
  const files = (await Promise.all(SCAN_PATHS.map(filesUnder))).flat()
    .filter((file) => /\.(md|json)$/.test(file) || file === "Makefile");
  const errors: string[] = [];

  for (const file of files) {
    const content = await readFile(path.join(ROOT, file), "utf8");
    for (const stale of STALE_PATTERNS) {
      if (stale.pattern.test(content)) {
        errors.push(`${file}: ${stale.message}`);
      }
    }
  }

  if (errors.length > 0) {
    process.stderr.write(`${errors.join("\n")}\n`);
    return 1;
  }

  process.stdout.write(`ok self review (${files.length} files)\n`);
  return 0;
}

if (import.meta.main) {
  process.exitCode = await main();
}
