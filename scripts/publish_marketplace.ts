import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

type JsonObject = Record<string, unknown>;

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

async function readJson(filePath: string): Promise<JsonObject> {
  return JSON.parse(await readFile(filePath, "utf8")) as JsonObject;
}

async function writeJson(filePath: string, value: JsonObject): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeVersion(version: string, packageVersion: string): { version: string; tag: string } {
  const normalized = version === "package" ? packageVersion : version.replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(normalized)) {
    throw new Error(`version must be package, vX.Y.Z, or X.Y.Z, got ${version}`);
  }
  return { version: normalized, tag: `v${normalized}` };
}

function objectValue(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected JSON object");
  }
  return value as JsonObject;
}

function pluginEntries(manifest: JsonObject, manifestPath: string): JsonObject[] {
  if (!Array.isArray(manifest.plugins)) {
    throw new Error(`${manifestPath} must contain a plugins array`);
  }
  return manifest.plugins.map((entry, index) => {
    try {
      return objectValue(entry);
    } catch {
      throw new Error(`${manifestPath} plugins[${index}] must be an object`);
    }
  });
}

function findLinearAiPlugin(manifest: JsonObject, manifestPath: string): JsonObject {
  const plugin = pluginEntries(manifest, manifestPath).find((entry) => entry.name === "linear-ai");
  if (!plugin) throw new Error(`${manifestPath} is missing plugin linear-ai`);
  return plugin;
}

function updateSource(plugin: JsonObject, tag: string): void {
  const source = objectValue(plugin.source);
  source.source = "url";
  source.url = "https://github.com/lkshrk/linear-ai.git";
  source.ref = tag;
  plugin.source = source;
}

async function updateMarketplaceManifests(checkoutDir: string, version: string, tag: string): Promise<void> {
  const codexPath = path.join(checkoutDir, ".agents", "plugins", "marketplace.json");
  const claudePath = path.join(checkoutDir, ".claude-plugin", "marketplace.json");

  const codex = await readJson(codexPath);
  updateSource(findLinearAiPlugin(codex, ".agents/plugins/marketplace.json"), tag);
  await writeJson(codexPath, codex);

  const claude = await readJson(claudePath);
  const claudePlugins = pluginEntries(claude, ".claude-plugin/marketplace.json");
  const claudePlugin = claudePlugins.find((entry) => entry.name === "linear-ai");
  if (!claudePlugin) throw new Error(".claude-plugin/marketplace.json is missing plugin linear-ai");
  updateSource(claudePlugin, tag);
  claudePlugin.version = version;

  if (claudePlugins.length === 1) {
    const metadata = objectValue(claude.metadata);
    metadata.version = version;
    claude.metadata = metadata;
  }

  await writeJson(claudePath, claude);
}

async function main(argv: string[]): Promise<number> {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "linear-ai-marketplace-publish-"));
  try {
    const args = parseArgs(argv);
    const checkoutDir = path.join(tmp, "agent-marketplace");
    const packageVersion = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8")).version as string;
    const release = normalizeVersion(args.version, packageVersion);

    await run(tmp, "git", ["clone", args.marketplaceRepo, checkoutDir]);
    await updateMarketplaceManifests(checkoutDir, release.version, release.tag);

    const status = await run(checkoutDir, "git", ["status", "--short"]);
    if (!status.trim()) {
      process.stdout.write("ok marketplace already current\n");
      return 0;
    }

    await run(checkoutDir, "git", ["config", "user.name", "github-actions[bot]"]);
    await run(checkoutDir, "git", ["config", "user.email", "github-actions[bot]@users.noreply.github.com"]);
    await run(checkoutDir, "git", ["add", "."]);
    await run(checkoutDir, "git", ["commit", "-m", `chore: bump linear-ai to ${release.tag}`]);
    if (args.push) await run(checkoutDir, "git", ["push", "origin", "HEAD"]);

    process.stdout.write(`ok marketplace bump ${release.tag}\n`);
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
