import { access, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

type Args = {
  marketplaceDir?: string;
  tag?: string;
};

type JsonObject = Record<string, unknown>;

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith("--")) throw new Error(`unexpected argument ${key}`);
    if (!value) throw new Error(`${key} requires a value`);
    if (key === "--marketplace-dir") args.marketplaceDir = value;
    else if (key === "--tag") args.tag = value;
    else throw new Error(`unknown argument ${key}`);
    index += 1;
  }
  return args;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath: string): Promise<JsonObject> {
  return JSON.parse(await readFile(filePath, "utf8")) as JsonObject;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function objectValue(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function objectArray(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is JsonObject => Boolean(objectValue(entry)))
    : [];
}

function expectEqual(errors: string[], label: string, actual: unknown, expected: string): void {
  if (actual !== expected) errors.push(`${label} must be ${expected}, got ${String(actual)}`);
}

function expectSemver(errors: string[], version: string): void {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    errors.push(`package.json version must be semver, got ${version}`);
  }
}

async function verifyMarketplace(errors: string[], marketplaceDir: string, version: string): Promise<void> {
  const base = path.resolve(ROOT, marketplaceDir);
  const codexPath = path.join(base, ".agents", "plugins", "marketplace.json");
  const claudePath = path.join(base, ".claude-plugin", "marketplace.json");
  const snapshotPackagePath = path.join(base, "plugins", "linear-ai", "package.json");
  const snapshotCodexPath = path.join(base, "plugins", "linear-ai", ".codex-plugin", "plugin.json");
  const snapshotClaudePath = path.join(base, "plugins", "linear-ai", ".claude-plugin", "plugin.json");

  for (const filePath of [codexPath, claudePath, snapshotPackagePath, snapshotCodexPath, snapshotClaudePath]) {
    if (!(await exists(filePath))) errors.push(`${path.relative(ROOT, filePath)} is missing`);
  }
  if (errors.length > 0) return;

  const codex = await readJson(codexPath);
  const codexPlugin = objectArray(codex.plugins)[0];
  const codexSource = objectValue(codexPlugin?.source);
  expectEqual(errors, ".agents/plugins/marketplace.json plugin source ref", codexSource?.ref, `v${version}`);

  const claude = await readJson(claudePath);
  expectEqual(errors, ".claude-plugin/marketplace.json metadata.version", objectValue(claude.metadata)?.version, version);
  expectEqual(errors, ".claude-plugin/marketplace.json plugin version", objectArray(claude.plugins)[0]?.version, version);

  expectEqual(errors, "plugins/linear-ai/package.json version", (await readJson(snapshotPackagePath)).version, version);
  expectEqual(errors, "plugins/linear-ai/.codex-plugin/plugin.json version", (await readJson(snapshotCodexPath)).version, version);
  expectEqual(errors, "plugins/linear-ai/.claude-plugin/plugin.json version", (await readJson(snapshotClaudePath)).version, version);
}

async function main(argv: string[]): Promise<number> {
  const errors: string[] = [];
  const args = parseArgs(argv);
  const packageJson = await readJson(path.join(ROOT, "package.json"));
  const version = stringValue(packageJson.version);
  if (!version) {
    errors.push("package.json version is required");
  } else {
    expectSemver(errors, version);
    expectEqual(errors, ".codex-plugin/plugin.json version", (await readJson(path.join(ROOT, ".codex-plugin", "plugin.json"))).version, version);
    expectEqual(errors, ".claude-plugin/plugin.json version", (await readJson(path.join(ROOT, ".claude-plugin", "plugin.json"))).version, version);

    if (args.tag) expectEqual(errors, "release tag", args.tag, `v${version}`);
    if (args.marketplaceDir) await verifyMarketplace(errors, args.marketplaceDir, version);
  }

  if (errors.length > 0) {
    process.stderr.write(`${errors.join("\n")}\n`);
    return 1;
  }

  process.stdout.write(`ok release sync v${version}\n`);
  return 0;
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
