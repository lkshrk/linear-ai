import { readFile } from "node:fs/promises";

const USAGE = "usage: bun scripts/extract_marked_comment.ts [--kind plan|status|any] FILE";

const PATTERNS = {
  plan: /<!--\s*linear-ai:plan v1\b.*?-->.*?<!--\s*\/linear-ai:plan\s*-->/gs,
  status: /<!--\s*linear-ai:status v1\b.*?-->.*?<!--\s*\/linear-ai:status\s*-->/gs
};

type Kind = "plan" | "status" | "any";
type Match = [number, string, string];

function parseArgs(argv: string[]): [Kind, string] {
  let kind: Kind = "plan";
  const files: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--kind") {
      const value = argv[index + 1] as Kind | undefined;
      if (!value || !["plan", "status", "any"].includes(value)) throw new Error(USAGE);
      kind = value;
      index += 1;
    } else if (arg === "-h" || arg === "--help") {
      process.stdout.write(`${USAGE}\n`);
      process.exit(0);
    } else {
      files.push(arg);
    }
  }

  if (files.length !== 1) throw new Error(USAGE);
  return [kind, files[0]];
}

function scan(content: string, pattern: RegExp, kind: string): Match[] {
  return [...content.matchAll(pattern)].map((match) => [match.index ?? 0, kind, match[0]]);
}

function matchesFor(content: string, kind: Kind): Match[] {
  if (kind === "any") {
    return [...scan(content, PATTERNS.plan, "plan"), ...scan(content, PATTERNS.status, "status")];
  }
  return scan(content, PATTERNS[kind], kind);
}

async function main(argv: string[]): Promise<number> {
  let kind: Kind;
  let path: string;

  try {
    [kind, path] = parseArgs(argv);
  } catch (error) {
    console.error((error as Error).message);
    return 2;
  }

  const content = await readFile(path, "utf8");
  const matches = matchesFor(content, kind).sort((left, right) => left[0] - right[0]);

  if (matches.length === 0) {
    console.error(`no marked ${kind === "any" ? "plan/status" : kind} comment found`);
    return 1;
  }

  process.stdout.write(`${matches[matches.length - 1][2]}\n`);
  return 0;
}

process.exitCode = await main(process.argv.slice(2));
