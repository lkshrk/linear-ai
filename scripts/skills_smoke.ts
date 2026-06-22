import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");

async function run(command: string, args: string[], cwd: string): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd,
      timeout: 120_000,
      maxBuffer: 1024 * 1024
    });
    return `${stdout}${stderr}`;
  } catch (error) {
    const failed = error as Error & { stdout?: string; stderr?: string };
    throw new Error(`${command} ${args.join(" ")} failed\n${failed.stdout ?? ""}${failed.stderr ?? ""}`.trim());
  }
}

async function assertContains(pathname: string, expected: string): Promise<void> {
  const content = await readFile(pathname, "utf8");
  if (!content.includes(expected)) throw new Error(`${pathname} does not contain ${expected}`);
}

async function smokeAgent(agent: "codex" | "claude-code", expectedPath: string): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), `linear-ai-skills-${agent}-`));
  try {
    await run("npx", ["-y", "skills", "add", ROOT, "--skill", "linear-status", "--agent", agent, "--copy", "-y"], dir);
    const skillRoot = path.join(dir, expectedPath, "linear-status");
    await assertContains(path.join(skillRoot, "SKILL.md"), "name: linear-status");
    await assertContains(path.join(skillRoot, "docs", "workflow.md"), "Claim Lock Rule");
    await assertContains(path.join(skillRoot, "scripts", "validate_marked_comments.ts"), "SCHEMA_FILES");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<number> {
  try {
    await assertContains(path.join(ROOT, "skills/linear-implement/SKILL.md"), "Run implementation in auto mode once a valid ready plan exists.");
    await assertContains(path.join(ROOT, "skills/linear-implement/SKILL.md"), "Before starting direct implementation, verify the required implementer permission context is active.");
    await assertContains(path.join(ROOT, "skills/linear-batch-implement/SKILL.md"), "the same required implementer permission context used by direct runs");
    await assertContains(path.join(ROOT, "skills/linear-deliver-feature/SKILL.md"), "the same required implementer permission context used by direct runs has been passed or confirmed");
    await assertContains(path.join(ROOT, "skills/linear-implement/SKILL.md"), "destructive, irreversible, credential-gated, external-production affecting, materially scope-changing, missing required authority");
    await assertContains(path.join(ROOT, "docs/implementer.md"), "Run in auto mode for safe, reversible implementation work from a valid ready plan.");
    await assertContains(path.join(ROOT, "docs/orchestrator.md"), "the same required implementer permission context used by direct `linear-implement` runs");
    await assertContains(path.join(ROOT, "docs/implementer.md"), "the next step is destructive or irreversible");
    await assertContains(path.join(ROOT, "skills/linear-review/SKILL.md"), "name: linear-review");
    await assertContains(path.join(ROOT, "skills/linear-review/SKILL.md"), "Dispatch the review lanes as independent parallel subagents");

    const listOutput = await run("npx", ["-y", "skills", "add", ROOT, "--list"], ROOT);
    for (const skill of [
      "linear-batch-close",
      "linear-batch-implement",
      "linear-batch-refine",
      "linear-create-issue",
      "linear-refine",
      "linear-implement",
      "linear-close",
      "linear-deliver-feature",
      "linear-status",
      "linear-doctor",
      "linear-review",
      "linear-repo-reconcile"
    ]) {
      if (!listOutput.includes(skill)) throw new Error(`npx skills list did not include ${skill}`);
    }

    const useOutput = await run("npx", ["-y", "skills", "use", ROOT, "--skill", "linear-status"], ROOT);
    if (!useOutput.includes("linear-status")) throw new Error("npx skills use did not produce a linear-status prompt");

    await smokeAgent("codex", ".agents/skills");
    await smokeAgent("claude-code", ".claude/skills");

    process.stdout.write("ok skills smoke (npx skills add/use, codex, claude-code)\n");
    return 0;
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await main();
}
