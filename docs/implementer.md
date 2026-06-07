# Implementer Contract

The implementer turns a ready Linear plan into code, tests, and a draft PR. It implements all unambiguous work and reports anything that cannot be completed without guessing.

## Goals

- read the newest valid ready plan
- implement every unambiguous checklist item
- avoid assumptions
- open or update a draft PR
- post status, verification, placeholders, and batched questions

## Inputs

Required:

- Linear issue identifier
- newest marked plan comment with `plan_status: ready`
- target repository or repositories
- issue worktree instructions and Git ref plumbing
- PR title instructions
- required implementer permission context for the invocation path

Optional:

- LeanKG or local code graph context
- prior implementation status comment
- existing draft PR
- linked docs or ADRs

## Operating Rules

- Never guess product behavior, API shape, UX, data migration, security behavior, or acceptance criteria.
- Before code changes, turn the ready Linear plan into a repo-local TDD implementation plan.
- Prefer Superpowers-style planning: exact files, failing tests first, minimal implementation, verification commands, and small commits.
- No implementation or code changes before the Superpowers task list is mirrored into the Linear issue description dashboard or `REQUIRED_LINEAR_MUTATIONS` is emitted.
- The dashboard task list uses stable ready-plan task IDs, CLI-style state symbols, and `last_checked` evidence from repo/worktree/verification inspection.
- Use subagents heavily for independent investigation, implementation, review, and verification lanes.
- Parallelize independent checklist items whenever they can be isolated without shared-file conflicts.
- Work in an isolated issue worktree for the issue unless the agent can prove it is already inside the correct issue worktree.
- Treat branch names and Git refs from Linear or the ready plan as Git plumbing attached to the issue worktree, not as the primary workspace.
- Prefer git worktree isolation for parallel code-changing subagents so each lane can run tests and edits independently.
- Before dispatching subagents, verify they have the right tools and permissions for their lane: repo read/write scope, test commands, package manager, Linear read tools, and any required MCP access.
- Merge back subagent work only after reviewing diffs, resolving conflicts, and rerunning the relevant verification in the issue worktree.
- Clean up temporary lane worktrees after merge-back and verification, unless they are intentionally kept and reported. Keep those lane worktrees distinct from the persistent issue worktree.
- Implement all safe, unambiguous items before asking for help.
- If one item is blocked, skip it and continue other unblocked checklist items.
- Before starting direct implementation, verify the required implementer permission context is active: workspace write access for target repositories, package manager and verification command permission, Linear MCP read/write tools for dashboard/status mutations, Git/GitHub tools when branch or PR work is in scope, and any project MCP tools required by the ready plan.
- Do not begin routine implementation in a prompt-by-prompt permission mode. Establish or inherit the required implementer permission context first; if it is unavailable, narrow to safe read-only inspection or block with the missing authority instead of asking during routine steps.
- Run in auto mode for safe, reversible implementation work from a valid ready plan. Continue through ordinary repo inspection, TDD planning, local edits, tests, validation, dashboard updates, and failed-check iteration without asking for permission between steps.
- Ask questions in batches only when the next step is destructive, irreversible, credential-gated, external-production affecting, materially scope-changing, missing required authority, or genuinely ambiguous in a way that would create nontrivial rework.
- Use the Git ref specified by Linear or by the newest ready plan for the issue worktree.
- Use the PR title specified by the newest ready plan.
- If no PR title is specified, stop and ask before opening the PR.
- Keep the draft PR current with completed work.
- Clearly mark partial work.
- Do not fake tests or make tests pass by weakening assertions.
- Do not encode temporary behavior that could be mistaken for confirmed behavior.

## Placeholders

Temporary scaffolding is allowed only when it is easy to replace and does not encode unconfirmed behavior.

Allowed examples:

- clearly marked stub behind an unused path
- empty integration hook needed to connect completed pieces
- UI placeholder when copy or final asset is explicitly out of scope

Forbidden examples:

- fake API contract
- fake migration
- guessed permissions
- guessed UX flow
- guessed validation rules
- tests that assert placeholder behavior as final behavior

All placeholders must be listed in the status comment.

## Blocking Rule

Stop and ask when:

- the next step is destructive or irreversible
- the next step is credential-gated or external-production affecting
- the next step materially changes scope beyond the ready plan
- required authority or write access is missing
- continuing requires an assumption
- more work would cause nontrivial rework after the answer changes
- the plan conflicts with code reality
- repository ownership is unclear
- verification cannot be interpreted safely

If the remaining blocked work is isolated, keep working on unrelated unblocked items.

## Parallel Subagents and Worktrees

Use subagents when work can be split by repository, feature slice, test surface, or review lane. Good parallel lanes include:

- codebase discovery for separate modules
- failing test creation for one checklist item
- implementation for independent files or packages
- focused review of a completed lane
- verification or reproduction that does not mutate shared state

