# Superpowers Linear Persistence

Use Linear as the persistence layer for Superpowers-driven work without creating comment spam.

## Dashboard Comment

Each issue should have one dashboard comment with schema `linear-ai.dashboard.v1`. Update that one dashboard comment in place when tools allow comment updates. If update is unavailable, create a new revision only when necessary and make it clear which dashboard revision is newest.

The dashboard is the human progress surface. It uses a task list with emoji state markers:

- `✅` done
- `🔄` in progress
- `⏸️` blocked or deferred
- `⬜` todo

The task list should mirror the current Superpowers task list after each change. Agents must inspect the actual code/worktree state before marking task progress.

## Required Labels

Use cumulative `sp-*` phase labels to show which Superpowers phases have touched the issue:

- `sp-clarify`
- `sp-plan`
- `sp-implement`
- `sp-review`
- `sp-verify`

These do not replace the exclusive `llm-*` workflow state. `llm-*` answers "what should run now"; `sp-*` answers "which Superpowers phases have contributed".

## Reliability Rule

Before implementation, the Superpowers task list must exist in the one dashboard comment. During implementation, update the dashboard after each task status change. Do not create a new ordinary progress comment for every task.
