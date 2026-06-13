# Superpowers Linear Persistence

Use Linear as the persistence layer for Superpowers-driven work without creating comment spam.

## Dashboard Comment

Each issue should have one dashboard comment with schema `linear-ai.dashboard.v1`. Update that one dashboard comment in place when tools allow comment updates. If update is unavailable, create a new revision only when necessary and make it clear which dashboard revision is newest.

The dashboard is the human progress surface. It uses a machine-readable YAML task list plus a human CLI-style task list with stable task IDs and state symbols:

- `✓` done
- `●` active
- `■` blocked
- `□` todo
- `-` skipped
- `…` deferred

The task list should mirror the current Superpowers task list after each top-level task state change. Task IDs must match the latest ready plan checklist. Each task must include `last_checked` evidence from the repo, worktree, plan, status, PR, or verification source used to set or repair that state.

Agents must inspect the actual code/worktree state before marking task progress. If dashboard drift is derivable from repo/worktree and verification evidence, update the one dashboard comment to match reality. If it is ambiguous, block and ask instead of guessing.

## Required Labels

Use cumulative `sp-*` phase labels to show which Superpowers phases have touched the issue:

- `sp-clarify`
- `sp-plan`
- `sp-tdd`
- `sp-implement`
- `sp-review`
- `sp-verify`

These do not replace the exclusive `llm-*` workflow state. `llm-*` answers "what should run now"; `sp-*` answers "which Superpowers phases have contributed".

## Reliability Rule

No implementation or code changes before the Superpowers task list is mirrored into the one dashboard comment or `REQUIRED_LINEAR_MUTATIONS` is emitted. During implementation, update the dashboard after each top-level task status change. Do not create a new ordinary progress comment for every task.
