import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

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

function frontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const parsed = YAML.parse(match[1]);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
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
    const metadata = frontmatter(content);
    if (metadata.name !== skill) {
      errors.push(`${skillPath} frontmatter name must match directory`);
    }
    if (typeof metadata.description !== "string" || metadata.description.length < 40) {
      errors.push(`${skillPath} frontmatter description must be descriptive`);
    }
    const openaiPath = `skills/${skill}/agents/openai.yaml`;
    if (!(await exists(openaiPath))) {
      errors.push(`${openaiPath} is missing`);
    } else {
      const openai = YAML.parse(await readFile(path.join(ROOT, openaiPath), "utf8")) as Record<string, unknown>;
      const interfaceMetadata = openai?.interface as Record<string, unknown> | undefined;
      if (!interfaceMetadata?.display_name) errors.push(`${openaiPath} missing interface.display_name`);
      if (!interfaceMetadata?.short_description) errors.push(`${openaiPath} missing interface.short_description`);
      if (typeof interfaceMetadata?.default_prompt !== "string" || !interfaceMetadata.default_prompt.includes(`$${skill}`)) {
        errors.push(`${openaiPath} default_prompt must mention $${skill}`);
      }
    }
  }

  const installDoc = await readFile(path.join(ROOT, "docs/install.md"), "utf8");
  for (const required of ["npx skills add . --list", "--agent claude-code", "--agent codex"]) {
    if (!installDoc.includes(required)) errors.push(`docs/install.md must mention ${required}`);
  }

  const packageJson = await readJson("package.json");
  if (codexManifest.version !== packageJson.version) {
    errors.push(".codex-plugin/plugin.json version must match package.json version");
  }
  if (claudeManifest.version !== packageJson.version) {
    errors.push(".claude-plugin/plugin.json version must match package.json version");
  }

  const scripts = packageJson.scripts as Record<string, string> | undefined;
  for (const script of ["validate:node", "metadata:node", "intake:node", "marketplace:generate", "marketplace:generate:node", "marketplace:publish", "marketplace:publish:node", "marketplace:smoke", "marketplace:smoke:node", "release:create", "release:create:node", "release:check", "release:check:node", "verify:handoff", "verify:handoff:node", "metadata:capture", "self-review:node", "install:smoke:node", "skills:smoke", "skills:smoke:node"]) {
    if (!scripts?.[script]) errors.push(`package.json missing ${script} script`);
  }

  const marketplaceDoc = await readFile(path.join(ROOT, "docs/marketplace.md"), "utf8");
  for (const required of ["lkshrk/agent-marketplace", "codex plugin marketplace add", "claude plugin marketplace add", "source.url/ref"]) {
    if (!marketplaceDoc.includes(required)) errors.push(`docs/marketplace.md must mention ${required}`);
  }

  for (const workflow of [".github/workflows/ci.yml", ".github/workflows/release.yml"]) {
    if (!(await exists(workflow))) errors.push(`${workflow} is missing`);
  }

  if (await exists(".github/workflows/ci.yml")) {
    const ci = await readFile(path.join(ROOT, ".github/workflows/ci.yml"), "utf8");
    for (const required of ["make skills-smoke", "startsWith(github.ref, 'refs/tags/v')", "createWorkflowDispatch", "release.yml"]) {
      if (!ci.includes(required)) errors.push(".github/workflows/ci.yml must dispatch release.yml after successful release-tag CI");
    }
  }

  if (await exists(".github/workflows/release.yml")) {
    const release = await readFile(path.join(ROOT, ".github/workflows/release.yml"), "utf8");
    for (const required of ["force_release", "gh run list --workflow \"CI\"", "--commit \"$sha\"", "gh release create"]) {
      if (!release.includes(required)) errors.push(".github/workflows/release.yml must verify CI by commit with force override support");
    }
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
