---
name: linear-batch-implement
description: "Batch-orchestrate ready Linear implementation work: find llm-ready issues with newest valid ready plans, confirm the queue and parallelism, and dispatch isolated linear-implement subagents."
---

# Linear Batch Implement

Use this skill when an operator wants to implement multiple Linear AI issues that are ready for implementation.

This is an orchestrator. Do not duplicate the `linear-implement` workflow. The single-issue skills own durable per-issue Linear comments, workflow labels, dashboard updates, PR handoff, and issue-specific interpretation.

## Source Contract

Read and follow:

- `skills/linear-implement/SKILL.md`
- `docs/workflow.md`
- `docs/implementer.md`
- `docs/agent-required-passes.md`
- `docs/superpowers-linear-persistence.md`
- `scripts/validate_marked_comments.ts`

## Queue Discovery

Use Linear MCP:

- `list_issues` to find issues with `llm-ready`.
- Optional filters: team, project, assignee, label, and explicit issue IDs when supplied by the user.
- `get_issue` and `list_comments` to verify each candidate has a newest valid ready plan with `plan_status: ready`.

Exclude issues already carrying the `in-use` claim label; another agent is working them.

Support explicit dry-run or list-only mode. In dry-run/list-only mode, show the queue and stop without dispatching subagents or mutating Linear.

Sort the queue by Linear priority first, then oldest-updated issue first. Priority order is Urgent, High, Medium, Low, then No priority/none; within the same priority, sort by `updatedAt` ascending. Show a scoped queue summary with issue ID, title, status, project, issue worktree or Git ref, ready plan revision, updated time, and why the issue is eligible.

Ask for confirmation before dispatch. Ask for one global maximum parallelism value after queue discovery and before dispatch. Cap parallelism at 6. Do not choose unbounded or default implementation parallelism.

When switching focus to a different issue, give a short content summary first per the Ticket Reference Rule in `docs/workflow.md`: name the issue ID, exact issue title, and a one-line description of what it is about.

## Dispatch Rules

Immediately before dispatching each issue, re-read issue state with `get_issue` and `list_comments`. Skip the issue if it no longer has `llm-ready`, no longer has a newest valid ready plan, or now carries the `in-use` claim label (claimed by another agent), and record observed Linear state drift in the summary.

Require per-issue isolation. Each `linear-implement` subagent must work in its isolated issue worktree using the issue Git ref or PR as plumbing, and must not share a mutable worktree with another code-changing issue.

Before dispatching each `linear-implement` subagent, pass or confirm the same required implementer permission context used by direct runs: workspace write access for that issue worktree, package manager and verification command permission, Linear MCP read/write tools for dashboard/status mutations, Git/GitHub tools when branch or PR work is in scope, and required project MCP tools. Do not dispatch a prompt-by-prompt implementer for routine safe work; skip or block that issue with missing authority if the context cannot be provided.

This permission context is not blanket approval. Subagents still ask or block for destructive, irreversible, credential-gated, external-production affecting, materially scope-changing, or missing required authority actions.

Dispatch a per-issue subagent with:

```text
$linear-ai:linear-implement <ISSUE-ID>
```

Retry one tool/runtime failure once for the affected issue. If the retry fails, mark only that issue as `failed` in the batch summary.

Handle cancellation by stopping new dispatches, waiting for already-started safe work to report, and returning a cancellation summary with completed, blocked, failed, skipped, cancelled, and not-started issues.

## Structured Subagent Result

Require every subagent to report a structured subagent result:

```yaml
issue: HCL-123
status: completed # completed | blocked | failed | skipped | cancelled
questions:
  - question: Concrete question for the user.
    recommended_answer: Recommended answer with rationale.
    reason: Why this answer is needed.
    blocks:
      - I4
feedback:
  - summary: Short feedback from the subagent.
    severity: info # info | warning | blocker
    recommendation: Recommended follow-up.
    follow_up: Optional next step.
linear_mutations:
  - REQUIRED_LINEAR_MUTATIONS emitted by the single-issue skill, if any.
evidence:
  - PR, commit, dashboard, status comment, or verification evidence.
error: null
```

Contract violations fail only the affected issue.

## Question And Feedback Aggregation

Questions include `question`, `recommended_answer`, `reason`, and optional `blocks`.

Feedback includes `summary`, `severity`, `recommendation`, and optional `follow_up`.

After each wave, group open questions and feedback by issue. Ask the user for required input before continuing blocked or ambiguous work. Route answered issues into fresh `linear-implement` subagent runs; do not resume stale subagent state.

Unanswered issues remain blocked or skipped in the next summary.

## Summary Format

Return a final summary with:

- discovered issues
- dispatched issues
- completed issues
- blocked/questions
- failed issues
- skipped issues
- cancelled or not-started issues
- user answers applied
- normalized evidence
- observed Linear state drift
- REQUIRED_LINEAR_MUTATIONS from subagents
- next recommended action

## Linear MCP Contract

Use these Linear MCP tools when available:

- `list_issues`
- `get_issue`
- `list_comments`

The batch orchestrator should not perform per-issue lifecycle mutations that belong to `linear-implement`. If Linear MCP write tools are unavailable or a subagent emits write instructions, surface the exact `REQUIRED_LINEAR_MUTATIONS` in the batch summary.

## Stop Conditions

Stop when all confirmed waves are complete, user input is required, cancellation is requested, or no eligible issues remain.
