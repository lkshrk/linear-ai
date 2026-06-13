import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import YAML from "yaml";

const STATUS_START = /<!--\s*linear-ai:status v1\b.*?-->/s;
const STATUS_END = /<!--\s*\/linear-ai:status\s*-->/s;
const DASHBOARD_START = /<!--\s*linear-ai:dashboard v1\b.*?-->/s;
const DASHBOARD_END = /<!--\s*\/linear-ai:dashboard\s*-->/s;
const YAML_BLOCK = /```yaml\n(.*?)```/s;
const COMMIT_TYPES = ["feat", "fix", "docs", "test", "refactor", "chore", "perf", "build", "ci"];
const DEFAULT_MAX_COMMITS = 12;
const execFileAsync = promisify(execFile);

class HandoffError extends Error {}

type Mapping = Record<string, unknown>;

function isMapping(value: unknown): value is Mapping {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function extractYaml(content: string, startMarker: RegExp, endMarker: RegExp, kind: string): Mapping {
  const startMatch = content.match(startMarker);
  const endMatch = content.match(endMarker);
  if (!startMatch || startMatch.index == null) throw new HandoffError(`missing ${kind} start marker`);
  if (!endMatch || endMatch.index == null) throw new HandoffError(`missing ${kind} end marker`);

  const block = content.slice(startMatch.index + startMatch[0].length, endMatch.index);
  const yamlMatch = block.match(YAML_BLOCK);
  if (!yamlMatch) throw new HandoffError(`missing ${kind} fenced YAML block`);

  const parsed = YAML.parse(yamlMatch[1]);
  if (!isMapping(parsed)) throw new HandoffError(`${kind} YAML must be a mapping`);
  return parsed;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function commitSubjectsFromStatus(status: Mapping): string[] {
  const commits = status.commits;
  if (!Array.isArray(commits)) return [];
  return commits
    .map((commit) => (isMapping(commit) && typeof commit.subject === "string" ? commit.subject : undefined))
    .filter((subject): subject is string => !!subject);
}

async function commitSubjectsFromFile(path?: string): Promise<string[]> {
  if (!path) return [];
  const content = await readFile(path, "utf8");
  return content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function requireCommitSubjects(subjects: string[], issueId: string): void {
  if (subjects.length === 0) throw new HandoffError("at least one commit subject is required");
  const typePattern = COMMIT_TYPES.join("|");
  const pattern = new RegExp(`^(${typePattern})\\(${issueId}\\)!?: .+`);

  for (const subject of subjects) {
    if (!pattern.test(subject)) {
      throw new HandoffError(`commit subject must use semver/conventional syntax with issue ID ${issueId}: ${subject}`);
    }
  }
}

function requireReasonableCommitCount(subjects: string[], maxCommits: number): void {
  if (subjects.length > maxCommits) {
    throw new HandoffError(`commit count ${subjects.length} exceeds max ${maxCommits}`);
  }
}

function requireMatchingCommitSubjects(statusSubjects: string[], gitSubjects: string[]): void {
  if (gitSubjects.length === 0) return;
  const normalizedStatus = [...statusSubjects].sort();
  const normalizedGit = [...gitSubjects].sort();
  if (JSON.stringify(normalizedStatus) !== JSON.stringify(normalizedGit)) {
    throw new HandoffError("commit subjects from --commits must match status commits");
  }
}

function validateStatus(status: Mapping, issueId: string): void {
  if (status.schema !== "linear-ai.status.v1") throw new HandoffError("status schema must be linear-ai.status.v1");
  if (status.issue_id !== issueId) throw new HandoffError(`status issue_id must be ${issueId}`);
  if (status.implementation_status !== "review_ready") throw new HandoffError("implementation_status must be review_ready");
  if (!stringArray(status.recommended_labels_to_apply).includes("llm-review")) {
    throw new HandoffError("recommended_labels_to_apply must include llm-review");
  }
  if (stringArray(status.blocked_items).length > 0) throw new HandoffError("blocked_items must be empty for handoff");
  if (stringArray(status.skipped_items).length > 0) throw new HandoffError("skipped_items must be empty for handoff");
  if (Array.isArray(status.questions) && status.questions.length > 0) throw new HandoffError("questions must be empty for handoff");
  if (Array.isArray(status.placeholders) && status.placeholders.length > 0) throw new HandoffError("placeholders must be empty for handoff");

  const verification = Array.isArray(status.verification) ? status.verification : [];
  if (verification.length === 0) throw new HandoffError("verification is required");
  for (const [index, item] of verification.entries()) {
    if (!isMapping(item) || item.result !== "passed") throw new HandoffError(`verification[${index}].result must be passed`);
  }

  if (!["main", "feature_branch_pr"].includes(String(status.final_destination))) {
    throw new HandoffError("final_destination must be main or feature_branch_pr");
  }

  const cleanup = status.workspace_cleanup;
  if (!isMapping(cleanup)) throw new HandoffError("workspace_cleanup is required");
  if (!["cleaned", "intentionally_kept"].includes(String(cleanup.status))) {
    throw new HandoffError("workspace_cleanup.status must be cleaned or intentionally_kept");
  }
  if (cleanup.status === "intentionally_kept" && (!Array.isArray(cleanup.kept) || cleanup.kept.length === 0)) {
    throw new HandoffError("intentionally kept workspaces must be listed");
  }
}

function keptWorkspaceMatchers(status: Mapping): string[] {
  const cleanup = status.workspace_cleanup;
  if (!isMapping(cleanup) || !Array.isArray(cleanup.kept)) return [];
  return cleanup.kept.flatMap((item) => {
    if (!isMapping(item)) return [];
    return [item.path, item.branch].filter((value): value is string => typeof value === "string");
  });
}

function parseWorktrees(output: string): Array<{ path: string; branch?: string }> {
  const worktrees: Array<{ path: string; branch?: string }> = [];
  let current: { path: string; branch?: string } | undefined;
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      current = { path: line.slice("worktree ".length) };
      worktrees.push(current);
    } else if (line.startsWith("branch ") && current) {
      current.branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
    }
  }
  return worktrees;
}

async function requireNoUnreportedIssueWorktrees(repoPath: string | undefined, issueId: string, status: Mapping): Promise<void> {
  if (!repoPath) return;
  const { stdout } = await execFileAsync("git", ["-C", repoPath, "worktree", "list", "--porcelain"]);
  const [, ...linkedWorktrees] = parseWorktrees(stdout);
  const kept = keptWorkspaceMatchers(status);
  for (const worktree of linkedWorktrees) {
    const matchesIssue = worktree.path.includes(issueId) || worktree.branch?.includes(issueId);
    if (!matchesIssue) continue;
    const isReported = kept.some((entry) => worktree.path.includes(entry) || worktree.branch === entry || worktree.branch?.includes(entry));
    if (!isReported) throw new HandoffError(`unreported issue worktree remains: ${worktree.path}`);
  }
}

function validateDashboard(dashboard: Mapping, issueId: string): void {
  if (dashboard.schema !== "linear-ai.dashboard.v1") throw new HandoffError("dashboard schema must be linear-ai.dashboard.v1");
  if (dashboard.issue_id !== issueId) throw new HandoffError(`dashboard issue_id must be ${issueId}`);
  if (dashboard.llm_state !== "llm-review") throw new HandoffError("dashboard llm_state must be llm-review");
  const tasks = Array.isArray(dashboard.tasks) ? dashboard.tasks : [];
  if (tasks.length === 0) throw new HandoffError("dashboard tasks are required");
  for (const [index, task] of tasks.entries()) {
    if (!isMapping(task) || task.state !== "done" || task.emoji !== "✅") {
      throw new HandoffError(`dashboard tasks[${index}] must be done with ✅`);
    }
  }
  if (stringArray(dashboard.blockers).length > 0) throw new HandoffError("dashboard blockers must be empty");
}

function parseArgs(argv: string[]): { issueId: string; statusPath: string; dashboardPath: string; commitsPath?: string; maxCommits: number; repoPath?: string } {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new HandoffError(`unexpected argument ${key}`);
    const value = argv[index + 1];
    if (!value) throw new HandoffError(`${key} requires a value`);
    args.set(key, value);
    index += 1;
  }

  const issueId = args.get("--issue-id");
  const statusPath = args.get("--status");
  const dashboardPath = args.get("--dashboard");
  const maxCommits = Number(args.get("--max-commits") ?? DEFAULT_MAX_COMMITS);
  if (!Number.isInteger(maxCommits) || maxCommits <= 0) throw new HandoffError("--max-commits must be a positive integer");
  if (!issueId || !statusPath || !dashboardPath) {
    throw new HandoffError("usage: bun scripts/verify_handoff.ts --issue-id ISSUE-ID --status status.md --dashboard dashboard.md [--commits commits.txt] [--repo path] [--max-commits N]");
  }
  return { issueId, statusPath, dashboardPath, commitsPath: args.get("--commits"), maxCommits, repoPath: args.get("--repo") };
}

async function main(argv: string[]): Promise<number> {
  try {
    const args = parseArgs(argv);
    const status = extractYaml(await readFile(args.statusPath, "utf8"), STATUS_START, STATUS_END, "status");
    const dashboard = extractYaml(await readFile(args.dashboardPath, "utf8"), DASHBOARD_START, DASHBOARD_END, "dashboard");
    validateStatus(status, args.issueId);
    validateDashboard(dashboard, args.issueId);
    const statusSubjects = commitSubjectsFromStatus(status);
    requireCommitSubjects(statusSubjects, args.issueId);
    requireReasonableCommitCount(statusSubjects, args.maxCommits);
    const gitSubjects = await commitSubjectsFromFile(args.commitsPath);
    if (gitSubjects.length > 0) {
      requireCommitSubjects(gitSubjects, args.issueId);
      requireReasonableCommitCount(gitSubjects, args.maxCommits);
      requireMatchingCommitSubjects(statusSubjects, gitSubjects);
    }
    await requireNoUnreportedIssueWorktrees(args.repoPath, args.issueId, status);
    console.log(`ok handoff ${args.issueId}`);
    return 0;
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
