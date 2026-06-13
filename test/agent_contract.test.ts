import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { test } from "bun:test";

const ROOT = path.resolve(import.meta.dirname, "..");

async function readDoc(filePath: string): Promise<string> {
  return readFile(path.join(ROOT, filePath), "utf8");
}

async function readAgent(name: string): Promise<string> {
  return readDoc(path.join("agents", `${name}.md`));
}

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

test("all runnable agents load required passes", async () => {
  for (const agent of ["issue-intake", "questioner", "implementer", "orchestrator"]) {
    assert.match(await readAgent(agent), /docs\/agent-required-passes\.md/, `${agent} must load required passes`);
  }
});

test("questioner requires local grill pass before ready", async () => {
  const prompt = await readAgent("questioner");

  assert.match(prompt, /Mandatory Local Grill Pass/);
  assert.match(prompt, /Do not set `plan_status: ready`/);
  assert.match(prompt, /grill-me/);
});

test("questioner self-finalizes ready label transition", async () => {
  const prompt = await readAgent("questioner");

  assert.match(prompt, /If Linear MCP write tools are available/);
  assert.match(prompt, /add `llm-ready`/);
  assert.match(prompt, /remove all other `llm-\*` states/);
  assert.match(prompt, /REQUIRED_LINEAR_MUTATIONS/);
});

test("implementer self-finalizes workflow labels", async () => {
  const prompt = await readAgent("implementer");

  assert.match(prompt, /If Linear MCP write tools are available/);
  assert.match(prompt, /add `llm-active`/);
  assert.match(prompt, /add `llm-blocked`/);
  assert.match(prompt, /add `llm-review`/);
  assert.match(prompt, /remove all other `llm-\*` states/);
  assert.match(prompt, /REQUIRED_LINEAR_MUTATIONS/);
});

test("implementer uses parallel subagents with tool and worktree isolation", async () => {
  const implementerAgent = await readAgent("implementer");
  const implementerDoc = await readDoc("docs/implementer.md");
  const implementSkill = await readDoc("skills/linear-implement/SKILL.md");

  for (const source of [implementerAgent, implementerDoc, implementSkill]) {
    assert.match(source, /subagents/i);
    assert.match(source, /parallel/i);
    assert.match(source, /independent/i);
    assert.match(source, /worktree/i);
    assert.match(source, /tools and permissions/i);
    assert.match(source, /merge back/i);
  }
});

test("implementer enforces commit hygiene and asks final branch destination", async () => {
  const implementerAgent = await readAgent("implementer");
  const implementerDoc = await readDoc("docs/implementer.md");
  const implementSkill = await readDoc("skills/linear-implement/SKILL.md");

  for (const source of [implementerAgent, implementerDoc, implementSkill]) {
    assert.match(source, /reasonable amount of commits/i);
    assert.match(source, /semver/i);
    assert.match(source, /issue ID/i);
    assert.match(source, /main/i);
    assert.match(source, /feature branch/i);
    assert.match(source, /PR/i);
  }
});

test("implementer cleans up temporary workspaces after merge", async () => {
  const implementerAgent = await readAgent("implementer");
  const implementerDoc = await readDoc("docs/implementer.md");
  const implementSkill = await readDoc("skills/linear-implement/SKILL.md");

  for (const source of [implementerAgent, implementerDoc, implementSkill]) {
    assert.match(source, /clean up/i);
    assert.match(source, /workspaces/i);
    assert.match(source, /worktrees/i);
    assert.match(source, /temporary/i);
    assert.match(source, /intentionally kept/i);
  }
});

test("required passes define unique llm state", async () => {
  const doc = await readDoc("docs/agent-required-passes.md");

  assert.match(doc, /Exactly one `llm-\*` workflow state label may be present/);
  assert.match(doc, /remove every other `llm-\*` workflow state label/);
});

