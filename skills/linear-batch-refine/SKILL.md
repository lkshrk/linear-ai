---
name: linear-batch-refine
description: "Batch-orchestrate Linear refinement: find llm-refine and llm-blocked issues, show the queue, process one issue at a time with linear-refine subagents, and aggregate questions and feedback."
---

# Linear Batch Refine

Use this skill when an operator wants to process multiple Linear AI issues that need refinement or blocker follow-up.

This is an orchestrator. Do not duplicate the `linear-refine` workflow. The single-issue skills own durable per-issue Linear comments, workflow labels, plan validation, and issue-specific interpretation.

## Source Contract

Read and follow:

- `skills/linear-refine/SKILL.md`
- `docs/workflow.md`
- `docs/agent-required-passes.md`
- `docs/superpowers-linear-persistence.md`
- `scripts/validate_marked_comments.ts`

## Queue Discovery

Use Linear MCP:

- `list_issues` to find issues with `llm-refine` and `llm-blocked`.
- Optional filters: team, project, assignee, label, and explicit issue IDs when supplied by the user.
- If no explicit issue IDs are supplied and the target team and project are not already clear from the session, ask which team and project to handle issues for before discovery.
- Only issues carrying an `llm-*` workflow label enter the queue. Ignore issues without an `llm-*` label unless the user explicitly names them.
- `get_issue` and `list_comments` to summarize each candidate before dispatch.

Exclude issues already carrying the `in-use` claim label; another agent is working them.

Support explicit dry-run or list-only mode. In dry-run/list-only mode, show the queue and stop without dispatching subagents or mutating Linear.

Sort the queue by Linear priority first, then oldest-updated issue first. Priority order is Urgent, High, Medium, Low, then No priority/none; within the same priority, sort by `updatedAt` ascending. Show a scoped queue summary with issue ID, title, state label, status, project, updated time, and why the issue is eligible.

Ask for confirmation before dispatch. Process refinement one issue at a time. Refinement keeps the single `linear-refine` interview contract: while an issue is being refined, the orchestrator relays the subagent's question rounds to the operator as they arise (grouped ≤4 per round, each question carrying the subagent's recommended answer and evidence), returns the operator's answers to the still-running subagent, and lets it iterate until every material branch is resolved or explicitly accepted. Only then may the plan be marked ready. Advance to the next queue issue only when the current issue is ready, blocked, or the operator explicitly defers its open questions. End-of-pass aggregation applies only to operator-deferred questions.

When switching focus to a different issue, give a short content summary first per the Ticket Reference Rule in `docs/workflow.md`: name the issue ID and a one-line description of what it is about.

## Dispatch Rules

Immediately before dispatching each issue, re-read issue state with `get_issue` and `list_comments`. Skip the issue if the current labels no longer include `llm-refine` or `llm-blocked`, or if the issue now carries the `in-use` claim label (claimed by another agent), and record observed Linear state drift in the summary.

Dispatch a per-issue subagent with:

```text
$linear-ai:linear-refine <ISSUE-ID>
```

Dispatch prompts must not instruct subagents to skip the questionnaire or resolve design branches autonomously. They must instead define the relay channel: the subagent sends question rounds to the orchestrator mid-run and waits for relayed operator answers before finalizing the plan. While waiting, the subagent keeps its `in-use` claim.

Retry one tool/runtime failure once for the affected issue. If the retry fails, mark only that issue as `failed` in the batch summary.

Handle cancellation by stopping new dispatches, waiting for already-started safe work to report, and returning a cancellation summary with completed, blocked, failed, skipped, cancelled, and not-started issues.

## Structured Subagent Result

While refining, a subagent sends intermediate question rounds to the orchestrator before its final result:

```yaml
type: question_round
issue: TEAM-123
round: 1
questions:
  - question: Concrete question for the operator.
    recommended_answer: Evidence-based recommendation.
    reason: Why this branch is material.
    blocks: [I2]
```

The orchestrator relays each round to the operator and returns the answers to the still-running subagent. The final structured result is sent only after all rounds are answered or explicitly deferred by the operator.

Require every subagent to report a structured subagent result:

```yaml
issue: HCL-123
status: completed # completed | blocked | failed | skipped | cancelled
questions:
  - question: Concrete question for the user.
    recommended_answer: Recommended answer with rationale.
    reason: Why this answer is needed.
    blocks:
      - I2
feedback:
  - summary: Short feedback from the subagent.
    severity: info # info | warning | blocker
    recommendation: Recommended follow-up.
    follow_up: Optional next step.
linear_mutations:
  - REQUIRED_LINEAR_MUTATIONS emitted by the single-issue skill, if any.
evidence:
  - Validation, comment, or Linear state evidence.
error: null
```

Contract violations fail only the affected issue.

## Deferred Question And Feedback Aggregation

Aggregation is the fallback for operator-deferred questions, not the primary flow. The primary flow is the live relay above: question rounds reach the operator while the subagent is still running.

Questions include `question`, `recommended_answer`, `reason`, and optional `blocks`.

Feedback includes `summary`, `severity`, `recommendation`, and optional `follow_up`.

After the full queue pass, group operator-deferred questions and feedback by issue. Ask the user for required input before continuing blocked or ambiguous work. Route answered issues into fresh `linear-refine` subagent runs; do not resume stale subagent state.

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

The batch orchestrator should not perform per-issue lifecycle mutations that belong to `linear-refine`. If Linear MCP write tools are unavailable or a subagent emits write instructions, surface the exact `REQUIRED_LINEAR_MUTATIONS` in the batch summary.

## Stop Conditions

Stop when the queue pass is complete, user input is required, cancellation is requested, or no eligible issues remain.
