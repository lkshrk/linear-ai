import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");

async function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: ROOT,
      env,
      timeout: 120_000,
      maxBuffer: 1024 * 1024
    });
    return `${stdout}${stderr}`;
  } catch (error) {
    const failed = error as Error & { code?: string; stdout?: string; stderr?: string };
    if (failed.code === "ENOENT") {
      throw new Error(`${command} is required for marketplace smoke checks`);
    }
    throw new Error(`${command} ${args.join(" ")} failed\n${failed.stdout ?? ""}${failed.stderr ?? ""}`.trim());
  }
}

async function main(): Promise<number> {
  const root = await mkdtemp(path.join(os.tmpdir(), "linear-ai-marketplace-smoke-"));
  const marketplace = path.join(root, "marketplace");
  const codexHome = path.join(root, "codex-home");
  const claudeHome = path.join(root, "claude-home");
  try {
    await run("bun", [
      "scripts/generate_marketplace_specs.ts",
      "--version",
      "package",
      "--out-dir",
      marketplace,
      "--codex-url",
      ROOT,
      "--claude-url",
      `file://${ROOT}`
    ]);
    await mkdir(codexHome, { recursive: true });
    await mkdir(claudeHome, { recursive: true });

    const codexEnv = { ...process.env, CODEX_HOME: codexHome };
    await run("codex", ["plugin", "marketplace", "add", marketplace, "--json"], codexEnv);
    const available = await run("codex", ["plugin", "list", "--available", "--json"], codexEnv);
    if (!available.includes("linear-ai")) throw new Error("codex marketplace did not list linear-ai");
    await run("codex", ["plugin", "add", "linear-ai", "--marketplace", "linear-ai", "--json"], codexEnv);
    const codexInstalled = await run("codex", ["plugin", "list", "--json"], codexEnv);
    if (!codexInstalled.includes("linear-ai")) throw new Error("codex plugin list did not include linear-ai");

    const claudeEnv = { ...process.env, HOME: claudeHome };
    await run("claude", ["plugin", "validate", marketplace], claudeEnv);
    await run("claude", ["plugin", "marketplace", "add", marketplace, "--scope", "user"], claudeEnv);
    await run("claude", ["plugin", "install", "linear-ai@linear-ai", "--scope", "user"], claudeEnv);
    const claudeInstalled = await run("claude", ["plugin", "list"], claudeEnv);
    if (!claudeInstalled.includes("linear-ai@linear-ai")) throw new Error("claude plugin list did not include linear-ai");

    process.stdout.write("ok marketplace smoke (codex plugin, claude plugin)\n");
    return 0;
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 1;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  process.exitCode = await main();
}
