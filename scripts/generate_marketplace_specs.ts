import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_OUT_DIR = "dist/marketplace";
const DEFAULT_REPOSITORY = "lkshrk/linear-ai";

type Args = {
  claudeUrl?: string;
  codexUrl?: string;
  outDir: string;
  repository: string;
  version: string;
};

function parseArgs(argv: string[]): Args {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`unexpected argument ${key}`);
    const value = argv[index + 1];
    if (!value) throw new Error(`${key} requires a value`);
    args.set(key, value);
    index += 1;
  }
  return {
    claudeUrl: args.get("--claude-url"),
    codexUrl: args.get("--codex-url"),
    outDir: args.get("--out-dir") ?? DEFAULT_OUT_DIR,
    repository: args.get("--repository") ?? DEFAULT_REPOSITORY,
    version: args.get("--version") ?? "package"
  };
}

async function packageVersion(): Promise<string> {
  const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8")) as { version?: string };
  if (!pkg.version) throw new Error("package.json version is required");
  return pkg.version;
}

function codexMarketplace(repository: string, version: string, codexUrl?: string): object {
  const source = codexUrl
    ? { source: "url", url: codexUrl }
    : { source: "url", url: `https://github.com/${repository}.git`, ref: `v${version}` };
  return {
    name: "linear-ai",
    interface: {
      displayName: "Linear AI"
    },
    plugins: [
      {
        name: "linear-ai",
        source,
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_INSTALL"
        },
        category: "Productivity"
      }
    ]
  };
}

function claudeMarketplace(repository: string, version: string, claudeUrl?: string): object {
  const source = claudeUrl
    ? { source: "url", url: claudeUrl }
    : { source: "url", url: `https://github.com/${repository}.git`, ref: `v${version}` };
  return {
    name: "linear-ai",
    owner: {
      name: "Linear AI"
    },
    metadata: {
      description: "Linear workflow skills for AI-assisted feature delivery, including batch refinement, implementation, and closeout orchestration.",
      version
    },
    plugins: [
      {
        name: "linear-ai",
        source,
        description: "Linear issue intake, setup checks, status detection, refinement, implementation, dashboard progress, review handoff, post-merge closeout, and batch queue orchestration workflow skills.",
        version,
        author: {
          name: "Linear AI"
        },
        category: "development",
        keywords: ["linear", "skills", "workflow", "batch", "orchestration", "codex", "claude-code"]
      }
    ]
  };
}

function marketplaceReadme(repository: string, version: string): string {
  return `# Linear AI Marketplace

Marketplace metadata for \`${repository}@v${version}\`.

This repository is an index-only agent marketplace. Plugin manifests point at released source repositories by git URL and tag; plugin source code is not vendored here.

The referenced plugin includes single-issue Linear AI lifecycle skills plus batch orchestrators for refinement, implementation, and closeout queues.

## Codex

\`\`\`sh
codex plugin marketplace add lkshrk/agent-marketplace --ref main
codex plugin add linear-ai --marketplace linear-ai
\`\`\`

## Claude Code

\`\`\`sh
claude plugin marketplace add lkshrk/agent-marketplace
claude plugin install linear-ai@linear-ai
\`\`\`
`;
}

async function writeJson(filePath: string, value: object): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function main(argv: string[]): Promise<number> {
  try {
    const args = parseArgs(argv);
    const version = args.version === "package" ? await packageVersion() : args.version.replace(/^v/, "");
    const outDir = path.resolve(ROOT, args.outDir);
    await rm(outDir, { recursive: true, force: true });
    await mkdir(path.join(outDir, ".agents", "plugins"), { recursive: true });
    await mkdir(path.join(outDir, ".claude-plugin"), { recursive: true });

    await writeJson(path.join(outDir, ".agents", "plugins", "marketplace.json"), codexMarketplace(args.repository, version, args.codexUrl));
    await writeJson(path.join(outDir, ".claude-plugin", "marketplace.json"), claudeMarketplace(args.repository, version, args.claudeUrl));
    await writeFile(path.join(outDir, "README.md"), marketplaceReadme(args.repository, version));

    process.stdout.write(`ok marketplace specs ${args.repository}@v${version} -> ${path.relative(ROOT, outDir)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
