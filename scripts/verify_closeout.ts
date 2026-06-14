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

type ParsedArgs = {
  issueId: string;
  implementedIssueId?: string;
  prPath?: string;
  commitPath?: string;
  repoPath?: string;
  baseRef: string;
};

function parseArgs(argv: string[]): ParsedArgs {
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
  const implementedIssueId = args.get("--implemented-issue-id");
  const prPath = args.get("--pr");
  const commitPath = args.get("--commit");
  if (!issueId || (!prPath && !commitPath) || (prPath && commitPath)) {
    throw new CloseoutError("usage: bun scripts/verify_closeout.ts --issue-id ISSUE-ID [--implemented-issue-id OLD-ISSUE-ID] (--pr pr.json | --commit commit.json) [--repo path] [--base origin/main]");
  }

  if (implementedIssueId) {
    requireCrossTeamIssueMove(issueId, implementedIssueId);
  }

  return {
    issueId,
    implementedIssueId,
    prPath,
    commitPath,
    repoPath: args.get("--repo"),
    baseRef: args.get("--base") ?? DEFAULT_BASE
  };
}

function issuePrefix(issueId: string): string {
  const match = /^([A-Za-z]+)-\d+$/.exec(issueId);
  if (!match) throw new CloseoutError(`issue ID must use Linear key format PREFIX-123: ${issueId}`);
  return match[1].toUpperCase();
}

function requireCrossTeamIssueMove(currentIssueId: string, implementedIssueId: string): void {
  if (currentIssueId.toLowerCase() === implementedIssueId.toLowerCase()) {
    throw new CloseoutError("--implemented-issue-id must differ from --issue-id");
  }

  const currentPrefix = issuePrefix(currentIssueId);
  const implementedPrefix = issuePrefix(implementedIssueId);
  if (currentPrefix === implementedPrefix) {
    throw new CloseoutError("--implemented-issue-id is only for moved issues with a different Linear team prefix");
  }
}

function requireMergedPr(pr: Mapping): string {
  if (pr.state !== "MERGED") throw new CloseoutError("PR state must be MERGED before closeout");
  const mergeCommit = isMapping(pr.mergeCommit) ? stringValue(pr.mergeCommit.oid) : undefined;
  if (!mergeCommit) throw new CloseoutError("merged PR must include mergeCommit.oid");
  return mergeCommit;
}

function requireSuccessfulChecks(evidence: Mapping, evidenceName: "PR" | "commit"): void {
  const checks = Array.isArray(evidence.statusCheckRollup)
    ? evidence.statusCheckRollup
    : Array.isArray(evidence.checks)
      ? evidence.checks
      : [];
  if (checks.length === 0) throw new CloseoutError(`at least one ${evidenceName} status check is required before closeout`);

  let successCount = 0;
  for (const check of checks) {
    if (!isMapping(check)) throw new CloseoutError(`${evidenceName} status checks must be mappings`);
    const name = stringValue(check.name) ?? "unnamed check";
    if (check.status !== "COMPLETED") throw new CloseoutError(`check ${name} must be completed before closeout`);
    if (check.conclusion === "SUCCESS") successCount += 1;
    if (!["SUCCESS", "SKIPPED", "NEUTRAL"].includes(String(check.conclusion))) {
      throw new CloseoutError(`check ${name} must be successful before closeout`);
    }
  }

  if (successCount === 0) throw new CloseoutError(`at least one successful ${evidenceName} status check is required before closeout`);
}

function issueIdMentionedInText(issueId: string, text: string): boolean {
  return text.toLowerCase().includes(issueId.toLowerCase());
}

function commitText(commit: Mapping): string {
  return [
    stringValue(commit.subject),
    stringValue(commit.messageHeadline),
    stringValue(commit.message),
    stringValue(commit.title)
  ].filter((value): value is string => !!value).join("\n");
}

function requirePrIssueEvidence(pr: Mapping, issueId: string): void {
  const commits = Array.isArray(pr.commits)
    ? pr.commits
    : isMapping(pr.commits) && Array.isArray(pr.commits.nodes)
      ? pr.commits.nodes
      : [];
  if (commits.length === 0) {
    throw new CloseoutError(`moved issue PR evidence must include commits mentioning implemented issue ID ${issueId}`);
  }

  for (const commit of commits) {
    if (!isMapping(commit)) throw new CloseoutError("PR commits must be mappings");
    if (issueIdMentionedInText(issueId, commitText(commit))) return;
  }

  throw new CloseoutError(`moved issue PR evidence must mention implemented issue ID ${issueId}`);
}

async function requireMainlineContainsCommit(repoPath: string | undefined, baseRef: string, commit: string, evidenceName: "commit" | "merge commit"): Promise<void> {
  if (!repoPath) return;
  try {
    await execFileAsync("git", ["-C", repoPath, "merge-base", "--is-ancestor", commit, baseRef]);
  } catch {
    throw new CloseoutError(`mainline ${baseRef} must contain ${evidenceName} ${commit}`);
  }
}

async function loadJson(path: string, evidenceName: "PR" | "commit"): Promise<Mapping> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!isMapping(parsed)) throw new CloseoutError(`${evidenceName} JSON must be an object`);
  return parsed;
}

function requireIssueCommit(commit: Mapping, issueId: string): string {
  const oid = stringValue(commit.oid) ?? stringValue(commit.sha);
  if (!oid) throw new CloseoutError("commit evidence must include oid or sha");

  const text = [
    stringValue(commit.subject),
    stringValue(commit.messageHeadline),
    stringValue(commit.message)
  ].filter((value): value is string => !!value).join("\n");
  if (!text) throw new CloseoutError("commit evidence must include subject, messageHeadline, or message");
  if (!issueIdMentionedInText(issueId, text)) {
    throw new CloseoutError(`commit evidence must mention issue ID ${issueId}`);
  }

  return oid;
}

async function main(argv: string[]): Promise<number> {
  try {
    const args = parseArgs(argv);
    const evidenceIssueId = args.implementedIssueId ?? args.issueId;
    if (args.prPath) {
      const pr = await loadJson(args.prPath, "PR");
      const mergeCommit = requireMergedPr(pr);
      requireSuccessfulChecks(pr, "PR");
      if (args.implementedIssueId) requirePrIssueEvidence(pr, evidenceIssueId);
      await requireMainlineContainsCommit(args.repoPath, args.baseRef, mergeCommit, "merge commit");
    } else if (args.commitPath) {
      const commit = await loadJson(args.commitPath, "commit");
      const oid = requireIssueCommit(commit, evidenceIssueId);
      requireSuccessfulChecks(commit, "commit");
      await requireMainlineContainsCommit(args.repoPath, args.baseRef, oid, "commit");
    }
    const movedSuffix = args.implementedIssueId ? ` via implemented issue ${args.implementedIssueId}` : "";
    console.log(`ok closeout ${args.issueId}${movedSuffix}`);
    return 0;
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