test("issue intake asks or proposes target team, target project, and component tag", async () => {
  const issueIntakeAgent = await readAgent("issue-intake");
  const issueIntakeContract = await readDoc("docs/issue-intake.md");
  const bugTemplate = await readDoc("templates/linear-bug-issue.md");
  const featureTemplate = await readDoc("templates/linear-feature-issue.md");

  for (const source of [issueIntakeAgent, issueIntakeContract]) {
    assert.match(source, /target team/i);
    assert.match(source, /target project/i);
    assert.match(source, /component tag/i);
    assert.match(source, /ask or propose/i);
    assert.match(source, /query available Linear teams/i);
    assert.match(source, /query available Linear projects/i);
    assert.match(source, /query available Linear labels/i);
    assert.match(source, /do not use stale or hardcoded tag lists/i);
  }

  for (const template of [bugTemplate, featureTemplate]) {
    assert.match(template, /Target team:/);
    assert.match(template, /Target project:/);
    assert.match(template, /Component tag:/);
  }
});

test("plugin exposes intuitive Linear workflow skills", async () => {
  const manifest = JSON.parse(await readDoc(".codex-plugin/plugin.json"));
  const claudeManifest = JSON.parse(await readDoc(".claude-plugin/plugin.json"));
  const skillNames = (await readdir(path.join(ROOT, "skills"))).sort();
  const skillPaths = skillNames.map((skillName) => `./skills/${skillName}`);

  assert.equal(manifest.name, "linear-ai");
  assert.equal(manifest.skills, "./skills/");
  assert.equal(claudeManifest.name, "linear-ai");
  assert.deepEqual(claudeManifest.skills.toSorted(), skillPaths);
  assert.deepEqual(skillNames, [
    "linear-close",
    "linear-create-issue",
    "linear-deliver-feature",
    "linear-doctor",
    "linear-implement",
    "linear-refine",
    "linear-status"
  ]);

  for (const skillName of skillNames) {
    const skill = await readDoc(path.join("skills", skillName, "SKILL.md"));
    assert.match(skill, new RegExp(`name: ${skillName}`));
  }

  const combined = await readDoc("skills/linear-deliver-feature/SKILL.md");
  assert.match(combined, /linear-create-issue/);
  assert.match(combined, /linear-refine/);
  assert.match(combined, /linear-implement/);
  assert.match(combined, /linear-close/);
  assert.match(combined, /linear-status/);
  assert.match(combined, /review/i);
});

test("self review catches stale naming and legacy helper drift", async () => {
  const packageJson = JSON.parse(await readDoc("package.json"));
  assert.match(packageJson.scripts["self-review"], /self_review\.ts/);

  const result = await runBun("self_review.ts");
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /ok self review/);
});

test("install smoke verifies plugin manifests and skill paths", async () => {
  const packageJson = JSON.parse(await readDoc("package.json"));
  assert.match(packageJson.scripts["install:smoke"], /install_smoke\.ts/);

  const result = await runBun("install_smoke.ts");
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /ok install smoke/);
});

test("linear deliver feature defines an explicit lifecycle state machine", async () => {
  const skill = await readDoc("skills/linear-deliver-feature/SKILL.md");

  for (const state of [
    "detect-current-state",
    "capture-metadata",
    "create-issue",
    "refine-plan",
    "implement",
    "validate-comments",
    "review-handoff",
    "closeout",
    "final-linear-mutations"
  ]) {
    assert.match(skill, new RegExp(state), `missing lifecycle state ${state}`);
  }

  assert.match(skill, /linear_metadata\.ts capture/);
  assert.match(skill, /validate_marked_comments\.ts/);
  assert.match(skill, /llm-review/);
  assert.match(skill, /Done/);
  assert.match(skill, /Stop Conditions/);
  assert.match(skill, /Do not advance/);
  assert.match(skill, /Start by running `linear-status`/);
  assert.match(skill, /resume from the detected phase/);
});

test("linear close skill defines post-merge closeout guard", async () => {
  const closeSkill = await readDoc("skills/linear-close/SKILL.md");
  const closeAgent = await readAgent("closer");
  const workflowDoc = await readDoc("docs/workflow.md");

  for (const source of [closeSkill, closeAgent, workflowDoc]) {
    assert.match(source, /merged PR/i);
    assert.match(source, /mainline|main/i);
    assert.match(source, /CI/i);
    assert.match(source, /Done/);
    assert.match(source, /remove.*llm-\*/is);
    assert.match(source, /preserve.*sp-\*/is);
    assert.match(source, /REQUIRED_LINEAR_MUTATIONS/);
  }
});

