---
name: linear-batch-close
description: "Batch-orchestrate Linear closeout: find llm-review issues, confirm the queue and bounded parallelism, and dispatch linear-close subagents while closeout mutations stay with linear-close."
---

# Linear Batch Close

Use this skill when an operator wants to close multiple Linear AI issues that are ready for post-merge closeout.

This is an orchestrator. Do not duplicate the `linear-close` workflow. The single-issue skills own durable per-issue Linear comments, workflow labels, closeout mutations, merge evidence, CI evidence, and issue-specific interpretation.

## Source Contract

Read and follow:

- `skills/linear-close/SKILL.md`
- `docs/workflow.md`
- `docs/agent-required-passes.md`
- `docs/comment-validation.md`
- `scripts/validate_marked_comments.ts`
- `scripts/verify_closeout.ts`

## Queue Discovery

Use Linear MCP:

- `list_issues` to find issues with `llm-review`.
- Optional filters: team, project, assignee, label, and explicit issue IDs when supplied by the user.
- `get_issue` and `list_comments` to summarize current review/PR evidence before dispatch.

Exclude issues already carrying the `in-use` claim label; another agent is working them.

Support explicit dry-run or list-only mode. In dry-run/list-only mode, show the queue and stop without dispatching subagents or mutating Linear.

Sort the queue by Linear priority first, then oldest-updated issue first. Priority order is Urgent, High, Medium, Low, then No priority/none; within the same priority, sort by `updatedAt` ascending. Show a scoped queue summary with issue ID, title, status, project, latest review-ready evidence, updated time, and why the issue is eligible.

Ask for confirmation before dispatch. Ask for bounded parallelism after queue discovery and before dispatch. Cap parallelism at 6.

When switching focus to a different issue, give a short content summary first per the Ticket Reference Rule in `docs/workflow.md`: name the issue ID, exact issue title, and a one-line description of what it is about.

## Dispatch Rules

Immediately before dispatching each issue, re-read issue state with `get_issue` and `list_comments`. Skip the issue if it no longer has `llm-review`, or now carries the `in-use` claim label (claimed by another agent), and record observed Linear state drift in the summary.

Dispatch a per-issue subagent with:

```text
$linear-ai:linear-close <ISSUE-ID>
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
      - closeout
feedback:
  - summary: Short feedback from the subagent.
    severity: info # info | warning | blocker
    recommendation: Recommended follow-up.
    follow_up: Optional next step.
linear_mutations:
  - REQUIRED_LINEAR_MUTATIONS emitted by the single-issue skill, if any.
evidence:
  - Merge, CI, mainline, dashboard, status, or Linear state evidence.
error: null
```

Contract violations fail only the affected issue.

## Question And Feedback Aggregation

Questions include `question`, `recommended_answer`, `reason`, and optional `blocks`.

Feedback includes `summary`, `severity`, `recommendation`, and optional `follow_up`.

After each wave, group open questions and feedback by issue. Ask the user for required input before continuing blocked or ambiguous work. Route answered issues into fresh `linear-close` subagent runs; do not resume stale subagent state.

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

The batch orchestrator should not perform closeout mutations that belong to `linear-close`. If Linear MCP write tools are unavailable or a subagent emits write instructions, surface the exact `REQUIRED_LINEAR_MUTATIONS` in the batch summary.

## Stop Conditions

Stop when all confirmed waves are complete, user input is required, cancellation is requested, or no eligible issues remain.
