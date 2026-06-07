import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { test } from "bun:test";

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

async function withTempFile(prefix: string, suffix: string, content: string): Promise<{ dir: string; file: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  const file = path.join(dir, `input${suffix}`);
  await writeFile(file, content);
  return { dir, file };
}

test("validator accepts valid plan and status examples", async () => {
  const result = await runBun("validate_marked_comments.ts", [
    path.join(ROOT, "examples", "plan-comment.md"),
    path.join(ROOT, "examples", "status-comment.md")
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /examples\/plan-comment\.md plan/);
  assert.match(result.stdout, /examples\/status-comment\.md status/);
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
\`\`\`
<!-- /linear-ai:status -->
`);
  try {
    const result = await runBun("validate_marked_comments.ts", [file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /verification must contain at least one item/);
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
\`\`\`
<!-- /linear-ai:status -->
`);
  try {
    const result = await runBun("validate_marked_comments.ts", [file]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /verification\[0\]\.result is invalid/);
  } finally {
    await rm(dir, { recursive: true, force: true });
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
    assert.match(result.stderr, /implementation_checklist\[0\]\.repository is required/);
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

test("extractor returns latest plan by default and latest status when requested", async () => {
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

    assert.equal(planResult.code, 0, planResult.stderr);
    assert.match(planResult.stdout, /rev=2/);
    assert.match(planResult.stdout, /revision: 2/);
    assert.doesNotMatch(planResult.stdout, /revision: 1/);
    assert.equal(statusResult.code, 0, statusResult.stderr);
    assert.match(statusResult.stdout, /status_rev=2/);
    assert.match(statusResult.stdout, /status_revision: 2/);
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

    const valid = await runBun("linear_metadata.ts", [
      "validate",
      "--metadata",
      metadata.file,
      "--target-team",
      "Civora",
      "--target-project",
      "Public Beta",
      "--component-tag",
      "Web",
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
      "--component-tag",
      "Mobile"
    ]);
    assert.notEqual(invalid.code, 0);
    assert.match(invalid.stderr, /target project Unknown Project is not an available Linear project/);
    assert.match(invalid.stderr, /component tag Mobile is not an available Component label/);
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
    assert.match(result.stderr, /warning: no Component labels found/);
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
      { name: "Feature", parent: "Type" },
      { name: "llm-refine", parent: "LLM" }
    ]
  }));
  const input = await withTempFile("linear-ai-intake-", ".yaml", `type: feature
title: Show recent workflow runs
target_team: Civora
target_project: Public Beta
component_tag: Web
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
    assert.match(parsed.issue_body, /Component tag: Web/);
    assert.deepEqual(parsed.metadata.labels_to_apply, ["Feature", "Web", "llm-refine"]);
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