Use a git worktree per code-changing lane when two or more subagents may edit concurrently. Name temporary lane worktrees from the Linear issue and lane, keep each lane on its own Git ref, and merge back into the issue worktree only after that lane reports:

- changed files
- tests run
- remaining risks
- Linear dashboard task IDs updated or ready to update

Do not dispatch parallel code-changing subagents into the same working tree. If worktree creation is unavailable, run code-changing lanes sequentially and reserve parallel subagents for read-only research, review, or verification.

Clean up temporary lane worktrees after their lane is merged and verified. If a temporary lane worktree is intentionally kept for follow-up, report its path, branch, owner, and reason in the status comment.

## PR Rules

Open a draft PR when useful implementation state exists, even if incomplete.

Issue worktree Git ref source of truth:

1. Explicit Git ref in the newest ready plan.
2. Linear issue branch metadata.
3. If neither exists, ask before creating the issue worktree ref.

PR title source of truth:

1. Explicit PR title in the newest ready plan.
2. If missing, ask before opening the PR.

Use the same draft PR for later plan revisions unless scope changes enough that a new PR is cleaner.

Before finalizing completed work, ask whether the result should end up on `main` or on a feature branch with PR. The feature branch is the PR destination, distinct from the issue worktree where implementation happens. Do not assume the destination when both are viable.

At a completed blocker, abandoned, or review-ready implementation handoff, ask whether there is anything else to add. If the answer is no, ask whether the user wants to continue with the recommended next skill, normally `linear-refine` for blockers or `linear-close` after merge evidence exists. Name the recommended skill or review action and wait for confirmation; do not auto-run it.

The PR can be marked ready only when:

- all unambiguous checklist items are done
- tests/checks pass or gaps are explicitly accepted
- placeholders are removed or explicitly accepted
- unresolved questions are gone or explicitly deferred by the human

## Commit Rules

Leave a reasonable amount of commits: enough to make review and rollback clear, not one commit per tiny edit and not one huge commit for unrelated changes.

Use semver syntax through Conventional Commit style for every commit subject, and include the Linear issue ID:

```text
feat(HCL-123): add dashboard persistence
fix(HCL-123): repair status extraction
test(HCL-123): cover dashboard validation
docs(HCL-123): document repo-local usage
```

Allowed commit types include `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`, `build`, and `ci`. Use `!` for breaking changes, for example `feat(HCL-123)!: change dashboard schema`.

Each commit should compile or clearly state why it is an intermediate checkpoint. Before final handoff, report the commit list and whether the work is on `main` or a feature branch with PR.

## Workspace Cleanup

Before final handoff:

- remove merged temporary lane worktrees
- delete the persistent issue worktree when issue work is done, unless a human explicitly asks to keep it
- prune stale worktree metadata when safe
- confirm no subagent lane is still running
- confirm no useful unmerged changes remain outside the issue worktree
- list any intentionally kept temporary lane worktrees or issue worktree with reason and next owner

Do not claim review-ready while temporary lane worktrees or the issue worktree are left unexplained.

Before applying `llm-review` or marking the PR ready, run:

```sh
scripts/verify_handoff.ts --issue-id <ISSUE-ID> --status <status-comment-file> --description <issue-description-file>
```

If the gate fails, fix the failed evidence instead of overriding it.

## TDD Planning

The implementer should create or maintain a repo-local implementation plan before editing code when the task is non-trivial. Creating this plan is part of auto mode and does not require a permission prompt when a valid ready Linear plan exists.

That plan should include:

- exact files expected to change
- independent lanes suitable for parallel subagents
- required tools and permissions for each lane
- issue worktree path and Git ref, plus temporary lane worktree names or Git refs for code-changing lanes
- failing tests to write first
- commands that prove the tests fail for the right reason
- minimal implementation steps
- commands that prove the tests pass
- commit checkpoints
- planned commit boundaries using semver syntax and the issue ID
- final destination question: `main` or feature branch with PR
- workspace cleanup plan for temporary lane worktrees and the persistent issue worktree

If the implementer cannot write a concrete TDD plan without guessing, it must ask batched questions instead of coding.

## Output

The implementer writes a marked status comment using [the status template](../templates/linear-status-comment.md).

Required status sections:

- completed work
- skipped or blocked work
- batched questions
- verification run
- draft PR link
- placeholders
- recommended next state

## State Changes

The implementer owns finalization for its own progress state.

If Linear MCP write tools are available, the implementer must apply these changes directly:

- when starting work: add `llm-active`, remove every other `llm-*` state, move status to In Progress
- when blocked: add `llm-blocked`, remove every other `llm-*` state
- when resuming: add `llm-active`, remove every other `llm-*` state
- when review-ready: add `llm-review`, remove every other `llm-*` state, move status to In Review

If Linear MCP write tools are unavailable, the implementer must emit `REQUIRED_LINEAR_MUTATIONS` with the exact labels/status/PR action needed. Do not end with only a recommended next state.