test("linear refine forces grill continuation after each answer", async () => {
  const refineSkill = await readDoc("skills/linear-refine/SKILL.md");
  const questionerAgent = await readAgent("questioner");
  const questionerDoc = await readDoc("docs/questioner.md");

  for (const source of [refineSkill, questionerAgent, questionerDoc]) {
    assert.match(source, /Grill Continuation/i);
    assert.match(source, /after each human answer/i);
    assert.match(source, /ask if there is anything else to add/i);
    assert.match(source, /continue the current step/i);
    assert.match(source, /move to the next/i);
  }

  assert.match(questionerDoc, /do not mark.*ready.*until.*grill/i);
});

test("workflow skills define step completion handoff instead of stopping silently", async () => {
  const docs = [
    "skills/linear-create-issue/SKILL.md",
    "skills/linear-refine/SKILL.md",
    "skills/linear-implement/SKILL.md",
    "skills/linear-deliver-feature/SKILL.md",
    "skills/linear-status/SKILL.md",
    "skills/linear-doctor/SKILL.md"
  ];

  for (const docPath of docs) {
    const doc = await readDoc(docPath);
    assert.match(doc, /Step Completion Handoff/i, `${docPath} should define step handoff`);
    assert.match(doc, /what changed/i, `${docPath} should report what changed`);
    assert.match(doc, /ask if there is anything else to add/i, `${docPath} should ask for additions`);
    assert.match(doc, /recommended next step/i, `${docPath} should recommend next step`);
    assert.match(doc, /Current phase/i, `${docPath} should report current phase`);
    assert.match(doc, /Evidence/i, `${docPath} should report evidence`);
    assert.match(doc, /Open blocker/i, `${docPath} should report blockers`);
  }
});

test("linear status skill diagnoses current phase and next action from issue state", async () => {
  const skill = await readDoc("skills/linear-status/SKILL.md");

  for (const term of [
    "get_issue",
    "list_comments",
    "current phase",
    "missing evidence",
    "recommended next skill",
    "REQUIRED_LINEAR_MUTATIONS",
    "description dashboard, and comments disagree",
    "validate_marked_comments.ts"
  ]) {
    assert.match(skill, new RegExp(term, "i"), `linear-status should mention ${term}`);
  }
});

test("linear doctor checks Linear setup before workflow execution", async () => {
  const skill = await readDoc("skills/linear-doctor/SKILL.md");
  const setupDoc = await readDoc("docs/linear-setup.md");

  for (const term of [
    "list_teams",
    "list_projects",
    "list_issue_labels",
    "missing `llm-*`",
    "missing `sp-*`",
    "component labels",
    "REQUIRED_LINEAR_MUTATIONS"
  ]) {
    assert.match(skill, new RegExp(term.replaceAll("*", "\\*"), "i"), `linear-doctor should mention ${term}`);
  }
  assert.match(setupDoc, /sp-clarify/);
  assert.match(setupDoc, /sp-review/);
});

test("dashboard contract supports one updatable issue description progress block", async () => {
  const dashboardTemplate = await readDoc("templates/linear-dashboard-comment.md");
  const dashboardSchema = await readDoc("schemas/linear-ai.dashboard.v1.schema.yaml");
  const persistenceDoc = await readDoc("docs/superpowers-linear-persistence.md");
  const implementSkill = await readDoc("skills/linear-implement/SKILL.md");
  const deliverSkill = await readDoc("skills/linear-deliver-feature/SKILL.md");

  for (const source of [dashboardTemplate, dashboardSchema, persistenceDoc, implementSkill, deliverSkill]) {
    assert.match(source, /linear-ai\.dashboard\.v1/);
    assert.match(source, /issue description|description dashboard/i);
    assert.match(source, /task list/i);
    assert.match(source, /symbol/i);
  }
});

