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

function nextMinorFromVersion(version: string): string {
  const [major, minor] = version.split(".").map(Number);
  return `${major}.${minor + 1}.0`;
}

async function nextPatchVersion(): Promise<string> {
  const [major, minor, patch] = (await currentPackageVersion()).split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

async function nextMinorVersion(): Promise<string> {
  return nextMinorFromVersion(await currentPackageVersion());
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

test("closeout verifier accepts squash/import release evidence on mainline", async () => {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), "linear-ai-release-repo-"));
  const release = await withTempFile("linear-ai-closeout-release-", ".json", JSON.stringify({
    statusCheckRollup: [
      { name: "Release main CI", status: "COMPLETED", conclusion: "SUCCESS" }
    ],
    files: [
      { path: "dist/manifest.json", contains: "\"version\":\"2026.06.14\"" }
    ]
  }));

  try {
    assert.equal((await runCommand("git", ["init"], repoDir)).code, 0);
    assert.equal((await runCommand("git", ["config", "user.email", "test@example.com"], repoDir)).code, 0);
    assert.equal((await runCommand("git", ["config", "user.name", "Test User"], repoDir)).code, 0);
    await mkdir(path.join(repoDir, "dist"), { recursive: true });
    await writeFile(path.join(repoDir, "dist", "manifest.json"), "{\"version\":\"2026.06.14\",\"source\":\"import\"}\n");
    assert.equal((await runCommand("git", ["add", "dist/manifest.json"], repoDir)).code, 0);
    assert.equal((await runCommand("git", ["commit", "-m", "chore: import release artifacts"], repoDir)).code, 0);

    const result = await runBun("verify_closeout.ts", [
      "--issue-id",
      "HCL-7",
      "--release",
      release.file,
      "--repo",
      repoDir,
      "--base",
      "HEAD"
    ]);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /ok closeout HCL-7 via release evidence/);
  } finally {
    await rm(repoDir, { recursive: true, force: true });
    await rm(release.dir, { recursive: true, force: true });
  }
});

test("closeout verifier rejects release evidence without mainline content or successful CI", async () => {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), "linear-ai-release-reject-repo-"));
  const wrongContent = await withTempFile("linear-ai-closeout-release-wrong-content-", ".json", JSON.stringify({
    statusCheckRollup: [
      { name: "Release main CI", status: "COMPLETED", conclusion: "SUCCESS" }
    ],
    files: [
      { path: "dist/manifest.json", contains: "\"version\":\"2026.06.14\"" }
    ]
  }));
  const failedCi = await withTempFile("linear-ai-closeout-release-failed-ci-", ".json", JSON.stringify({
    statusCheckRollup: [
      { name: "Release main CI", status: "COMPLETED", conclusion: "FAILURE" }
    ],
    files: [
      { path: "dist/manifest.json", contains: "\"version\":\"2026.06.13\"" }
    ]
  }));

  try {
    assert.equal((await runCommand("git", ["init"], repoDir)).code, 0);
    assert.equal((await runCommand("git", ["config", "user.email", "test@example.com"], repoDir)).code, 0);
    assert.equal((await runCommand("git", ["config", "user.name", "Test User"], repoDir)).code, 0);
    await mkdir(path.join(repoDir, "dist"), { recursive: true });
    await writeFile(path.join(repoDir, "dist", "manifest.json"), "{\"version\":\"2026.06.13\",\"source\":\"import\"}\n");
    assert.equal((await runCommand("git", ["add", "dist/manifest.json"], repoDir)).code, 0);
    assert.equal((await runCommand("git", ["commit", "-m", "chore: import release artifacts"], repoDir)).code, 0);

    const wrongContentResult = await runBun("verify_closeout.ts", [
      "--issue-id",
      "HCL-7",
      "--release",
      wrongContent.file,
      "--repo",
      repoDir,
      "--base",
      "HEAD"
    ]);
    const failedCiResult = await runBun("verify_closeout.ts", [
      "--issue-id",
      "HCL-7",
      "--release",
      failedCi.file,
      "--repo",
      repoDir,
      "--base",
      "HEAD"
    ]);
    const missingRepoResult = await runBun("verify_closeout.ts", [
      "--issue-id",
      "HCL-7",
      "--release",
      wrongContent.file
    ]);

    assert.notEqual(wrongContentResult.code, 0);
    assert.match(wrongContentResult.stderr, /must contain expected release evidence/);
    assert.notEqual(failedCiResult.code, 0);
    assert.match(failedCiResult.stderr, /check Release main CI must be successful before closeout/);
    assert.notEqual(missingRepoResult.code, 0);
    assert.match(missingRepoResult.stderr, /--release requires --repo/);
  } finally {
    await rm(repoDir, { recursive: true, force: true });
    await rm(wrongContent.dir, { recursive: true, force: true });
    await rm(failedCi.dir, { recursive: true, force: true });
  }
});

