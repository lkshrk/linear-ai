# Linear Non-Technical Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `linear-nontech-intake` skill that interviews non-technical users directly, creates a Linear issue, and marks it for technical refinement.

**Architecture:** This repo ships portable Linear workflow skills as `skills/<name>/SKILL.md` plus `agents/openai.yaml` metadata, with plugin manifests and Bun contract tests guarding the public surface. The new skill is a standalone intake skill that reuses the existing Linear MCP pattern from `linear-create-issue`; `linear-refine` gets a small handoff rule so downstream refinement understands the `nontechnical-intake` marker label.

**Tech Stack:** Markdown skills, YAML skill metadata, Linear MCP, Bun tests, existing skill smoke and sync checks.

---

## Global Constraints

- Source spec: `docs/superpowers/specs/2026-06-30-linear-nontech-intake-design.md`.
- Do not add runtime scripts for this version; the behavior is procedural and fits in `SKILL.md`.
- Do not create a new `llm-*` workflow state. Use existing `llm-refine`.
- Use `nontechnical-intake` as a marker label, not a workflow state.
- Keep non-technical interview wording plain and direct.
- Do not make `linear-create-issue` responsible for this flow.

---

## File Structure

- `skills/linear-nontech-intake/SKILL.md` — new skill entrypoint and workflow instructions.
- `skills/linear-nontech-intake/agents/openai.yaml` — UI metadata for the new skill.
- `skills/linear-refine/SKILL.md` — add downstream behavior for issues carrying `nontechnical-intake`.
- `.claude-plugin/plugin.json` — add `./skills/linear-nontech-intake`.
- `.codex-plugin/plugin.json` — add a default prompt for non-technical intake.
- `README.md` — add the skill to the public skill list.
- `test/agent_contract.test.ts` — add contract tests for the new skill, the plugin list, and refine handoff behavior.

---

### Task 1: Contract Tests For Non-Technical Intake

**Files:**
- Modify: `test/agent_contract.test.ts`

- [ ] **Step 1: Write the failing contract tests**

In `test/agent_contract.test.ts`, update the expected skill list in `plugin exposes intuitive Linear workflow skills` by adding `"linear-nontech-intake"` between `"linear-implement"` and `"linear-refine"`:

```ts
  assert.deepEqual(skillNames, [
    "linear-batch-close",
    "linear-batch-implement",
    "linear-batch-refine",
    "linear-close",
    "linear-create-issue",
    "linear-deliver-feature",
    "linear-doctor",
    "linear-implement",
    "linear-nontech-intake",
    "linear-refine",
    "linear-repo-reconcile",
    "linear-review",
    "linear-status"
  ]);
```

Add this test after `plugin exposes intuitive Linear workflow skills`:

```ts
test("linear nontechnical intake creates marked refine issues", async () => {
  const skill = await readDoc("skills/linear-nontech-intake/SKILL.md");
  const metadata = await readDoc("skills/linear-nontech-intake/agents/openai.yaml");

  assert.match(skill, /name: linear-nontech-intake/);
  assert.match(skill, /non-technical people/i);
  assert.match(skill, /one plain-language question at a time/i);
  assert.match(skill, /screenshots, screen recordings, error messages, links/i);
  assert.match(skill, /list_teams[\s\S]*list_projects[\s\S]*list_issue_labels[\s\S]*save_issue/i);
  assert.match(skill, /llm-refine/);
  assert.match(skill, /nontechnical-intake/);
  assert.match(skill, /Technical triage gaps/);
  assert.match(skill, /affected system or code area/i);
  assert.match(skill, /root cause/i);
  assert.match(skill, /implementation approach/i);
  assert.match(skill, /test strategy/i);
  assert.match(skill, /REQUIRED_LINEAR_MUTATIONS/);

  assert.match(metadata, /display_name:/);
  assert.match(metadata, /short_description:/);
  assert.match(metadata, /default_prompt:/);
  assert.match(metadata, /non-technical/i);
});
```