test("superpowers persistence is a hard gate for implementation progress", async () => {
  const requiredDocs = [
    "skills/linear-deliver-feature/SKILL.md",
    "skills/linear-refine/SKILL.md",
    "skills/linear-implement/SKILL.md"
  ];
  const gateDocs = [
    "agents/implementer.md",
    "docs/implementer.md",
    "skills/linear-implement/SKILL.md"
  ];

  for (const docPath of requiredDocs) {
    const doc = await readDoc(docPath);
    assert.match(doc, /docs\/superpowers-linear-persistence\.md/, `${docPath} must load the canonical persistence contract`);
  }

  for (const docPath of gateDocs) {
    const doc = await readDoc(docPath);
    assert.match(doc, /No implementation or code changes before/i, `${docPath} must contain the dashboard hard gate`);
    assert.match(doc, /Superpowers task list/i, `${docPath} must name the task-list mirror`);
    assert.match(doc, /REQUIRED_LINEAR_MUTATIONS/i, `${docPath} must preserve the write-unavailable fallback`);
  }
});

test("install docs cover portable skills and Claude Code", async () => {
  const installDoc = await readDoc("docs/install.md");
  const readme = await readDoc("README.md");

  assert.match(installDoc, /npx skills add/i);
  assert.match(installDoc, /--agent claude-code/);
  assert.match(installDoc, /\.claude-plugin\/plugin\.json/);
  assert.match(installDoc, /linear-deliver-feature/);
  assert.match(installDoc, /No-install repo-local usage/);
  assert.match(installDoc, /open Codex in this directory/i);
  assert.match(installDoc, /linear-status/);
  assert.match(readme, /Install/);
  assert.match(readme, /Claude Code/);
});

test("skills define Linear MCP tool contracts and fallback behavior", async () => {
  const expectations: Record<string, string[]> = {
    "linear-close": ["get_issue", "list_comments", "save_comment", "save_issue"],
    "linear-create-issue": ["list_teams", "list_projects", "list_issue_labels", "save_issue"],
    "linear-refine": ["get_issue", "list_comments", "save_comment", "save_issue"],
    "linear-implement": ["get_issue", "list_comments", "save_comment", "save_issue"],
    "linear-deliver-feature": ["linear-status", "linear-create-issue", "linear-refine", "linear-implement", "linear-close"],
    "linear-status": ["get_issue", "list_comments"],
    "linear-doctor": ["list_teams", "list_projects", "list_issue_labels"]
  };

  for (const [skillName, requiredTerms] of Object.entries(expectations)) {
    const skill = await readDoc(path.join("skills", skillName, "SKILL.md"));
    for (const term of requiredTerms) {
      assert.match(skill, new RegExp(term), `${skillName} should mention ${term}`);
    }
    assert.match(skill, /Linear MCP/i, `${skillName} should mention Linear MCP`);
    assert.match(skill, /REQUIRED_LINEAR_MUTATIONS/, `${skillName} should define write fallback`);
    assert.match(skill, /validate_marked_comments\.ts|intake_issue\.ts|linear_metadata\.ts/, `${skillName} should reference validation tooling`);
  }
});

test("metadata capture workflow is documented for live Linear MCP results", async () => {
  const createSkill = await readDoc("skills/linear-create-issue/SKILL.md");
  const toolsDoc = await readDoc("docs/tools.md");
  const packageJson = JSON.parse(await readDoc("package.json"));

  assert.match(createSkill, /linear_metadata\.ts capture/);
  assert.match(createSkill, /--teams/);
  assert.match(createSkill, /--projects/);
  assert.match(createSkill, /--labels/);
  assert.match(toolsDoc, /linear_metadata\.ts capture/);
  assert.match(toolsDoc, /list_teams/);
  assert.match(toolsDoc, /list_projects/);
  assert.match(toolsDoc, /list_issue_labels/);
  assert.match(packageJson.scripts["metadata:capture"], /linear_metadata\.ts capture/);
});

test("skills and install docs are JavaScript runner agnostic", async () => {
  const docs = [
    "docs/install.md",
    "docs/tools.md",
    "skills/linear-create-issue/SKILL.md",
    "skills/linear-refine/SKILL.md",
    "skills/linear-implement/SKILL.md",
    "skills/linear-deliver-feature/SKILL.md",
    "skills/linear-status/SKILL.md",
    "skills/linear-doctor/SKILL.md"
  ];

  for (const docPath of docs) {
    const doc = await readDoc(docPath);
    assert.match(doc, /detect_runner\.ts|package manager|npm|pnpm|bun/i, `${docPath} should mention runner portability`);
  }
});
