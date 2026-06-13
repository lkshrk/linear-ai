import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_ROOT = path.resolve(import.meta.dirname, "..");
const RELEASE_INPUT = "release must be major, minor, patch, or vX.Y.Z";

type Args = {
  dryRun: boolean;
  noCommit: boolean;
  push: boolean;
  release: string;
  repoDir: string;
};

type PackageJson = {
  scripts?: Record<string, string>;
  version?: string;
  [key: string]: unknown;
};

type JsonObject = Record<string, unknown>;

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    noCommit: false,
    push: false,
    release: "",
    repoDir: DEFAULT_ROOT
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--no-commit") args.noCommit = true;
    else if (arg === "--push") args.push = true;
    else if (arg === "--repo-dir") {
      const value = argv[index + 1];
      if (!value) throw new Error("--repo-dir requires a value");
      args.repoDir = path.resolve(value);
      index += 1;
    } else if (!arg.startsWith("--") && !args.release) {
      args.release = arg;
    } else {
      throw new Error(`unknown argument ${arg}`);
    }
  }

  if (!args.release) throw new Error(RELEASE_INPUT);
  return args;
}

async function readJson<T extends JsonObject>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function writeJson(filePath: string, value: JsonObject): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseVersion(version: string): [number, number, number] {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(RELEASE_INPUT);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersion(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function resolveVersion(current: string, release: string): string {
  const [major, minor, patch] = parseVersion(current);
  if (release === "major") return `${major + 1}.0.0`;
  if (release === "minor") return `${major}.${minor + 1}.0`;
  if (release === "patch") return `${major}.${minor}.${patch + 1}`;
  const explicit = release.replace(/^v/, "");
  parseVersion(explicit);
  return explicit;
}

async function run(repoDir: string, command: string, args: string[]): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: repoDir,
      maxBuffer: 1024 * 1024,
      timeout: 120_000
    });
    return `${stdout}${stderr}`;
  } catch (error) {
    const failed = error as Error & { stdout?: string; stderr?: string };
    throw new Error(`${command} ${args.join(" ")} failed\n${failed.stdout ?? ""}${failed.stderr ?? ""}`.trim());
  }
}

async function assertClean(repoDir: string): Promise<void> {
  const status = await run(repoDir, "git", ["status", "--short"]);
  if (status.trim()) {
    throw new Error("working tree must be clean before creating a release");
  }
}

async function tagExists(repoDir: string, tag: string): Promise<boolean> {
  const local = await run(repoDir, "git", ["tag", "--list", tag]);
  if (local.trim()) return true;
  const remote = await run(repoDir, "git", ["ls-remote", "--tags", "origin", tag]);
  return Boolean(remote.trim());
}

async function updateVersions(repoDir: string, version: string): Promise<void> {
  const packagePath = path.join(repoDir, "package.json");
  const codexPath = path.join(repoDir, ".codex-plugin", "plugin.json");
  const claudePath = path.join(repoDir, ".claude-plugin", "plugin.json");

  const packageJson = await readJson<PackageJson>(packagePath);
  const codexManifest = await readJson<JsonObject>(codexPath);
  const claudeManifest = await readJson<JsonObject>(claudePath);

  packageJson.version = version;
  codexManifest.version = version;
  claudeManifest.version = version;

  await writeJson(packagePath, packageJson);
  await writeJson(codexPath, codexManifest);
  await writeJson(claudePath, claudeManifest);
}

async function main(argv: string[]): Promise<number> {
  try {
    const args = parseArgs(argv);
    const packageJson = await readJson<PackageJson>(path.join(args.repoDir, "package.json"));
    if (!packageJson.version) throw new Error("package.json version is required");

    const targetVersion = resolveVersion(packageJson.version, args.release);
    const tag = `v${targetVersion}`;
    if (compareVersion(targetVersion, packageJson.version) <= 0) {
      throw new Error(`release ${tag} must be greater than current v${packageJson.version}`);
    }

    if (args.dryRun) {
      process.stdout.write(`would create release ${tag}\nmode: dry-run\n`);
      return 0;
    }

    await assertClean(args.repoDir);
    if (await tagExists(args.repoDir, tag)) throw new Error(`tag ${tag} already exists`);

    await updateVersions(args.repoDir, targetVersion);
    await run(args.repoDir, "bun", ["scripts/generate_marketplace_specs.ts", "--version", "package"]);
    await run(args.repoDir, "bun", ["scripts/verify_release.ts", "--tag", tag, "--marketplace-dir", "dist/marketplace"]);

    if (!args.noCommit) {
      await run(args.repoDir, "git", ["add", "package.json", ".codex-plugin/plugin.json", ".claude-plugin/plugin.json"]);
      await run(args.repoDir, "git", ["commit", "-m", `chore(CIV-999): release ${tag}`]);
      await run(args.repoDir, "git", ["tag", tag]);
      if (args.push) {
        await run(args.repoDir, "git", ["push", "origin", "HEAD"]);
        await run(args.repoDir, "git", ["push", "origin", tag]);
      }
    }

    process.stdout.write(`prepared release ${tag}\n`);
    process.stdout.write(`commit: ${args.noCommit ? "skipped" : "created"}\n`);
    process.stdout.write(`push: ${args.push ? "completed" : "skipped"}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