Add this test near the existing `linear refine` tests:

```ts
test("linear refine translates nontechnical intake before planning", async () => {
  const skill = await readDoc("skills/linear-refine/SKILL.md");

  assert.match(skill, /nontechnical-intake/);
  assert.match(skill, /preserve the original plain-language report/i);
  assert.match(skill, /Technical triage gaps/);
  assert.match(skill, /affected systems/i);
  assert.match(skill, /testable acceptance criteria/i);
  assert.match(skill, /remove `nontechnical-intake`/i);
});
```

- [ ] **Step 2: Run tests to verify the failure**

Run:

```sh
bun test test/agent_contract.test.ts
```

Expected: fail because `skills/linear-nontech-intake/SKILL.md` does not exist and the expected skill list includes a missing skill.

- [ ] **Step 3: Commit the red tests**

Run:

```sh
git add test/agent_contract.test.ts
git commit -m "test: cover nontechnical intake skill"
```

Expected: commit succeeds only if the repo permits committing red tests. If the pre-commit hook blocks red tests, leave this task uncommitted and continue to Task 2; commit Task 1 and Task 2 together after the tests pass.

---

### Task 2: Add `linear-nontech-intake`

**Files:**
- Create: `skills/linear-nontech-intake/SKILL.md`
- Create: `skills/linear-nontech-intake/agents/openai.yaml`

- [ ] **Step 1: Create the skill directory**

Run:

```sh
mkdir -p skills/linear-nontech-intake/agents
```

Expected: directory exists.

- [ ] **Step 2: Add `SKILL.md`**

Create `skills/linear-nontech-intake/SKILL.md`:

```markdown
---
name: linear-nontech-intake
description: "Interview non-technical people directly and create Linear issues from plain-language reports, requests, confusion, screenshots, screen recordings, error messages, links, examples, or desired outcomes. Use when a non-technical user needs help filing a Linear issue that should enter `llm-refine` with a `nontechnical-intake` marker because technical triage is still required."
---

# Linear Non-Technical Intake

Interview the user directly. Use plain language, ask one question at a time, and create a Linear issue after collecting enough facts.

This skill creates a useful raw issue. It does not create an implementation-ready issue, diagnose root cause, choose affected code, or produce a technical plan.

## Interview Rules

- Ask one plain-language question at a time.
- Avoid technical vocabulary unless the user volunteers it.
- Accept "I don't know" and continue when enough information exists.
- Do not ask the user to identify code, systems, root cause, implementation approach, or test strategy.
- Prefer a short issue over blocking on technical detail.
- Capture the user's words faithfully.

## Interview Flow

Ask enough questions to fill the issue body:

1. What happened, or what do you want to change?
2. What did you expect instead?
3. Who or what is affected?
4. How often does it happen, or how important is it?
5. What steps, context, or examples help show the situation?
6. Do you have screenshots, screen recordings, error messages, links, affected records, customer examples, Slack/email context, or comparable examples?
7. Is there a workaround?
8. What would success look like in plain language?

For UI bugs, visual confusion, or error reports, strongly encourage screenshots or screen recordings. For feature requests, ask for examples, references, or comparable behavior.

## Linear MCP Contract

Use these Linear MCP tools when available:

- `list_teams` - read available Linear teams before choosing target team.
- `list_projects` - read available Linear projects before choosing target project.
- `list_issue_labels` - read available Linear labels before proposing labels.
- `save_issue` - create the Linear issue and apply labels when writes are available.

Live intake sequence:

1. Run `list_teams`, `list_projects`, and `list_issue_labels`.
2. Choose the target team and project from metadata when obvious.
3. If routing is not obvious, ask a plain-language routing question such as "Which product or team should see this?"
4. Apply `llm-refine`.
5. Apply `nontechnical-intake`.
6. Apply an obvious type label such as `bug` or `feature` when Linear metadata supports it.
7. Leave type classification unresolved when unclear.
8. Call `save_issue` with the final issue body and labels.

If `nontechnical-intake` does not exist and a Linear label-creation tool is available, create the label before saving the issue. If label creation is unavailable, save the issue with `llm-refine` and include a note in the issue body that the `nontechnical-intake` marker label could not be applied.

If Linear MCP write tools are unavailable, do not claim the issue was created. Emit `REQUIRED_LINEAR_MUTATIONS` with the exact target team, project, labels, and issue body the human should apply.

## Issue Body

Create the issue body with these sections:

```markdown
## Summary

