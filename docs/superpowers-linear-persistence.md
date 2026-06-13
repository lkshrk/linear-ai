# Superpowers Linear Persistence

Use Linear as the persistence layer for Superpowers-driven work without creating comment spam.

## Dashboard Description

Each issue should have one dashboard block in the Linear issue description with schema `linear-ai.dashboard.v1`. Update that marked description block in place when tools allow issue description updates. Do not replace human-authored description text; insert or update only the `linear-ai:dashboard` marked block.

Dashboard comments are fallback-only. Use at most one fallback dashboard comment when description writes are unavailable, and emit `REQUIRED_LINEAR_MUTATIONS` with the desired description update whenever the fallback is used.

The dashboard is the human progress surface. It uses a machine-readable YAML task list plus a human CLI-style task list with stable task IDs and state symbols:

- `✓` done
- `●` active
- `■` blocked
- `□` todo
- `-` skipped
- `…` deferred

The task list should mirror the current Superpowers task list after each top-level task state change. Task IDs must match the latest ready plan checklist. Each task must include `last_checked` evidence from the repo, worktree, plan, status, PR, or verification source used to set or repair that state.

Agents must inspect the actual code/worktree state before marking task progress. If dashboard drift is derivable from repo/worktree and verification evidence, update the description dashboard to match reality. If it is ambiguous, block and ask instead of guessing.

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

No implementation or code changes before the Superpowers task list is mirrored into the issue description dashboard or `REQUIRED_LINEAR_MUTATIONS` is emitted. During implementation, update the dashboard after each top-level task status change. Keep comments for immutable workflow events: blockers, review readiness, abandoned work, verification failures, handoffs, and write-unavailable mutation instructions.
