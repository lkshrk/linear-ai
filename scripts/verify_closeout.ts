import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const DEFAULT_BASE = "origin/main";
const execFileAsync = promisify(execFile);

class CloseoutError extends Error {}

type Mapping = Record<string, unknown>;

function isMapping(value: unknown): value is Mapping {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseArgs(argv: string[]): { issueId: string; prPath: string; repoPath?: string; baseRef: string } {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new CloseoutError(`unexpected argument ${key}`);
    const value = argv[index + 1];
    if (!value) throw new CloseoutError(`${key} requires a value`);
    args.set(key, value);
    index += 1;
  }

  const issueId = args.get("--issue-id");
  const prPath = args.get("--pr");
  if (!issueId || !prPath) {
    throw new CloseoutError("usage: bun scripts/verify_closeout.ts --issue-id ISSUE-ID --pr pr.json [--repo path] [--base origin/main]");
  }

  return {
    issueId,
    prPath,
    repoPath: args.get("--repo"),
    baseRef: args.get("--base") ?? DEFAULT_BASE
  };
}

function requireMergedPr(pr: Mapping): string {
  if (pr.state !== "MERGED") throw new CloseoutError("PR state must be MERGED before closeout");
  const mergeCommit = isMapping(pr.mergeCommit) ? stringValue(pr.mergeCommit.oid) : undefined;
  if (!mergeCommit) throw new CloseoutError("merged PR must include mergeCommit.oid");
  return mergeCommit;
}

function requireSuccessfulChecks(pr: Mapping): void {
  const checks = Array.isArray(pr.statusCheckRollup) ? pr.statusCheckRollup : [];
  if (checks.length === 0) throw new CloseoutError("at least one PR status check is required before closeout");

  let successCount = 0;
  for (const check of checks) {
    if (!isMapping(check)) throw new CloseoutError("PR status checks must be mappings");
    const name = stringValue(check.name) ?? "unnamed check";
    if (check.status !== "COMPLETED") throw new CloseoutError(`check ${name} must be completed before closeout`);
    if (check.conclusion === "SUCCESS") successCount += 1;
    if (!["SUCCESS", "SKIPPED", "NEUTRAL"].includes(String(check.conclusion))) {
      throw new CloseoutError(`check ${name} must be successful before closeout`);
    }
  }

  if (successCount === 0) throw new CloseoutError("at least one successful PR status check is required before closeout");
}

async function requireMainlineContainsMerge(repoPath: string | undefined, baseRef: string, mergeCommit: string): Promise<void> {
  if (!repoPath) return;
  try {
    await execFileAsync("git", ["-C", repoPath, "merge-base", "--is-ancestor", mergeCommit, baseRef]);
  } catch {
    throw new CloseoutError(`mainline ${baseRef} must contain merge commit ${mergeCommit}`);
  }
}

async function loadPr(path: string): Promise<Mapping> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!isMapping(parsed)) throw new CloseoutError("PR JSON must be an object");
  return parsed;
}

async function main(argv: string[]): Promise<number> {
  try {
    const args = parseArgs(argv);
    const pr = await loadPr(args.prPath);
    const mergeCommit = requireMergedPr(pr);
    requireSuccessfulChecks(pr);
    await requireMainlineContainsMerge(args.repoPath, args.baseRef, mergeCommit);
    console.log(`ok closeout ${args.issueId}`);
    return 0;
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