Write a one-sentence plain-language summary from the interview.

## What happened

Record the user's report in their words.

## Expected outcome

Record what the user expected or wants instead.

## Who/what is affected

Record affected people, customers, records, environments, workflows, or "Unknown."

## Impact / urgency

Record frequency, severity, business impact, deadline, or "Unknown."

## Steps or context

Record steps, context, examples, or "Not provided."

## Evidence / links

Record screenshots, screen recordings, error messages, URLs, affected records/items, customer/user examples, Slack/email context, comparable examples, or "Not provided."

## Known workaround

Record the workaround, or "None known."

## Desired success

Record the plain-language definition of success.

## Non-technical intake notes

This issue was created from a non-technical interview. Preserve the user-language facts during refinement.

## Technical triage gaps

- Affected system or code area: unknown
- Root cause: unknown
- Implementation approach: unknown
- Technical acceptance criteria: needs conversion from desired success
- Test strategy: unknown
```

Do not omit `Technical triage gaps`. It is the handoff surface for `linear-refine`.

## Step Completion Handoff

When the issue is created, report:

- Created issue URL or identifier
- Applied labels
- Missing marker label, if `nontechnical-intake` could not be applied
- Evidence captured
- Technical triage gaps
- Recommended next skill: `linear-refine`

If the issue could not be created, report:

- Why creation failed
- `REQUIRED_LINEAR_MUTATIONS`
- Recommended next step
```

- [ ] **Step 3: Add OpenAI skill metadata**

Create `skills/linear-nontech-intake/agents/openai.yaml`:

```yaml
display_name: "Linear Non-Tech Intake"
short_description: "Interview a non-technical user and create a Linear issue marked for refinement."
default_prompt: "Help a non-technical person file a Linear issue from their plain-language report."
```

- [ ] **Step 4: Run the targeted test**

Run:

```sh
bun test test/agent_contract.test.ts
```

Expected: the new intake test passes. The plugin skill list test still fails until `.claude-plugin/plugin.json` is updated in Task 3.

---

### Task 3: Register The Skill In Plugin And Docs

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `.codex-plugin/plugin.json`
- Modify: `README.md`

- [ ] **Step 1: Update Claude plugin manifest**

In `.claude-plugin/plugin.json`, add `./skills/linear-nontech-intake` after `./skills/linear-create-issue`:

```json
    "./skills/linear-create-issue",
    "./skills/linear-nontech-intake",
    "./skills/linear-refine",
```

- [ ] **Step 2: Update Codex plugin default prompts**

In `.codex-plugin/plugin.json`, add this prompt after `"Create a Linear issue from this rough report"`:

```json
      "Help a non-technical person file a Linear issue",
```

- [ ] **Step 3: Update README skill list**

In `README.md`, add this bullet in the `## Skills` list near `linear-create-issue`:

```markdown
- `linear-nontech-intake` - interview a non-technical user and create a Linear issue marked for technical refinement.
```

- [ ] **Step 4: Run plugin and smoke checks**

Run:

```sh
bun test test/agent_contract.test.ts
bun run skills:smoke
bun run skills:sync:check
```

Expected:

- `bun test test/agent_contract.test.ts`: all tests pass except the `linear refine translates nontechnical intake before planning` test, which still fails until Task 4.
- `bun run skills:smoke`: ok.
- `bun run skills:sync:check`: ok.

