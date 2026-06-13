import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_MARKETPLACE_REPO = "git@github.com:lkshrk/agent-marketplace.git";

type Args = {
  marketplaceRepo: string;
  push: boolean;
  version: string;
};

function parseArgs(argv: string[]): Args {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--push") {
      args.set(key, true);
      continue;
    }
    if (!key.startsWith("--")) throw new Error(`unexpected argument ${key}`);
    const value = argv[index + 1];
    if (!value) throw new Error(`${key} requires a value`);
    args.set(key, value);
    index += 1;
  }
  return {
    marketplaceRepo: String(args.get("--marketplace-repo") ?? DEFAULT_MARKETPLACE_REPO),
    push: args.get("--push") === true,
    version: String(args.get("--version") ?? "package")
  };
}

async function run(cwd: string, command: string, args: string[]): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd,
      maxBuffer: 1024 * 1024,
      timeout: 120_000
    });
    return `${stdout}${stderr}`;
  } catch (error) {
    const failed = error as Error & { stdout?: string; stderr?: string };
    throw new Error(`${command} ${args.join(" ")} failed\n${failed.stdout ?? ""}${failed.stderr ?? ""}`.trim());
  }
}

async function main(argv: string[]): Promise<number> {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "linear-ai-marketplace-publish-"));
  try {
    const args = parseArgs(argv);
    const marketplaceDir = path.join(tmp, "marketplace");
    const checkoutDir = path.join(tmp, "agent-marketplace");

    await run(ROOT, "bun", [
      "scripts/generate_marketplace_specs.ts",
      "--repository",
      "lkshrk/linear-ai",
      "--version",
      args.version,
      "--out-dir",
      marketplaceDir
    ]);
    await run(ROOT, "bun", ["scripts/verify_release.ts", "--marketplace-dir", marketplaceDir]);
    await run(tmp, "git", ["clone", args.marketplaceRepo, checkoutDir]);
    await rm(path.join(checkoutDir, ".agents"), { recursive: true, force: true });
    await rm(path.join(checkoutDir, ".claude-plugin"), { recursive: true, force: true });
    await rm(path.join(checkoutDir, "plugins"), { recursive: true, force: true });
    await rm(path.join(checkoutDir, "README.md"), { force: true });
    await cp(`${marketplaceDir}/.`, checkoutDir, { recursive: true, force: true });

    const status = await run(checkoutDir, "git", ["status", "--short"]);
    if (!status.trim()) {
      process.stdout.write("ok marketplace already current\n");
      return 0;
    }

    await run(checkoutDir, "git", ["config", "user.name", "github-actions[bot]"]);
    await run(checkoutDir, "git", ["config", "user.email", "github-actions[bot]@users.noreply.github.com"]);
    await run(checkoutDir, "git", ["add", "."]);
    const version = args.version === "package"
      ? JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8")).version as string
      : args.version.replace(/^v/, "");
    await run(checkoutDir, "git", ["commit", "-m", `chore(CIV-999): publish linear-ai v${version}`]);
    if (args.push) await run(checkoutDir, "git", ["push", "origin", "HEAD"]);

    process.stdout.write(`ok marketplace publish v${version}\n`);
    process.stdout.write(`push: ${args.push ? "completed" : "skipped"}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 1;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
