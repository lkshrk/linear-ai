# Agent Usage

Use these instructions to start the Markdown agents manually.

Prefer the plugin skill names when available:

- `linear-create-issue` for issue intake.
- `linear-refine` for questioner/planning.
- `linear-implement` for implementation.
- `linear-deliver-feature` for the combined create/refine/implement/review workflow.

## Shared Invocation Pattern

When starting any agent, provide:

- the relevant agent file from `agents/`
- the Linear issue URL or draft issue text
- current issue fields and labels
- relevant comments
- linked docs, PRs, screenshots, logs, or repo paths

Ask the agent to follow its source contract and return only the required artifact.

## Issue Intake

Use `agents/issue-intake.md`.

Use when:

- a rough bug or feature thought needs to become a Linear issue
- an existing templated issue has missing or vague fields
- issue type is unclear

Expected output:

- Linear-ready bug or feature issue body
- target Linear team: `Civora`
- recommended product label
- Linear priority property only if explicitly selected
- whether to add `llm-refine`
- unknown fields that remain unknown
- applied Linear changes, or `REQUIRED_LINEAR_MUTATIONS` if writes are unavailable

Do not use issue-intake to create implementation plans.

## Questioner

Use `agents/questioner.md`.

Use when:

- an issue has `llm-refine`
- implementer questions need refinement
- a feature needs acceptance criteria
- a bug fix has product or repo ambiguity
- issue splitting may be needed

Expected output:

- marked plan comment
- `plan_status`
- implementation checklist
- acceptance criteria
- verification expectations
- open questions or accepted unknowns
- evidence that the mandatory grill pass ran
- applied Linear changes, or `REQUIRED_LINEAR_MUTATIONS` if writes are unavailable

Do not use questioner to edit code.

## Implementer

Use `agents/implementer.md`.

Use when:

- an issue has `llm-ready`
- a valid marked plan has `plan_status: ready`
- there is a target Coder workspace or repo workspace

Expected output:

- code changes in the target repo or repos
- draft PR link or update
- marked status comment
- completed checklist items
- batched questions if blocked
- verification evidence
- applied Linear changes, or `REQUIRED_LINEAR_MUTATIONS` if writes are unavailable

Do not use implementer without a ready plan.

## Orchestrator

Use `agents/orchestrator.md` manually when you need to decide workflow state.

Use when:

- labels and comments disagree
- a blocked issue may be ready to resume
- split recommendation needs routing
- a marked comment needs validation
- a PR may be ready for review

Expected output:

- recommended label changes
- recommended status change
- which agent to run next
- validation failures if present
- applied Linear changes, or `REQUIRED_LINEAR_MUTATIONS` if writes are unavailable

Do not use orchestrator to decide product behavior.

## Minimal Prompts

### Intake

```text
Use agents/issue-intake.md. Here is the current issue/draft:

<paste issue fields>
```

### Questioner

```text
Use agents/questioner.md. Refine this Linear issue until it can receive a ready plan comment. Ask one question at a time.

<paste issue and context>
```

### Implementer

```text
Use agents/implementer.md. Implement the newest valid ready plan. Do not guess; batch questions if blocked.

<paste Linear issue URL and marked plan comment>
```

### Orchestrator

```text
Use agents/orchestrator.md. Validate this issue state and tell me the next workflow action.

<paste labels, status, latest marked comments, PR links>
```
