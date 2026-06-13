import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { test } from "bun:test";
import YAML from "yaml";

const ROOT = path.resolve(import.meta.dirname, "..");

type RunResult = {
  stdout: string;
  stderr: string;
  code: number | null;
};

function runBun(script: string, args: string[] = []): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, "scripts", script), ...args], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

function runCommand(command: string, args: string[], cwd: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

async function withTempFile(prefix: string, suffix: string, content: string): Promise<{ dir: string; file: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  const file = path.join(dir, `input${suffix}`);
  await writeFile(file, content);
  return { dir, file };
}

function reviewReadyStatusYaml(overrides: string = ""): string {
  const base = YAML.parse(`schema: linear-ai.status.v1
issue_id: CIV-999
plan_revision: 1
status_revision: 1
implementation_status: review_ready
draft_prs:
  - repository: web
    url: https://github.com/example/web/pull/999
completed_items:
  - I1
blocked_items: []
skipped_items: []
placeholders: []
questions: []
verification:
  - check: bun test
    result: passed
    reason: Full suite passed.
recommended_labels_to_apply:
  - llm-review
recommended_labels_to_remove:
  - llm-ready
  - llm-active
recommended_status: In Review
commits:
  - subject: "feat(CIV-999): add review handoff gate"
final_destination: feature_branch_pr
workspace_cleanup:
  status: cleaned
  kept: []
`);
  const patch = overrides.trim() ? YAML.parse(overrides) : {};
  return YAML.stringify({ ...base, ...patch });
}

function reviewReadyDashboardYaml(overrides: string = ""): string {
  const base = YAML.parse(`schema: linear-ai.dashboard.v1
issue_id: CIV-999
dashboard_revision: 1
plan_revision: 1
current_phase: review-handoff
llm_state: llm-review
sp_phases:
  - sp-plan
  - sp-implement
  - sp-verify
tasks:
  - id: T1
    state: done
    symbol: "✓"
    title: Add handoff gate
    evidence: scripts/verify_handoff.ts
    last_checked: "bun test"
blockers: []
next_step: Review PR.
updated_by: linear-ai
`);
  const patch = overrides.trim() ? YAML.parse(overrides) : {};
  return YAML.stringify({ ...base, ...patch });
}

async function currentPackageVersion(): Promise<string> {
  const packageJson = JSON.parse(await Bun.file(path.join(ROOT, "package.json")).text()) as { version: string };
  return packageJson.version;
}

async function nextPatchVersion(): Promise<string> {
  const [major, minor, patch] = (await currentPackageVersion()).split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

function markedStatus(yaml: string): string {
  return `<!-- linear-ai:status v1 issue=CIV-999 plan_rev=1 status_rev=1 -->
\`\`\`yaml
${yaml}\`\`\`
<!-- /linear-ai:status -->
`;
}

function markedDashboard(yaml: string): string {
  return `<!-- linear-ai:dashboard v1 issue=CIV-999 dashboard_rev=1 -->
\`\`\`yaml
${yaml}\`\`\`
<!-- /linear-ai:dashboard -->
`;
}

function markedReadyPlan(ids: string[] = ["T1"], revision = 1): string {
  const items = ids.map((id) => `  - id: ${id}
    repository: web
    task: Task ${id}.
    status: todo`).join("\n");
  return `<!-- linear-ai:plan v1 issue=CIV-999 rev=${revision} -->
\`\`\`yaml
schema: linear-ai.plan.v1
issue_id: CIV-999
revision: ${revision}
plan_status: ready
source_issue_url: https://linear.app/civora/issue/CIV-999/example
parent_issue_id:
target_repositories:
  - web
labels_to_apply:
  - llm-ready
labels_to_remove:
  - llm-refine
split_recommendation:
  recommended: false
  reason:
accepted_unknowns: []
open_questions: []
implementation_checklist:
${items}
acceptance_criteria:
  - id: A1
    criterion: It works.
verification:
  - id: V1
    command_or_check: Run tests.
do_not_assume:
  - Do not guess.
\`\`\`
<!-- /linear-ai:plan -->
`;
}

test("validator accepts valid plan, status, and dashboard examples", async () => {
  const result = await runBun("validate_marked_comments.ts", [
    path.join(ROOT, "examples", "plan-comment.md"),
    path.join(ROOT, "examples", "status-comment.md"),
    path.join(ROOT, "examples", "dashboard-comment.md")
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /examples\/plan-comment\.md plan/);
  assert.match(result.stdout, /examples\/status-comment\.md status/);
  assert.match(result.stdout, /examples\/dashboard-comment\.md dashboard/);
});

test("validator rejects ready plans with unresolved open questions", async () => {
  const { dir, file } = await withTempFile("linear-ai-plan-", ".md", `<!-- linear-ai:plan v1 issue=CIV-999 rev=1 -->
\`\`\`yaml
schema: linear-ai.plan.v1
issue_id: CIV-999
revision: 1
plan_status: ready
source_issue_url: https://linear.app/civora/issue/CIV-999/example
parent_issue_id:
target_repositories:
  - web
labels_to_apply: []
labels_to_remove: []
split_recommendation:
  recommended: false
  reason:
accepted_unknowns: []
open_questions:
  - What should happen?
implementation_checklist:
  - id: I1
    repository: web
    task: Do the thing.
    status: todo
acceptance_criteria:
  - id: A1
    criterion: It works.
verification:
  - id: V1
    command_or_check: Run tests.
do_not_assume:
  - Do not guess.
\`\`\`
<!-- /linear-ai:plan -->
`);
  try {
    const result = await runBun("validate_marked_comments.ts", [file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /ready plan has open questions not listed as accepted unknowns/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("validator rejects status without verification", async () => {
  const { dir, file } = await withTempFile("linear-ai-status-", ".md", `<!-- linear-ai:status v1 issue=CIV-999 plan_rev=1 status_rev=1 -->
\`\`\`yaml
schema: linear-ai.status.v1
issue_id: CIV-999
plan_revision: 1
status_revision: 1
implementation_status: blocked
draft_prs: []
completed_items: []
blocked_items: []
skipped_items: []
placeholders: []
questions: []
verification: []
recommended_labels_to_apply: []
recommended_labels_to_remove: []
recommended_status: Blocked
commits: []
final_destination: undecided
workspace_cleanup:
  status: pending
  kept: []
\`\`\`
<!-- /linear-ai:status -->
`);
  try {
    const result = await runBun("validate_marked_comments.ts", [file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /verification.*fewer than 1 items/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("validator rejects invalid status verification result", async () => {
  const { dir, file } = await withTempFile("linear-ai-status-result-", ".md", `<!-- linear-ai:status v1 issue=CIV-999 plan_rev=1 status_rev=1 -->
\`\`\`yaml
schema: linear-ai.status.v1
issue_id: CIV-999
plan_revision: 1
status_revision: 1
implementation_status: active
draft_prs: []
completed_items: []
blocked_items: []
skipped_items: []
placeholders: []
questions: []
verification:
  - check: make test
    result: pass
    reason: Human shorthand should not pass schema validation.
recommended_labels_to_apply: []
recommended_labels_to_remove: []
recommended_status: In Progress
commits: []
final_destination: undecided
workspace_cleanup:
  status: pending
  kept: []
\`\`\`
<!-- /linear-ai:status -->
`);
  try {
    const result = await runBun("validate_marked_comments.ts", [file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /verification\/0\/result.*allowed values/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("validator rejects invalid dashboard task state", async () => {
  const { dir, file } = await withTempFile("linear-ai-dashboard-", ".md", `<!-- linear-ai:dashboard v1 issue=CIV-999 dashboard_rev=1 -->
\`\`\`yaml
schema: linear-ai.dashboard.v1
issue_id: CIV-999
dashboard_revision: 1
plan_revision: 1
current_phase: implement
llm_state: llm-active
sp_phases:
  - sp-plan
tasks:
  - id: T1
    state: in_progress
    symbol: "●"
    title: Use invalid task state.
    evidence: test
    last_checked: test
blockers: []
next_step: Fix the marker.
updated_by: linear-ai
\`\`\`
<!-- /linear-ai:dashboard -->
`);
  try {
    const result = await runBun("validate_marked_comments.ts", [file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /tasks\/0\/state.*allowed values/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("validator rejects duplicate dashboard comments", async () => {
  const dashboard = markedDashboard(reviewReadyDashboardYaml());
  const { dir, file } = await withTempFile("linear-ai-dashboard-duplicate-", ".md", `${dashboard}\n${dashboard}`);
  try {
    const result = await runBun("validate_marked_comments.ts", [file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /multiple dashboard comments found/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("validator accepts canonical dashboard from issue description", async () => {
  const description = await withTempFile("linear-ai-description-dashboard-", ".md", markedDashboard(reviewReadyDashboardYaml()));
  const status = await withTempFile("linear-ai-description-status-", ".md", markedStatus(reviewReadyStatusYaml()));
  try {
    const result = await runBun("validate_marked_comments.ts", ["--description", description.file, status.file]);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /dashboard-description/);
    assert.match(result.stdout, /status/);
  } finally {
    await rm(description.dir, { recursive: true, force: true });
    await rm(status.dir, { recursive: true, force: true });
  }
});

test("validator rejects dashboard comments when description has canonical dashboard", async () => {
  const description = await withTempFile("linear-ai-description-dashboard-", ".md", markedDashboard(reviewReadyDashboardYaml()));
  const comment = await withTempFile("linear-ai-comment-dashboard-", ".md", markedDashboard(reviewReadyDashboardYaml()));
  try {
    const result = await runBun("validate_marked_comments.ts", ["--description", description.file, comment.file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /dashboard comments are fallback-only when description dashboard exists/);
  } finally {
    await rm(description.dir, { recursive: true, force: true });
    await rm(comment.dir, { recursive: true, force: true });
  }
});

test("validator rejects dashboard drift from latest ready plan revision", async () => {
  const dashboard = markedDashboard(reviewReadyDashboardYaml("plan_revision: 1\n"));
  const { dir, file } = await withTempFile("linear-ai-dashboard-stale-plan-", ".md", `${markedReadyPlan(["T1"], 2)}\n${dashboard}`);
  try {
    const result = await runBun("validate_marked_comments.ts", [file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /dashboard plan_revision must match latest ready plan revision 2/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("validator rejects dashboard task IDs outside latest ready plan", async () => {
  const dashboard = markedDashboard(reviewReadyDashboardYaml("tasks:\n  - id: T2\n    state: todo\n    symbol: \"□\"\n    title: Unknown task\n    evidence: \"\"\n    last_checked: \"latest ready plan\"\n"));
  const { dir, file } = await withTempFile("linear-ai-dashboard-task-ids-", ".md", `${markedReadyPlan(["T1"], 1)}\n${dashboard}`);
  try {
    const result = await runBun("validate_marked_comments.ts", [file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /dashboard task id T2 is not in latest ready plan/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("validator rejects dashboard task without repair evidence", async () => {
  const dashboard = markedDashboard(reviewReadyDashboardYaml("tasks:\n  - id: T1\n    state: active\n    symbol: \"●\"\n    title: Missing repair evidence\n    evidence: \"\"\n    last_checked: \"\"\n"));
  const { dir, file } = await withTempFile("linear-ai-dashboard-repair-evidence-", ".md", dashboard);
  try {
    const result = await runBun("validate_marked_comments.ts", [file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /tasks\/0\/last_checked.*fewer than 1 characters/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("validator rejects schema fields not declared in marked comment schemas", async () => {
  const badStatus = await withTempFile("linear-ai-status-extra-field-", ".md", markedStatus(reviewReadyStatusYaml(
    `unexpected_schema_drift: true
`
  )));
  const badDashboard = await withTempFile("linear-ai-dashboard-extra-field-", ".md", markedDashboard(reviewReadyDashboardYaml(
    `unexpected_schema_drift: true
`
  )));
  try {
    const statusResult = await runBun("validate_marked_comments.ts", [badStatus.file]);
    const dashboardResult = await runBun("validate_marked_comments.ts", [badDashboard.file]);

    assert.notEqual(statusResult.code, 0);
    assert.match(statusResult.stderr, /must NOT have additional properties|unexpected_schema_drift/);
    assert.notEqual(dashboardResult.code, 0);
    assert.match(dashboardResult.stderr, /must NOT have additional properties|unexpected_schema_drift/);
  } finally {
    await rm(badStatus.dir, { recursive: true, force: true });
    await rm(badDashboard.dir, { recursive: true, force: true });
  }
});

test("handoff verifier accepts review-ready status and completed dashboard", async () => {
  const status = await withTempFile("linear-ai-handoff-status-", ".md", `<!-- linear-ai:status v1 issue=CIV-999 plan_rev=1 status_rev=1 -->
\`\`\`yaml
schema: linear-ai.status.v1
issue_id: CIV-999
plan_revision: 1
status_revision: 1
implementation_status: review_ready
draft_prs:
  - repository: web
    url: https://github.com/example/web/pull/999
completed_items:
  - I1
blocked_items: []
skipped_items: []
placeholders: []
questions: []
verification:
  - check: bun test
    result: passed
    reason: Full suite passed.
recommended_labels_to_apply:
  - llm-review
recommended_labels_to_remove:
  - llm-ready
  - llm-active
recommended_status: In Review
commits:
  - subject: "feat(CIV-999): add review handoff gate"
final_destination: feature_branch_pr
workspace_cleanup:
  status: cleaned
  kept: []
\`\`\`
<!-- /linear-ai:status -->
`);
  const dashboard = await withTempFile("linear-ai-handoff-dashboard-", ".md", `<!-- linear-ai:dashboard v1 issue=CIV-999 dashboard_rev=1 -->
\`\`\`yaml
schema: linear-ai.dashboard.v1
issue_id: CIV-999
dashboard_revision: 1
plan_revision: 1
current_phase: review-handoff
llm_state: llm-review
sp_phases:
  - sp-plan
  - sp-implement
  - sp-verify
tasks:
  - id: T1
    state: done
    symbol: "✓"
    title: Add handoff gate
    evidence: scripts/verify_handoff.ts
    last_checked: scripts/verify_handoff.ts
blockers: []
next_step: Review PR.
updated_by: linear-ai
\`\`\`
<!-- /linear-ai:dashboard -->
`);
  const commits = await withTempFile("linear-ai-handoff-commits-", ".txt", "feat(CIV-999): add review handoff gate\n");

  try {
    const result = await runBun("verify_handoff.ts", [
      "--issue-id",
      "CIV-999",
      "--status",
      status.file,
      "--dashboard",
      dashboard.file,
      "--commits",
      commits.file
    ]);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /ok handoff CIV-999/);
  } finally {
    await rm(status.dir, { recursive: true, force: true });
    await rm(dashboard.dir, { recursive: true, force: true });
    await rm(commits.dir, { recursive: true, force: true });
  }
});

test("closeout verifier accepts merged PR with successful checks", async () => {
  const pr = await withTempFile("linear-ai-closeout-pr-", ".json", JSON.stringify({
    url: "https://github.com/example/linear-ai/pull/7",
    state: "MERGED",
    baseRefName: "main",
    mergeCommit: { oid: "abc123" },
    statusCheckRollup: [
      { name: "Test and package skills", status: "COMPLETED", conclusion: "SUCCESS" },
      { name: "Dispatch release for release tag", status: "COMPLETED", conclusion: "SKIPPED" }
    ]
  }));
  try {
    const result = await runBun("verify_closeout.ts", ["--issue-id", "HCL-7", "--pr", pr.file]);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /ok closeout HCL-7/);
  } finally {
    await rm(pr.dir, { recursive: true, force: true });
  }
});

test("closeout verifier rejects unmerged PRs and pending checks", async () => {
  const unmerged = await withTempFile("linear-ai-closeout-unmerged-", ".json", JSON.stringify({
    url: "https://github.com/example/linear-ai/pull/7",
    state: "OPEN",
    baseRefName: "main",
    mergeCommit: null,
    statusCheckRollup: [
      { name: "Test and package skills", status: "COMPLETED", conclusion: "SUCCESS" }
    ]
  }));
  const pending = await withTempFile("linear-ai-closeout-pending-", ".json", JSON.stringify({
    url: "https://github.com/example/linear-ai/pull/7",
    state: "MERGED",
    baseRefName: "main",
    mergeCommit: { oid: "abc123" },
    statusCheckRollup: [
      { name: "Test and package skills", status: "IN_PROGRESS", conclusion: "" }
    ]
  }));
  try {
    const unmergedResult = await runBun("verify_closeout.ts", ["--issue-id", "HCL-7", "--pr", unmerged.file]);
    const pendingResult = await runBun("verify_closeout.ts", ["--issue-id", "HCL-7", "--pr", pending.file]);

    assert.notEqual(unmergedResult.code, 0);
    assert.match(unmergedResult.stderr, /PR state must be MERGED/);
    assert.notEqual(pendingResult.code, 0);
    assert.match(pendingResult.stderr, /check Test and package skills must be completed before closeout/);
  } finally {
    await rm(unmerged.dir, { recursive: true, force: true });
    await rm(pending.dir, { recursive: true, force: true });
  }
});

test("handoff verifier accepts review-ready dashboard from issue description", async () => {
  const status = await withTempFile("linear-ai-description-handoff-status-", ".md", markedStatus(reviewReadyStatusYaml()));
  const description = await withTempFile("linear-ai-description-handoff-dashboard-", ".md", markedDashboard(reviewReadyDashboardYaml()));
  try {
    const result = await runBun("verify_handoff.ts", [
      "--issue-id",
      "CIV-999",
      "--status",
      status.file,
      "--description",
      description.file
    ]);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /ok handoff CIV-999/);
  } finally {
    await rm(status.dir, { recursive: true, force: true });
    await rm(description.dir, { recursive: true, force: true });
  }
});

test("handoff verifier rejects bad commit subject", async () => {
  const status = await withTempFile("linear-ai-bad-handoff-status-", ".md", `<!-- linear-ai:status v1 issue=CIV-999 plan_rev=1 status_rev=1 -->
\`\`\`yaml
schema: linear-ai.status.v1
issue_id: CIV-999
plan_revision: 1
status_revision: 1
implementation_status: review_ready
draft_prs: []
completed_items:
  - I1
blocked_items: []
skipped_items: []
placeholders: []
questions: []
verification:
  - check: bun test
    result: passed
    reason: Full suite passed.
recommended_labels_to_apply:
  - llm-review
recommended_labels_to_remove: []
recommended_status: In Review
commits:
  - subject: "add review handoff gate"
final_destination: feature_branch_pr
workspace_cleanup:
  status: cleaned
  kept: []
\`\`\`
<!-- /linear-ai:status -->
`);
  const dashboard = await withTempFile("linear-ai-bad-handoff-dashboard-", ".md", `<!-- linear-ai:dashboard v1 issue=CIV-999 dashboard_rev=1 -->
\`\`\`yaml
schema: linear-ai.dashboard.v1
issue_id: CIV-999
dashboard_revision: 1
plan_revision: 1
current_phase: review-handoff
llm_state: llm-review
sp_phases:
  - sp-plan
tasks:
  - id: T1
    state: done
    symbol: "✓"
    title: Add handoff gate
    evidence: scripts/verify_handoff.ts
    last_checked: scripts/verify_handoff.ts
blockers: []
next_step: Review PR.
updated_by: linear-ai
\`\`\`
<!-- /linear-ai:dashboard -->
`);

  try {
    const result = await runBun("verify_handoff.ts", [
      "--issue-id",
      "CIV-999",
      "--status",
      status.file,
      "--dashboard",
      dashboard.file
    ]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /commit subject must use semver\/conventional syntax with issue ID CIV-999/);
  } finally {
    await rm(status.dir, { recursive: true, force: true });
    await rm(dashboard.dir, { recursive: true, force: true });
  }
});

test("handoff verifier rejects pending workspace cleanup", async () => {
  const status = await withTempFile("linear-ai-pending-cleanup-status-", ".md", `<!-- linear-ai:status v1 issue=CIV-999 plan_rev=1 status_rev=1 -->
\`\`\`yaml
schema: linear-ai.status.v1
issue_id: CIV-999
plan_revision: 1
status_revision: 1
implementation_status: review_ready
draft_prs: []
completed_items:
  - I1
blocked_items: []
skipped_items: []
placeholders: []
questions: []
verification:
  - check: bun test
    result: passed
    reason: Full suite passed.
recommended_labels_to_apply:
  - llm-review
recommended_labels_to_remove: []
recommended_status: In Review
commits:
  - subject: "feat(CIV-999): add review handoff gate"
final_destination: feature_branch_pr
workspace_cleanup:
  status: pending
  kept: []
\`\`\`
<!-- /linear-ai:status -->
`);
  const dashboard = await withTempFile("linear-ai-pending-cleanup-dashboard-", ".md", `<!-- linear-ai:dashboard v1 issue=CIV-999 dashboard_rev=1 -->
\`\`\`yaml
schema: linear-ai.dashboard.v1
issue_id: CIV-999
dashboard_revision: 1
plan_revision: 1
current_phase: review-handoff
llm_state: llm-review
sp_phases:
  - sp-plan
tasks:
  - id: T1
    state: done
    symbol: "✓"
    title: Add handoff gate
    evidence: scripts/verify_handoff.ts
    last_checked: scripts/verify_handoff.ts
blockers: []
next_step: Review PR.
updated_by: linear-ai
\`\`\`
<!-- /linear-ai:dashboard -->
`);

  try {
    const result = await runBun("verify_handoff.ts", [
      "--issue-id",
      "CIV-999",
      "--status",
      status.file,
      "--dashboard",
      dashboard.file
    ]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /workspace_cleanup.status must be cleaned or intentionally_kept/);
  } finally {
    await rm(status.dir, { recursive: true, force: true });
    await rm(dashboard.dir, { recursive: true, force: true });
  }
});

test("handoff verifier rejects non-review-ready status", async () => {
  const status = await withTempFile("linear-ai-active-handoff-status-", ".md", markedStatus(reviewReadyStatusYaml(
    `implementation_status: active
`
  )));
  const dashboard = await withTempFile("linear-ai-active-handoff-dashboard-", ".md", markedDashboard(reviewReadyDashboardYaml()));
  try {
    const result = await runBun("verify_handoff.ts", ["--issue-id", "CIV-999", "--status", status.file, "--dashboard", dashboard.file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /implementation_status must be review_ready/);
  } finally {
    await rm(status.dir, { recursive: true, force: true });
    await rm(dashboard.dir, { recursive: true, force: true });
  }
});

test("handoff verifier rejects missing llm-review label", async () => {
  const status = await withTempFile("linear-ai-label-handoff-status-", ".md", markedStatus(reviewReadyStatusYaml(
    `recommended_labels_to_apply:
  - llm-active
`
  )));
  const dashboard = await withTempFile("linear-ai-label-handoff-dashboard-", ".md", markedDashboard(reviewReadyDashboardYaml()));
  try {
    const result = await runBun("verify_handoff.ts", ["--issue-id", "CIV-999", "--status", status.file, "--dashboard", dashboard.file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /recommended_labels_to_apply must include llm-review/);
  } finally {
    await rm(status.dir, { recursive: true, force: true });
    await rm(dashboard.dir, { recursive: true, force: true });
  }
});

test("handoff verifier rejects failed verification and undecided destination", async () => {
  const status = await withTempFile("linear-ai-verification-handoff-status-", ".md", markedStatus(reviewReadyStatusYaml(
    `verification:
  - check: bun test
    result: failed
    reason: Tests failed.
final_destination: undecided
`
  )));
  const dashboard = await withTempFile("linear-ai-verification-handoff-dashboard-", ".md", markedDashboard(reviewReadyDashboardYaml()));
  try {
    const result = await runBun("verify_handoff.ts", ["--issue-id", "CIV-999", "--status", status.file, "--dashboard", dashboard.file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /verification\[0\]\.result must be passed/);
  } finally {
    await rm(status.dir, { recursive: true, force: true });
    await rm(dashboard.dir, { recursive: true, force: true });
  }
});

test("handoff verifier rejects undecided final destination", async () => {
  const status = await withTempFile("linear-ai-destination-handoff-status-", ".md", markedStatus(reviewReadyStatusYaml(
    `final_destination: undecided
`
  )));
  const dashboard = await withTempFile("linear-ai-destination-handoff-dashboard-", ".md", markedDashboard(reviewReadyDashboardYaml()));
  try {
    const result = await runBun("verify_handoff.ts", ["--issue-id", "CIV-999", "--status", status.file, "--dashboard", dashboard.file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /final_destination must be main or feature_branch_pr/);
  } finally {
    await rm(status.dir, { recursive: true, force: true });
    await rm(dashboard.dir, { recursive: true, force: true });
  }
});

test("handoff verifier rejects dashboard not ready or with blockers", async () => {
  const status = await withTempFile("linear-ai-dashboard-state-status-", ".md", markedStatus(reviewReadyStatusYaml()));
  const dashboard = await withTempFile("linear-ai-dashboard-state-dashboard-", ".md", markedDashboard(reviewReadyDashboardYaml(
    `llm_state: llm-active
blockers:
  - Waiting for cleanup.
`
  )));
  try {
    const result = await runBun("verify_handoff.ts", ["--issue-id", "CIV-999", "--status", status.file, "--dashboard", dashboard.file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /dashboard llm_state must be llm-review/);
  } finally {
    await rm(status.dir, { recursive: true, force: true });
    await rm(dashboard.dir, { recursive: true, force: true });
  }
});

test("handoff verifier rejects dashboard blockers", async () => {
  const status = await withTempFile("linear-ai-dashboard-blockers-status-", ".md", markedStatus(reviewReadyStatusYaml()));
  const dashboard = await withTempFile("linear-ai-dashboard-blockers-dashboard-", ".md", markedDashboard(reviewReadyDashboardYaml(
    `blockers:
  - Waiting for cleanup.
`
  )));
  try {
    const result = await runBun("verify_handoff.ts", ["--issue-id", "CIV-999", "--status", status.file, "--dashboard", dashboard.file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /dashboard blockers must be empty/);
  } finally {
    await rm(status.dir, { recursive: true, force: true });
    await rm(dashboard.dir, { recursive: true, force: true });
  }
});

test("handoff verifier rejects unfinished dashboard task", async () => {
  const status = await withTempFile("linear-ai-dashboard-task-status-", ".md", markedStatus(reviewReadyStatusYaml()));
  const dashboard = await withTempFile("linear-ai-dashboard-task-dashboard-", ".md", markedDashboard(reviewReadyDashboardYaml(
    `tasks:
  - id: T1
    state: active
    symbol: "●"
    title: Add handoff gate
    evidence: scripts/verify_handoff.ts
    last_checked: scripts/verify_handoff.ts
`
  )));
  try {
    const result = await runBun("verify_handoff.ts", ["--issue-id", "CIV-999", "--status", status.file, "--dashboard", dashboard.file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /dashboard tasks\[0\] must be done with ✓/);
  } finally {
    await rm(status.dir, { recursive: true, force: true });
    await rm(dashboard.dir, { recursive: true, force: true });
  }
});

test("handoff verifier rejects intentionally kept cleanup without details", async () => {
  const status = await withTempFile("linear-ai-kept-cleanup-status-", ".md", markedStatus(reviewReadyStatusYaml(
    `workspace_cleanup:
  status: intentionally_kept
  kept: []
`
  )));
  const dashboard = await withTempFile("linear-ai-kept-cleanup-dashboard-", ".md", markedDashboard(reviewReadyDashboardYaml()));
  try {
    const result = await runBun("verify_handoff.ts", ["--issue-id", "CIV-999", "--status", status.file, "--dashboard", dashboard.file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /intentionally kept workspaces must be listed/);
  } finally {
    await rm(status.dir, { recursive: true, force: true });
    await rm(dashboard.dir, { recursive: true, force: true });
  }
});

test("handoff verifier requires git commits file to match status commits", async () => {
  const status = await withTempFile("linear-ai-commit-match-status-", ".md", markedStatus(reviewReadyStatusYaml()));
  const dashboard = await withTempFile("linear-ai-commit-match-dashboard-", ".md", markedDashboard(reviewReadyDashboardYaml()));
  const commits = await withTempFile("linear-ai-commit-match-", ".txt", "fix(CIV-999): different real commit\n");
  try {
    const result = await runBun("verify_handoff.ts", [
      "--issue-id",
      "CIV-999",
      "--status",
      status.file,
      "--dashboard",
      dashboard.file,
      "--commits",
      commits.file
    ]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /commit subjects from --commits must match status commits/);
  } finally {
    await rm(status.dir, { recursive: true, force: true });
    await rm(dashboard.dir, { recursive: true, force: true });
    await rm(commits.dir, { recursive: true, force: true });
  }
});

test("handoff verifier rejects too many commits", async () => {
  const status = await withTempFile("linear-ai-commit-count-status-", ".md", markedStatus(reviewReadyStatusYaml(
    `commits:
  - subject: "feat(CIV-999): add first change"
  - subject: "fix(CIV-999): add second change"
`
  )));
  const dashboard = await withTempFile("linear-ai-commit-count-dashboard-", ".md", markedDashboard(reviewReadyDashboardYaml()));
  try {
    const result = await runBun("verify_handoff.ts", [
      "--issue-id",
      "CIV-999",
      "--status",
      status.file,
      "--dashboard",
      dashboard.file,
      "--max-commits",
      "1"
    ]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /commit count 2 exceeds max 1/);
  } finally {
    await rm(status.dir, { recursive: true, force: true });
    await rm(dashboard.dir, { recursive: true, force: true });
  }
});

test("handoff verifier rejects unreported issue worktree", async () => {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), "linear-ai-worktree-repo-"));
  const linkedDir = `${repoDir}-CIV-999-lane`;
  const status = await withTempFile("linear-ai-worktree-status-", ".md", markedStatus(reviewReadyStatusYaml()));
  const dashboard = await withTempFile("linear-ai-worktree-dashboard-", ".md", markedDashboard(reviewReadyDashboardYaml()));

  try {
    assert.equal((await runCommand("git", ["init"], repoDir)).code, 0);
    assert.equal((await runCommand("git", ["config", "user.email", "test@example.com"], repoDir)).code, 0);
    assert.equal((await runCommand("git", ["config", "user.name", "Test User"], repoDir)).code, 0);
    await writeFile(path.join(repoDir, "README.md"), "test\n");
    assert.equal((await runCommand("git", ["add", "README.md"], repoDir)).code, 0);
    assert.equal((await runCommand("git", ["commit", "-m", "chore(CIV-999): initial test repo"], repoDir)).code, 0);
    assert.equal((await runCommand("git", ["worktree", "add", "-b", "CIV-999-lane", linkedDir], repoDir)).code, 0);

    const result = await runBun("verify_handoff.ts", [
      "--issue-id",
      "CIV-999",
      "--status",
      status.file,
      "--dashboard",
      dashboard.file,
      "--repo",
      repoDir
    ]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /unreported issue worktree remains/);
  } finally {
    await runCommand("git", ["worktree", "remove", "--force", linkedDir], repoDir).catch(() => ({ stdout: "", stderr: "", code: 1 }));
    await rm(repoDir, { recursive: true, force: true });
    await rm(linkedDir, { recursive: true, force: true });
    await rm(status.dir, { recursive: true, force: true });
    await rm(dashboard.dir, { recursive: true, force: true });
  }
});

test("handoff verifier accepts intentionally kept reported issue worktree", async () => {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), "linear-ai-kept-worktree-repo-"));
  const linkedDir = `${repoDir}-CIV-999-lane`;
  const status = await withTempFile("linear-ai-kept-worktree-status-", ".md", markedStatus(reviewReadyStatusYaml(
    `workspace_cleanup:
  status: intentionally_kept
  kept:
    - path: ${JSON.stringify(linkedDir)}
      branch: CIV-999-lane
`
  )));
  const dashboard = await withTempFile("linear-ai-kept-worktree-dashboard-", ".md", markedDashboard(reviewReadyDashboardYaml()));

  try {
    assert.equal((await runCommand("git", ["init"], repoDir)).code, 0);
    assert.equal((await runCommand("git", ["config", "user.email", "test@example.com"], repoDir)).code, 0);
    assert.equal((await runCommand("git", ["config", "user.name", "Test User"], repoDir)).code, 0);
    await writeFile(path.join(repoDir, "README.md"), "test\n");
    assert.equal((await runCommand("git", ["add", "README.md"], repoDir)).code, 0);
    assert.equal((await runCommand("git", ["commit", "-m", "chore(CIV-999): initial test repo"], repoDir)).code, 0);
    assert.equal((await runCommand("git", ["worktree", "add", "-b", "CIV-999-lane", linkedDir], repoDir)).code, 0);

    const result = await runBun("verify_handoff.ts", [
      "--issue-id",
      "CIV-999",
      "--status",
      status.file,
      "--dashboard",
      dashboard.file,
      "--repo",
      repoDir
    ]);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /ok handoff CIV-999/);
  } finally {
    await runCommand("git", ["worktree", "remove", "--force", linkedDir], repoDir).catch(() => ({ stdout: "", stderr: "", code: 1 }));
    await rm(repoDir, { recursive: true, force: true });
    await rm(linkedDir, { recursive: true, force: true });
    await rm(status.dir, { recursive: true, force: true });
    await rm(dashboard.dir, { recursive: true, force: true });
  }
});

test("validator rejects plan checklist items missing repository", async () => {
  const { dir, file } = await withTempFile("linear-ai-plan-item-", ".md", `<!-- linear-ai:plan v1 issue=CIV-999 rev=1 -->
\`\`\`yaml
schema: linear-ai.plan.v1
issue_id: CIV-999
revision: 1
plan_status: ready
source_issue_url: https://linear.app/civora/issue/CIV-999/example
parent_issue_id:
target_repositories:
  - web
labels_to_apply: []
labels_to_remove: []
split_recommendation:
  recommended: false
  reason:
accepted_unknowns: []
open_questions: []
implementation_checklist:
  - id: I1
    task: Do the thing.
    status: todo
acceptance_criteria:
  - id: A1
    criterion: It works.
verification:
  - id: V1
    command_or_check: Run tests.
do_not_assume:
  - Do not guess.
\`\`\`
<!-- /linear-ai:plan -->
`);
  try {
    const result = await runBun("validate_marked_comments.ts", [file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /implementation_checklist\/0.*required property 'repository'/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("validator rejects multiple llm state labels in plan and status comments", async () => {
  const badPlan = await withTempFile("linear-ai-plan-labels-", ".md", `<!-- linear-ai:plan v1 issue=CIV-999 rev=1 -->
\`\`\`yaml
schema: linear-ai.plan.v1
issue_id: CIV-999
revision: 1
plan_status: ready
source_issue_url: https://linear.app/civora/issue/CIV-999/example
parent_issue_id:
target_repositories:
  - web
labels_to_apply:
  - llm-ready
  - llm-active
labels_to_remove: []
split_recommendation:
  recommended: false
  reason:
accepted_unknowns: []
open_questions: []
implementation_checklist:
  - id: I1
    repository: web
    task: Do the thing.
    status: todo
acceptance_criteria:
  - id: A1
    criterion: It works.
verification:
  - id: V1
    command_or_check: Run tests.
do_not_assume:
  - Do not guess.
\`\`\`
<!-- /linear-ai:plan -->
`);
  const badStatus = await withTempFile("linear-ai-status-labels-", ".md", `<!-- linear-ai:status v1 issue=CIV-999 plan_rev=1 status_rev=1 -->
\`\`\`yaml
schema: linear-ai.status.v1
issue_id: CIV-999
plan_revision: 1
status_revision: 1
implementation_status: blocked
draft_prs: []
completed_items: []
blocked_items: []
skipped_items: []
placeholders: []
questions: []
verification:
  - check: make test
    result: not_run
    reason: Blocked before tests.
recommended_labels_to_apply:
  - llm-active
  - llm-blocked
recommended_labels_to_remove: []
recommended_status: Blocked
commits: []
final_destination: undecided
workspace_cleanup:
  status: pending
  kept: []
\`\`\`
<!-- /linear-ai:status -->
`);
  try {
    const planResult = await runBun("validate_marked_comments.ts", [badPlan.file]);
    const statusResult = await runBun("validate_marked_comments.ts", [badStatus.file]);

    assert.notEqual(planResult.code, 0);
    assert.match(planResult.stderr, /labels_to_apply may contain only one llm workflow state label/);
    assert.notEqual(statusResult.code, 0);
    assert.match(statusResult.stderr, /recommended_labels_to_apply may contain only one llm workflow state label/);
  } finally {
    await rm(badPlan.dir, { recursive: true, force: true });
    await rm(badStatus.dir, { recursive: true, force: true });
  }
});

test("validator rejects plan labels missing from Linear metadata snapshot", async () => {
  const metadata = await withTempFile("linear-ai-metadata-", ".json", JSON.stringify({
    teams: [{ name: "Civora" }],
    labels: [
      { name: "llm-ready", parent: "LLM" },
      { name: "llm-refine", parent: "LLM" }
    ]
  }));
  const plan = await withTempFile("linear-ai-plan-label-metadata-", ".md", `<!-- linear-ai:plan v1 issue=CIV-999 rev=1 -->
\`\`\`yaml
schema: linear-ai.plan.v1
issue_id: CIV-999
revision: 1
plan_status: ready
source_issue_url: https://linear.app/civora/issue/CIV-999/example
parent_issue_id:
target_repositories:
  - web
labels_to_apply:
  - llm-ready
  - MissingLabel
labels_to_remove:
  - llm-refine
split_recommendation:
  recommended: false
  reason:
accepted_unknowns: []
open_questions: []
implementation_checklist:
  - id: I1
    repository: web
    task: Do the thing.
    status: todo
acceptance_criteria:
  - id: A1
    criterion: It works.
verification:
  - id: V1
    command_or_check: Run tests.
do_not_assume:
  - Do not guess.
\`\`\`
<!-- /linear-ai:plan -->
`);
  try {
    const result = await runBun("validate_marked_comments.ts", ["--metadata", metadata.file, plan.file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /labels_to_apply contains unknown Linear label MissingLabel/);
  } finally {
    await rm(metadata.dir, { recursive: true, force: true });
    await rm(plan.dir, { recursive: true, force: true });
  }
});

test("extractor returns latest plan by default and latest status or dashboard when requested", async () => {
  const { dir, file } = await withTempFile("linear-ai-thread-", ".md", `Human comment.

<!-- linear-ai:plan v1 issue=CIV-1 rev=1 -->
\`\`\`yaml
schema: linear-ai.plan.v1
revision: 1
\`\`\`
<!-- /linear-ai:plan -->

<!-- linear-ai:status v1 issue=CIV-1 plan_rev=1 status_rev=2 -->
\`\`\`yaml
schema: linear-ai.status.v1
status_revision: 2
\`\`\`
<!-- /linear-ai:status -->

<!-- linear-ai:dashboard v1 issue=CIV-1 dashboard_rev=3 -->
\`\`\`yaml
schema: linear-ai.dashboard.v1
dashboard_revision: 3
\`\`\`
<!-- /linear-ai:dashboard -->

<!-- linear-ai:plan v1 issue=CIV-1 rev=2 -->
\`\`\`yaml
schema: linear-ai.plan.v1
revision: 2
\`\`\`
<!-- /linear-ai:plan -->
`);
  try {
    const planResult = await runBun("extract_marked_comment.ts", [file]);
    const statusResult = await runBun("extract_marked_comment.ts", ["--kind", "status", file]);
    const dashboardResult = await runBun("extract_marked_comment.ts", ["--kind", "dashboard", file]);
    const anyResult = await runBun("extract_marked_comment.ts", ["--kind", "any", file]);

    assert.equal(planResult.code, 0, planResult.stderr);
    assert.match(planResult.stdout, /rev=2/);
    assert.match(planResult.stdout, /revision: 2/);
    assert.doesNotMatch(planResult.stdout, /revision: 1/);
    assert.equal(statusResult.code, 0, statusResult.stderr);
    assert.match(statusResult.stdout, /status_rev=2/);
    assert.match(statusResult.stdout, /status_revision: 2/);
    assert.equal(dashboardResult.code, 0, dashboardResult.stderr);
    assert.match(dashboardResult.stdout, /dashboard_rev=3/);
    assert.match(dashboardResult.stdout, /dashboard_revision: 3/);
    assert.equal(anyResult.code, 0, anyResult.stderr);
    assert.match(anyResult.stdout, /rev=2/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("extractor fails when no matching comment exists", async () => {
  const { dir, file } = await withTempFile("linear-ai-thread-empty-", ".md", "plain human comment");
  try {
    const result = await runBun("extract_marked_comment.ts", ["--kind", "status", file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /no marked status comment found/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("renderer renders bug and feature issues and rejects missing fields", async () => {
  const bug = await withTempFile("linear-ai-bug-", ".yaml", `type: bug
title: Login redirects to blank page
problem: Users cannot reach the app after logging in.
expected_behavior: User lands on the dashboard.
actual_behavior: Browser renders a blank callback page.
reproduction_steps:
  - Open the app.
  - Log in with valid credentials.
  - Observe the blank callback page.
context:
  - "Environment: production"
  - "Related repos: web, backend"
evidence_links:
  - Screenshot attached in Linear.
`);
  const feature = await withTempFile("linear-ai-feature-", ".yaml", `type: feature
title: Show recent workflow runs
problem_opportunity: Operators cannot spot recent workflow failures quickly.
desired_outcome: Overview shows recent runs and statuses.
user_actor: Internal operator.
current_behavior: Overview omits workflow run status.
proposed_behavior: Add a recent workflow runs section.
context:
  - "Product area: project overview"
  - "Related repos: web, backend"
evidence_links:
  - Related operator note.
`);
  const badBug = await withTempFile("linear-ai-bad-bug-", ".yaml", `type: bug
title: Missing expected behavior
problem: Something broke.
actual_behavior: It fails.
reproduction_steps:
  - Trigger it.
context:
  - "Environment: staging"
evidence_links: []
`);
  try {
    const bugResult = await runBun("render_issue.ts", [bug.file]);
    const featureResult = await runBun("render_issue.ts", [feature.file]);
    const badBugResult = await runBun("render_issue.ts", [badBug.file]);

    assert.equal(bugResult.code, 0, bugResult.stderr);
    assert.match(bugResult.stdout, /# Login redirects to blank page/);
    assert.match(bugResult.stdout, /## Expected Behavior/);
    assert.match(bugResult.stdout, /1\. Open the app\./);
    assert.doesNotMatch(bugResult.stdout, /## Priority/);
    assert.equal(featureResult.code, 0, featureResult.stderr);
    assert.match(featureResult.stdout, /# Show recent workflow runs/);
    assert.match(featureResult.stdout, /## Problem \/ Opportunity/);
    assert.match(featureResult.stdout, /Internal operator\./);
    assert.notEqual(badBugResult.code, 0);
    assert.match(badBugResult.stderr, /expected_behavior is required/);
  } finally {
    await rm(bug.dir, { recursive: true, force: true });
    await rm(feature.dir, { recursive: true, force: true });
    await rm(badBug.dir, { recursive: true, force: true });
  }
});

test("linear metadata helper summarizes and validates teams and labels", async () => {
  const metadata = await withTempFile("linear-ai-metadata-", ".json", JSON.stringify({
    teams: [{ name: "Civora" }, { name: "H-cloud" }],
    projects: [{ name: "Public Beta", teams: [{ name: "Civora" }] }],
    labels: [
      { name: "Web", parent: "Component" },
      { name: "API", parent: "Component" },
      { name: "Bug", parent: "Type" },
      { name: "llm-refine", parent: "LLM" }
    ]
  }));
  try {
    const summary = await runBun("linear_metadata.ts", ["summary", "--metadata", metadata.file]);
    assert.equal(summary.code, 0, summary.stderr);
    const parsed = JSON.parse(summary.stdout);
    assert.deepEqual(parsed.teams, ["Civora", "H-cloud"]);
    assert.deepEqual(parsed.projects, ["Public Beta"]);
    assert.deepEqual(parsed.component_tags, ["API", "Web"]);
    assert.deepEqual(parsed.labels, ["API", "Bug", "Web", "llm-refine"]);

    const valid = await runBun("linear_metadata.ts", [
      "validate",
      "--metadata",
      metadata.file,
      "--target-team",
      "Civora",
      "--target-project",
      "Public Beta",
      "--selected-labels",
      "Web,Bug,llm-refine",
      "--type-label",
      "Bug",
      "--llm-label",
      "llm-refine"
    ]);
    assert.equal(valid.code, 0, valid.stderr);
    assert.match(valid.stdout, /ok Linear metadata/);

    const invalid = await runBun("linear_metadata.ts", [
      "validate",
      "--metadata",
      metadata.file,
      "--target-team",
      "Civora",
      "--target-project",
      "Unknown Project",
      "--selected-labels",
      "Mobile"
    ]);
    assert.notEqual(invalid.code, 0);
    assert.match(invalid.stderr, /target project Unknown Project is not an available Linear project/);
    assert.match(invalid.stderr, /selected label Mobile is not an available Linear label/);
  } finally {
    await rm(metadata.dir, { recursive: true, force: true });
  }
});

test("linear metadata helper captures raw Linear MCP list results", async () => {
  const teams = await withTempFile("linear-ai-teams-", ".json", JSON.stringify({
    teams: [
      { id: "team-1", name: "Civora" },
      { id: "team-2", name: "H-cloud" }
    ],
    hasNextPage: false
  }));
  const projects = await withTempFile("linear-ai-projects-", ".json", JSON.stringify([
    {
      projects: [
        { id: "project-1", name: "Public Beta", teams: [{ id: "team-1", name: "Civora" }] }
      ],
      hasNextPage: true,
      cursor: "project-1"
    },
    {
      projects: [
        { id: "project-2", name: "CMS", teams: [{ id: "team-2", name: "H-cloud" }] }
      ],
      hasNextPage: false
    }
  ]));
  const labels = await withTempFile("linear-ai-labels-", ".json", JSON.stringify({
    labels: [
      { id: "label-1", name: "Feature", parent: "Type" },
      { id: "label-2", name: "Bug", parent: "Type" },
      { id: "label-3", name: "llm-refine", parent: "LLM" },
      { id: "label-4", name: "llm-ready", parent: "LLM" }
    ],
    hasNextPage: false
  }));

  try {
    const result = await runBun("linear_metadata.ts", [
      "capture",
      "--teams",
      teams.file,
      "--projects",
      projects.file,
      "--labels",
      labels.file
    ]);

    assert.equal(result.code, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.deepEqual(parsed.teams, [{ name: "Civora" }, { name: "H-cloud" }]);
    assert.deepEqual(parsed.projects, [
      { name: "Public Beta", teams: [{ name: "Civora" }] },
      { name: "CMS", teams: [{ name: "H-cloud" }] }
    ]);
    assert.deepEqual(parsed.labels, [
      { name: "Feature", parent: "Type" },
      { name: "Bug", parent: "Type" },
      { name: "llm-refine", parent: "LLM" },
      { name: "llm-ready", parent: "LLM" }
    ]);
    assert.match(result.stderr, /warning: missing Type labels: Improvement/);
    assert.match(result.stderr, /warning: missing LLM labels: llm-active, llm-blocked, llm-review, llm-split/);
  } finally {
    await rm(teams.dir, { recursive: true, force: true });
    await rm(projects.dir, { recursive: true, force: true });
    await rm(labels.dir, { recursive: true, force: true });
  }
});

test("intake command renders issue body and metadata from validated Linear metadata", async () => {
  const metadata = await withTempFile("linear-ai-metadata-", ".json", JSON.stringify({
    teams: [{ name: "Civora" }],
    projects: [{ name: "Public Beta", teams: [{ name: "Civora" }] }],
    labels: [
      { name: "Web", parent: "Component" },
      { name: "Integration", parent: "Workflow" },
      { name: "Feature", parent: "Type" },
      { name: "llm-refine", parent: "LLM" }
    ]
  }));
  const input = await withTempFile("linear-ai-intake-", ".yaml", `type: feature
title: Show recent workflow runs
target_team: Civora
target_project: Public Beta
selected_labels:
  - Web
  - Integration
add_llm_refine: true
problem_opportunity: Operators cannot spot recent workflow failures quickly.
desired_outcome: Overview shows recent runs and statuses.
user_actor: Internal operator.
current_behavior: Overview omits workflow run status.
proposed_behavior: Add a recent workflow runs section.
context:
  - "Product area: project overview"
evidence_links: []
`);
  try {
    const result = await runBun("intake_issue.ts", ["--metadata", metadata.file, input.file]);

    assert.equal(result.code, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.match(parsed.issue_body, /# Show recent workflow runs/);
    assert.match(parsed.issue_body, /Target team: Civora/);
    assert.match(parsed.issue_body, /Target project: Public Beta/);
    assert.match(parsed.issue_body, /Suggested labels: Web, Integration/);
    assert.deepEqual(parsed.metadata.labels_to_apply, ["Feature", "Web", "Integration", "llm-refine"]);
    assert.equal(parsed.metadata.target_team, "Civora");
    assert.equal(parsed.metadata.target_project, "Public Beta");
  } finally {
    await rm(metadata.dir, { recursive: true, force: true });
    await rm(input.dir, { recursive: true, force: true });
  }
});

test("runner detector returns the first available JavaScript package runner", async () => {
  const result = await runBun("detect_runner.ts");

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout.trim(), /^(bun|pnpm|npm|yarn|node)$/);
});

test("release creator dry-runs semver level bumps", async () => {
  const result = await runBun("create_release.ts", ["patch", "--dry-run"]);
  const expectedVersion = await nextPatchVersion();

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`would create release v${expectedVersion.replaceAll(".", "\\.")}`));
  assert.match(result.stdout, /mode: dry-run/);
});

test("release creator dry-runs explicit release versions", async () => {
  const result = await runBun("create_release.ts", ["v0.6.0", "--dry-run"]);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /would create release v0\.6\.0/);
});

test("release creator rejects invalid release versions", async () => {
  const result = await runBun("create_release.ts", ["v0.6", "--dry-run"]);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /release must be major, minor, patch, or vX.Y.Z/);
});

test("release creator syncs package and plugin versions without committing", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "linear-ai-release-"));
  try {
    assert.equal((await runCommand("git", ["clone", ROOT, dir], os.tmpdir())).code, 0);
    const result = await runCommand(process.execPath, [
      path.join(ROOT, "scripts", "create_release.ts"),
      "minor",
      "--repo-dir",
      dir,
      "--no-commit"
    ], dir);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /prepared release v0\.6\.0/);

    const packageJson = JSON.parse(await Bun.file(path.join(dir, "package.json")).text());
    const codexManifest = JSON.parse(await Bun.file(path.join(dir, ".codex-plugin", "plugin.json")).text());
    const claudeManifest = JSON.parse(await Bun.file(path.join(dir, ".claude-plugin", "plugin.json")).text());
    assert.equal(packageJson.version, "0.6.0");
    assert.equal(codexManifest.version, "0.6.0");
    assert.equal(claudeManifest.version, "0.6.0");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("marketplace generator creates metadata-only source refs", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "linear-ai-marketplace-"));
  try {
    const result = await runBun("generate_marketplace_specs.ts", ["--out-dir", dir, "--version", "package"]);

    assert.equal(result.code, 0, result.stderr);
    assert.equal(await Bun.file(path.join(dir, "plugins", "linear-ai", "package.json")).exists(), false);

    const version = JSON.parse(await Bun.file(path.join(ROOT, "package.json")).text()).version;
    const codex = JSON.parse(await Bun.file(path.join(dir, ".agents", "plugins", "marketplace.json")).text());
    const claude = JSON.parse(await Bun.file(path.join(dir, ".claude-plugin", "marketplace.json")).text());
    assert.deepEqual(codex.plugins[0].source, {
      source: "url",
      url: "https://github.com/lkshrk/linear-ai.git",
      ref: `v${version}`
    });
    assert.deepEqual(claude.plugins[0].source, {
      source: "url",
      url: "https://github.com/lkshrk/linear-ai.git",
      ref: `v${version}`
    });
    assert.match(await Bun.file(path.join(dir, "README.md")).text(), /source code is not vendored/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("marketplace publisher only bumps linear-ai manifest entries", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "linear-ai-marketplace-publish-"));
  const sourceRepo = path.join(dir, "source");
  const bareRepo = path.join(dir, "marketplace.git");
  const checkout = path.join(dir, "checkout");
  try {
    await mkdir(path.join(sourceRepo, ".agents", "plugins"), { recursive: true });
    await mkdir(path.join(sourceRepo, ".claude-plugin"), { recursive: true });
    await mkdir(path.join(sourceRepo, "plugins", "other-plugin"), { recursive: true });
    await writeFile(path.join(sourceRepo, "README.md"), "# lkshrk Agent Marketplace\n\nDo not rewrite me.\n");
    await writeFile(path.join(sourceRepo, "plugins", "other-plugin", "keep.txt"), "kept\n");
    await writeFile(path.join(sourceRepo, ".agents", "plugins", "marketplace.json"), `${JSON.stringify({
      name: "lkshrk",
      plugins: [
        {
          name: "linear-ai",
          source: {
            source: "url",
            url: "https://github.com/lkshrk/linear-ai.git",
            ref: "v0.5.1"
          }
        },
        {
          name: "other-plugin",
          source: {
            source: "url",
            url: "https://github.com/lkshrk/other-plugin.git",
            ref: "v1.2.3"
          }
        }
      ]
    }, null, 2)}\n`);
    await writeFile(path.join(sourceRepo, ".claude-plugin", "marketplace.json"), `${JSON.stringify({
      name: "lkshrk",
      metadata: {
        description: "Agent plugin marketplace.",
        version: "9.9.9"
      },
      plugins: [
        {
          name: "linear-ai",
          source: {
            source: "url",
            url: "https://github.com/lkshrk/linear-ai.git",
            ref: "v0.5.1"
          },
          version: "0.5.1"
        },
        {
          name: "other-plugin",
          source: {
            source: "url",
            url: "https://github.com/lkshrk/other-plugin.git",
            ref: "v1.2.3"
          },
          version: "1.2.3"
        }
      ]
    }, null, 2)}\n`);

    assert.equal((await runCommand("git", ["init"], sourceRepo)).code, 0);
    assert.equal((await runCommand("git", ["config", "user.name", "Test Bot"], sourceRepo)).code, 0);
    assert.equal((await runCommand("git", ["config", "user.email", "test@example.com"], sourceRepo)).code, 0);
    assert.equal((await runCommand("git", ["add", "."], sourceRepo)).code, 0);
    assert.equal((await runCommand("git", ["commit", "-m", "seed marketplace"], sourceRepo)).code, 0);
    assert.equal((await runCommand("git", ["clone", "--bare", sourceRepo, bareRepo], dir)).code, 0);

    const result = await runBun("publish_marketplace.ts", [
      "--marketplace-repo",
      bareRepo,
      "--version",
      "v0.6.0",
      "--push"
    ]);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /ok marketplace bump v0\.6\.0/);

    assert.equal((await runCommand("git", ["clone", bareRepo, checkout], dir)).code, 0);
    const codex = JSON.parse(await Bun.file(path.join(checkout, ".agents", "plugins", "marketplace.json")).text());
    const claude = JSON.parse(await Bun.file(path.join(checkout, ".claude-plugin", "marketplace.json")).text());
    assert.equal(codex.plugins.find((plugin: { name: string }) => plugin.name === "linear-ai").source.ref, "v0.6.0");
    assert.equal(codex.plugins.find((plugin: { name: string }) => plugin.name === "other-plugin").source.ref, "v1.2.3");
    assert.equal(claude.plugins.find((plugin: { name: string }) => plugin.name === "linear-ai").source.ref, "v0.6.0");
    assert.equal(claude.plugins.find((plugin: { name: string }) => plugin.name === "linear-ai").version, "0.6.0");
    assert.equal(claude.plugins.find((plugin: { name: string }) => plugin.name === "other-plugin").source.ref, "v1.2.3");
    assert.equal(claude.metadata.version, "9.9.9");
    assert.equal(await Bun.file(path.join(checkout, "README.md")).text(), "# lkshrk Agent Marketplace\n\nDo not rewrite me.\n");
    assert.equal(await Bun.file(path.join(checkout, "plugins", "other-plugin", "keep.txt")).text(), "kept\n");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