test("closeout verifier checks PR commits when closing a moved issue", async () => {
  const movedPr = await withTempFile("linear-ai-closeout-moved-pr-", ".json", JSON.stringify({
    url: "https://github.com/example/linear-ai/pull/7",
    state: "MERGED",
    baseRefName: "main",
    mergeCommit: { oid: "abc123" },
    commits: [
      { messageHeadline: "fix(HCL-7): close moved issue path" }
    ],
    statusCheckRollup: [
      { name: "Test and package skills", status: "COMPLETED", conclusion: "SUCCESS" }
    ]
  }));
  const wrongPr = await withTempFile("linear-ai-closeout-moved-pr-wrong-id-", ".json", JSON.stringify({
    url: "https://github.com/example/linear-ai/pull/8",
    state: "MERGED",
    baseRefName: "main",
    mergeCommit: { oid: "def456" },
    commits: [
      { messageHeadline: "fix(ABC-8): close moved issue path" }
    ],
    statusCheckRollup: [
      { name: "Test and package skills", status: "COMPLETED", conclusion: "SUCCESS" }
    ]
  }));
  try {
    const movedResult = await runBun("verify_closeout.ts", [
      "--issue-id",
      "ENG-22",
      "--implemented-issue-id",
      "HCL-7",
      "--pr",
      movedPr.file
    ]);
    const wrongResult = await runBun("verify_closeout.ts", [
      "--issue-id",
      "ENG-22",
      "--implemented-issue-id",
      "HCL-7",
      "--pr",
      wrongPr.file
    ]);

    assert.equal(movedResult.code, 0, movedResult.stderr);
    assert.match(movedResult.stdout, /ok closeout ENG-22 via implemented issue HCL-7/);
    assert.notEqual(wrongResult.code, 0);
    assert.match(wrongResult.stderr, /moved issue PR evidence must mention implemented issue ID HCL-7/);
  } finally {
    await rm(movedPr.dir, { recursive: true, force: true });
    await rm(wrongPr.dir, { recursive: true, force: true });
  }
});

test("closeout verifier accepts direct issue commit with successful checks", async () => {
  const commit = await withTempFile("linear-ai-closeout-commit-", ".json", JSON.stringify({
    oid: "abc123",
    subject: "fix(HCL-7): close direct commit path",
    statusCheckRollup: [
      { name: "Test and package skills", status: "COMPLETED", conclusion: "SUCCESS" },
      { name: "Optional release dispatch", status: "COMPLETED", conclusion: "NEUTRAL" }
    ]
  }));
  try {
    const result = await runBun("verify_closeout.ts", ["--issue-id", "HCL-7", "--commit", commit.file]);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /ok closeout HCL-7/);
  } finally {
    await rm(commit.dir, { recursive: true, force: true });
  }
});

test("closeout verifier accepts moved issue when implemented ID has a different team prefix", async () => {
  const commit = await withTempFile("linear-ai-closeout-moved-issue-", ".json", JSON.stringify({
    oid: "abc123",
    subject: "fix(HCL-7): close direct commit path before team move",
    statusCheckRollup: [
      { name: "Test and package skills", status: "COMPLETED", conclusion: "SUCCESS" }
    ]
  }));
  try {
    const result = await runBun("verify_closeout.ts", [
      "--issue-id",
      "ENG-22",
      "--implemented-issue-id",
      "HCL-7",
      "--commit",
      commit.file
    ]);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /ok closeout ENG-22 via implemented issue HCL-7/);
  } finally {
    await rm(commit.dir, { recursive: true, force: true });
  }
});