---

### Task 4: Teach `linear-refine` The Marker Label

**Files:**
- Modify: `skills/linear-refine/SKILL.md`

- [ ] **Step 1: Add the non-technical intake handoff section**

In `skills/linear-refine/SKILL.md`, add this section after `## Questionnaire Start`:

```markdown
## Non-Technical Intake Handoff

If the issue carries `nontechnical-intake`, treat it as a plain-language intake that requires technical translation before planning.

Before writing a ready plan:

- Preserve the original plain-language report.
- Read the `Technical triage gaps` section.
- Identify affected systems from the issue, comments, linked docs, Linear context, and repository evidence.
- Convert desired success into testable acceptance criteria.
- Replace or complete `Technical triage gaps` with technical findings.
- Keep unknowns explicit when they cannot be resolved from available evidence.
- Do not mark `plan_status: ready` until the remaining unknowns are either resolved or explicitly accepted.

When technical triage is complete, remove `nontechnical-intake` with `save_issue` while applying the normal refinement label transition. If Linear writes are unavailable, include removal of `nontechnical-intake` in `REQUIRED_LINEAR_MUTATIONS`.
```

- [ ] **Step 2: Run the targeted tests**

Run:

```sh
bun test test/agent_contract.test.ts
```

Expected: all `test/agent_contract.test.ts` tests pass.

- [ ] **Step 3: Commit the implementation**

Run:

```sh
git add skills/linear-nontech-intake/SKILL.md skills/linear-nontech-intake/agents/openai.yaml skills/linear-refine/SKILL.md .claude-plugin/plugin.json .codex-plugin/plugin.json README.md test/agent_contract.test.ts
git commit -m "feat: add nontechnical Linear intake skill"
```

Expected: pre-commit runs and passes.

---

### Task 5: Full Verification

**Files:**
- No file edits.

- [ ] **Step 1: Run the full test suite**

Run:

```sh
bun test
```

Expected:

```text
95 pass
0 fail
```

The exact pass count can be higher if new tests are added during implementation. It must not be lower than 95 and must show `0 fail`.

- [ ] **Step 2: Run skill smoke and sync checks**

Run:

```sh
bun run skills:smoke
bun run skills:sync:check
```

Expected:

```text
ok skills smoke (npx skills add/use, codex, claude-code)
ok skill reference bundles in sync
```

- [ ] **Step 3: Run marketplace smoke**

Run:

```sh
bun run marketplace:generate
bun run marketplace:smoke
```

Expected:

```text
ok marketplace specs lkshrk/linear-ai@v1.4.0 -> dist/marketplace
ok marketplace smoke (codex plugin, claude plugin)
```

- [ ] **Step 4: Inspect final diff and status**

Run:

```sh
git status --short
git diff --stat HEAD
```

Expected: only intentional files remain changed if pre-commit modified generated output. If generated marketplace files are changed under `dist/`, inspect them and decide whether this repo tracks them before staging.

- [ ] **Step 5: Final commit if verification changed generated files**

If Task 5 Step 4 shows generated tracked files that belong with the feature, run:

```sh
git add <generated-files>
git commit -m "chore: refresh marketplace specs"
```

Expected: commit succeeds. If there are no generated tracked changes, skip this step.

---

## Self-Review Notes

- Spec coverage: the plan covers direct non-technical interview, issue creation, `llm-refine`, `nontechnical-intake`, screenshots/evidence prompts, explicit technical triage gaps, Linear metadata routing, label fallback, and `linear-refine` downstream behavior.
- Scope check: the plan creates one skill and a small downstream marker-label rule. It does not add a UI form, scripts, root-cause diagnosis, or implementation planning behavior.
- Type and name consistency: the skill name is `linear-nontech-intake`; the marker label is `nontechnical-intake`; the downstream skill is `linear-refine`.
