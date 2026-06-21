# Agent Usage

Use these instructions to start the Markdown agents manually.

Prefer the plugin skill names when available:

- `linear-create-issue` for issue intake.
- `linear-refine` for questioner/planning.
- `linear-implement` for implementation.
- `linear-close` for post-merge closeout.
- `linear-batch-refine` for refinement and blocker queues.
- `linear-batch-implement` for ready-plan implementation queues.
- `linear-batch-close` for post-review closeout queues.
- `linear-deliver-feature` for the combined create/refine/implement/review/closeout workflow.
- `linear-review` for parallel code review that turns findings into tickets.

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
- there is a target issue worktree or isolated repo worktree

Expected output:

- code changes in the target repo or repos
- explicit final destination answer: default branch (`main`/`master`), feature branch without PR, or feature branch with PR
- branch or PR evidence matching the chosen destination
- marked status comment
- completed checklist items
- batched questions if blocked
- verification evidence
- applied Linear changes, or `REQUIRED_LINEAR_MUTATIONS` if writes are unavailable

Do not use implementer without a ready plan.

## Closer

Use `agents/closer.md`.

Use when:

- an issue has `llm-review`
- the implementation PR has been merged, direct issue-ID commit evidence is present, or squash/import release evidence proves current main contains the expected file/content evidence
- Linear still needs final Done/status/comment/label cleanup

Expected output:

- merge, commit, or release file/content evidence
- CI evidence
- mainline containment evidence
- final marked closeout/status comment
- issue moved to `Done`
- all `llm-*` labels removed
- cumulative `sp-*` labels preserved
- applied Linear changes, or `REQUIRED_LINEAR_MUTATIONS` if writes are unavailable

Do not use closer to merge PRs or implement code.

## Batch Orchestrators

Use the batch skills when multiple issues are already in known workflow states and the operator wants queue-level orchestration.

- `linear-batch-refine` discovers `llm-refine` and `llm-blocked`, confirms the queue, processes one issue at a time through `linear-refine`, then groups questions and feedback by issue.
- `linear-batch-implement` discovers `llm-ready` issues with newest valid ready plans, confirms the queue, asks for maximum parallelism capped at 6, and dispatches isolated `linear-implement` subagents with the same required implementer permission context used by direct runs.
- `linear-batch-close` discovers `llm-review` issues, confirms the queue, asks for bounded parallelism capped at 6, and dispatches `linear-close` subagents.

Batch orchestrators do not own per-issue lifecycle mutations. Single-issue skills own marked comments, dashboards, labels, PR handoff, and closeout evidence.

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

## Reviewer

Use `agents/reviewer.md`.

Use when:

- a repo or branch/PR needs a code-quality review
- the user wants findings turned into Linear tickets
- a periodic repo-health audit is wanted

Expected output:

- deduped findings grouped by severity
- created Linear issues at `llm-refine` carrying the review-finding footer
- ledger updates for ignored/ticketed findings
- dedup counts
- applied Linear changes, or `REQUIRED_LINEAR_MUTATIONS` if Linear writes are unavailable

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

### Batch Implementation

```text
Use linear-batch-implement for project Linear-AI. Show the eligible queue, ask for confirmation and maximum parallelism, then dispatch per-issue linear-implement subagents with the same required implementer permission context used by direct runs.
```
