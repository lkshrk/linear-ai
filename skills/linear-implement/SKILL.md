---
name: linear-implement
description: "Execute a ready Linear implementation plan: make code changes, verify them, ask for the final code destination, and post marked implementation status comments. Use when a Linear issue already has a ready plan and needs implementation."
---

# Linear Implement

Use the repository root as the workflow source. Read and follow:

- `agents/implementer.md`
- `docs/implementer.md`
- `docs/agent-required-passes.md`
- `docs/superpowers-linear-persistence.md`
- `templates/linear-status-comment.md`
- `templates/linear-dashboard-comment.md`
- `schemas/linear-ai.status.v1.schema.yaml`
- `schemas/linear-ai.dashboard.v1.schema.yaml`

Start from the newest valid marked plan comment. Do not invent missing product behavior. If blocked, post batched questions in a marked status comment and apply or emit the correct Linear mutations.

## Auto Mode

Run implementation in auto mode once a valid ready plan exists. Continue through safe, reversible local inspect/edit/test/verify steps without asking for permission again. This includes reading repo context, creating the repo-local TDD plan, editing files named or implied by the ready plan, updating tests, running focused validation, updating the Linear dashboard/status evidence, and iterating on failed checks.

Ask or block only when the next step is destructive, irreversible, credential-gated, external-production affecting, materially scope-changing, missing required authority, or genuinely ambiguous in a way that would create nontrivial rework. Batch blocker questions in a marked status comment instead of interrupting for routine implementation choices.

## Required Permission Context

Before starting direct implementation, verify the required implementer permission context is active. The session must have workspace write access for the target repository, permission to run the repository package manager and verification commands, Linear MCP read/write tools for dashboard/status mutations, Git/GitHub tools when branch or PR work is in scope, and any project MCP tools required by the ready plan.

Do not begin routine implementation in a prompt-by-prompt permission mode. Establish or inherit the required implementer permission context first so approved safe, reversible work can proceed without repeated confirmations. If that context cannot be established, narrow the work to safe read-only inspection or post/emit a blocked status with the missing authority instead of repeatedly asking during routine steps.

No implementation or code changes before the Superpowers task list is mirrored into the Linear issue description dashboard or `REQUIRED_LINEAR_MUTATIONS` is emitted.

Maintain one dashboard block in the issue description with schema `linear-ai.dashboard.v1`. Mirror the Superpowers task list into that dashboard with CLI-style state symbols, stable ready-plan task IDs, and `last_checked` repair evidence after each top-level task state change. Inspect the actual code/worktree state before marking a task done. Use a dashboard comment only as fallback when description writes are unavailable.

## Parallel Execution

Use subagents heavily for independent implementation work. Split the ready plan into parallel lanes by repository, module, checklist item, test surface, review lane, or verification lane when those lanes do not require the same mutable files.

Work in an isolated issue worktree for the issue unless you can prove it is already inside the correct issue worktree. Treat the branch name or Git ref from the ready plan or Linear issue as Git plumbing attached to the issue worktree, not as the primary workspace.

Prefer git worktree isolation for parallel code-changing subagents. Each code-changing lane should have its own temporary lane worktree or Git ref, run its own focused verification, and report changed files, tests run, remaining risks, and dashboard task IDs. Do not place multiple code-changing subagents in the same working tree.

Before dispatching subagents, verify they have the right tools and permissions for the lane: repo read/write access, package manager, test commands, Linear MCP read/write tools if needed, Git/GitHub tools when PR work is in scope, and any required project MCP tools. If those tools and permissions are not available, either narrow the lane to read-only work or run it in the main session.

Merge back subagent work only after reviewing the diff, resolving conflicts, updating the dashboard task list, and rerunning relevant verification in the issue worktree.

Clean up temporary lane worktrees after merge-back and verification. Keep temporary lane worktrees distinct from the persistent issue worktree. If any temporary lane worktree is intentionally kept, report its path, branch, owner, and reason in the status comment.

## Commit and Destination Policy

Do not choose the final code destination. After implementation and verification are complete, but before pushing, merging, opening a PR, marking a PR ready, applying `llm-review`, or posting a review-ready handoff, ask the human which destination to use:

- merge to the default branch (`main` or `master`)
- create or update a feature branch without a PR
- create or update a feature branch with a PR

Record the answer in `final_destination` as `main`, `master`, `feature_branch`, or `feature_branch_pr`. If the answer is missing, ambiguous, or still `undecided`, stop with `llm-blocked` or emit `REQUIRED_LINEAR_MUTATIONS`; do not infer from the plan, branch name, existing issue worktree, or existing draft PR.

Leave a reasonable amount of commits: split by reviewable behavior or risk boundary, not by every tiny edit and not as one unrelated bulk commit.

Use semver syntax through Conventional Commit style and include the Linear issue ID in every commit subject, for example:

```text
feat(HCL-123): add dashboard persistence
fix(HCL-123): repair status extraction
test(HCL-123): cover dashboard validation
```

Report the final commit list and chosen destination in the status comment.

Before review-ready handoff, confirm the final destination was explicitly chosen, temporary lane worktrees were cleaned up, and the issue worktree cleanup state is explicitly listed as cleaned or intentionally kept.

## Linear MCP Contract

Use these Linear MCP tools when available:

- `get_issue` - read the current issue, labels, status, and branch metadata.
- `list_comments` - find the newest marked plan and status comments before acting.
- `save_comment` - post marked implementation status, questions, blockers, and review-ready evidence.
- `save_issue` - apply `llm-active`, `llm-blocked`, or `llm-review`, remove other `llm-*` labels, update issue description dashboard, and update status when writes are available.

Validate status comments and the issue description dashboard with:

```sh
scripts/validate_marked_comments.ts --description <issue-description-file> <status-comment-file>
```

Before applying `llm-review` or claiming review-ready, run the hard handoff gate:

```sh
scripts/verify_handoff.ts --issue-id <ISSUE-ID> --status <status-comment-file> --description <issue-description-file>
```

If a Linear metadata snapshot is available, validate labels with:

```sh
scripts/validate_marked_comments.ts --metadata <metadata.json> <status-comment-file>
```

Use the local JavaScript package manager or runtime available to the agent: Bun can run the `.ts` scripts directly; Node/npm/pnpm/yarn environments should run them through a TypeScript runner such as `tsx`.

If Linear MCP write tools are unavailable, do not claim labels, status, or comments were updated. Emit `REQUIRED_LINEAR_MUTATIONS` with the exact marked status comment and label/status changes.

## Step Completion Handoff

When implementation completes a task, blocker update, verification pass, or review-ready status, report what changed, verification evidence, current Linear labels/status, PR or patch links when present, and the recommended next step. Ask if there is anything else to add for blocker, abandoned, or review-ready handoffs, or when no safe unambiguous task remains. Do not ask whether to continue after routine completed tasks; continue to the next unchecked task, verification, or review handoff while work remains and the next step is safe and unambiguous.

After the add-more question is answered "no" at a blocker, abandoned, or review-ready handoff, ask whether the user wants to continue with the recommended next skill. Name the recommended next skill explicitly and wait for user confirmation; do not auto-run it.

Use this response shape:

- Current phase
- What changed
- Evidence
- Missing evidence
- Open blocker
- Recommended next step
- Recommended next skill
- Question: Is there anything else to add before moving on?
- Question: Do you want to continue with the recommended next skill?

Stop when implementation is verified, PR links are present when applicable, and the issue has a marked status comment with `implementation_status` set to `review_ready`, `blocked`, `active`, or `abandoned`.