test("closeout verifier limits implemented issue override to cross-team moves", async () => {
  const commit = await withTempFile("linear-ai-closeout-same-prefix-move-", ".json", JSON.stringify({
    oid: "abc123",
    subject: "fix(HCL-7): close direct commit path",
    statusCheckRollup: [
      { name: "Test and package skills", status: "COMPLETED", conclusion: "SUCCESS" }
    ]
  }));
  try {
    const sameIssueResult = await runBun("verify_closeout.ts", [
      "--issue-id",
      "HCL-7",
      "--implemented-issue-id",
      "HCL-7",
      "--commit",
      commit.file
    ]);
    const samePrefixResult = await runBun("verify_closeout.ts", [
      "--issue-id",
      "HCL-8",
      "--implemented-issue-id",
      "HCL-7",
      "--commit",
      commit.file
    ]);

    assert.notEqual(sameIssueResult.code, 0);
    assert.match(sameIssueResult.stderr, /must differ from --issue-id/);
    assert.notEqual(samePrefixResult.code, 0);
    assert.match(samePrefixResult.stderr, /different Linear team prefix/);
  } finally {
    await rm(commit.dir, { recursive: true, force: true });
  }
});

test("closeout verifier rejects direct commit without issue ID or successful checks", async () => {
  const wrongIssue = await withTempFile("linear-ai-closeout-wrong-issue-", ".json", JSON.stringify({
    oid: "abc123",
    subject: "fix(HCL-8): close direct commit path",
    statusCheckRollup: [
      { name: "Test and package skills", status: "COMPLETED", conclusion: "SUCCESS" }
    ]
  }));
  const failingCheck = await withTempFile("linear-ai-closeout-failing-commit-", ".json", JSON.stringify({
    oid: "abc123",
    subject: "fix(HCL-7): close direct commit path",
    statusCheckRollup: [
      { name: "Test and package skills", status: "COMPLETED", conclusion: "FAILURE" }
    ]
  }));
  const missingChecks = await withTempFile("linear-ai-closeout-missing-commit-checks-", ".json", JSON.stringify({
    oid: "abc123",
    subject: "fix(HCL-7): close direct commit path",
    statusCheckRollup: []
  }));
  try {
    const wrongIssueResult = await runBun("verify_closeout.ts", ["--issue-id", "HCL-7", "--commit", wrongIssue.file]);
    const failingCheckResult = await runBun("verify_closeout.ts", ["--issue-id", "HCL-7", "--commit", failingCheck.file]);
    const missingChecksResult = await runBun("verify_closeout.ts", ["--issue-id", "HCL-7", "--commit", missingChecks.file]);

    assert.notEqual(wrongIssueResult.code, 0);
    assert.match(wrongIssueResult.stderr, /commit evidence must mention issue ID HCL-7/);
    assert.notEqual(failingCheckResult.code, 0);
    assert.match(failingCheckResult.stderr, /check Test and package skills must be successful before closeout/);
    assert.notEqual(missingChecksResult.code, 0);
    assert.match(missingChecksResult.stderr, /at least one commit status check is required before closeout/);
  } finally {
    await rm(wrongIssue.dir, { recursive: true, force: true });
    await rm(failingCheck.dir, { recursive: true, force: true });
    await rm(missingChecks.dir, { recursive: true, force: true });
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
  const expectedVersion = await nextMinorVersion();
  const result = await runBun("create_release.ts", [`v${expectedVersion}`, "--dry-run"]);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`would create release v${expectedVersion.replaceAll(".", "\\.")}`));
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
    const initialPackageJson = JSON.parse(await Bun.file(path.join(dir, "package.json")).text()) as { version: string };
    const expectedVersion = nextMinorFromVersion(initialPackageJson.version);
    const result = await runCommand(process.execPath, [
      path.join(ROOT, "scripts", "create_release.ts"),
      "minor",
      "--repo-dir",
      dir,
      "--no-commit"
    ], dir);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`prepared release v${expectedVersion.replaceAll(".", "\\.")}`));

    const packageJson = JSON.parse(await Bun.file(path.join(dir, "package.json")).text());
    const codexManifest = JSON.parse(await Bun.file(path.join(dir, ".codex-plugin", "plugin.json")).text());
    const claudeManifest = JSON.parse(await Bun.file(path.join(dir, ".claude-plugin", "plugin.json")).text());
    assert.equal(packageJson.version, expectedVersion);
    assert.equal(codexManifest.version, expectedVersion);
    assert.equal(claudeManifest.version, expectedVersion);
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
