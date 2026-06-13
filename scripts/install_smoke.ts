import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

async function readJson(relativePath: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8")) as Record<string, unknown>;
}

async function exists(relativePath: string): Promise<boolean> {
  try {
    await access(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

async function main(): Promise<number> {
  const errors: string[] = [];
  const skillDirs = (await readdir(path.join(ROOT, "skills"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const codexManifest = await readJson(".codex-plugin/plugin.json");
  if (codexManifest.skills !== "./skills/") {
    errors.push(".codex-plugin/plugin.json must point skills at ./skills/");
  }

  const claudeManifest = await readJson(".claude-plugin/plugin.json");
  const expectedClaudeSkills = skillDirs.map((skill) => `./skills/${skill}`);
  const actualClaudeSkills = stringArray(claudeManifest.skills).toSorted();
  if (JSON.stringify(actualClaudeSkills) !== JSON.stringify(expectedClaudeSkills)) {
    errors.push(".claude-plugin/plugin.json skills must match skills/* directories");
  }

  for (const skill of skillDirs) {
    const skillPath = `skills/${skill}/SKILL.md`;
    if (!(await exists(skillPath))) {
      errors.push(`${skillPath} is missing`);
      continue;
    }
    const content = await readFile(path.join(ROOT, skillPath), "utf8");
    if (!new RegExp(`^name: ${skill}$`, "m").test(content)) {
      errors.push(`${skillPath} frontmatter name must match directory`);
    }
  }

  const installDoc = await readFile(path.join(ROOT, "docs/install.md"), "utf8");
  for (const required of ["npx skills add . --list", "--agent claude-code", "--agent codex"]) {
    if (!installDoc.includes(required)) errors.push(`docs/install.md must mention ${required}`);
  }

  const packageJson = await readJson("package.json");
  const scripts = packageJson.scripts as Record<string, string> | undefined;
  for (const script of ["validate:node", "metadata:node", "intake:node", "verify:handoff", "verify:handoff:node", "metadata:capture", "self-review:node", "install:smoke:node"]) {
    if (!scripts?.[script]) errors.push(`package.json missing ${script} script`);
  }

  if (errors.length > 0) {
    process.stderr.write(`${errors.join("\n")}\n`);
    return 1;
  }

  process.stdout.write(`ok install smoke (${skillDirs.length} skills)\n`);
  return 0;
}

if (import.meta.main) {
  process.exitCode = await main();
}
