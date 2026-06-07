---
name: linear-deliver-feature
description: "Run the full Linear AI workflow for one feature or bug: create issue, refine plan, implement work, verify, and prepare review handoff. Use when the user wants one feature delivered through all Linear AI steps end to end."
---

# Linear Deliver Feature

Use this as the combined lifecycle controller for one Linear issue. Run the narrower skills as phase implementations, but keep the state transitions here.

## Lifecycle State Machine

1. `capture-metadata` - query live Linear teams, projects, and labels, then normalize them with `scripts/linear_metadata.ts capture`.
2. `create-issue` - run `linear-create-issue` to create or update the issue with target team, target project, component tag, type label, and one LLM state label.
3. `refine-plan` - run `linear-refine` until the issue has a marked plan comment with `plan_status: ready` or an explicit blocked/accepted-unknown state.
4. `implement` - run `linear-implement` only after the ready plan exists; make code changes, run verification, and post a marked status comment.
5. `validate-comments` - run `scripts/validate_marked_comments.ts` against the final plan and status comments before claiming the workflow is ready for review.
6. `review-handoff` - confirm PRs or patches are ready, verification evidence is present, and the issue has exactly one workflow state label: `llm-review` when review is ready, or `llm-blocked` when not.
7. `final-linear-mutations` - apply final labels/comments through Linear MCP when write tools are available, or emit `REQUIRED_LINEAR_MUTATIONS` with exact changes.

Do not advance to the next lifecycle state when the current state lacks required evidence. Stop at the current state and record the blocker.

## Linear MCP Contract

Use Linear MCP through each phase skill:

- `linear-create-issue` uses `list_teams`, `list_projects`, `list_issue_labels`, and `save_issue`.
- `linear-refine` uses `get_issue`, `list_comments`, `save_comment`, and `save_issue`.
- `linear-implement` uses `get_issue`, `list_comments`, `save_comment`, and `save_issue`.

Do not skip validation between phases. Capture live metadata with:

```sh
scripts/linear_metadata.ts capture --teams linear-teams.json --projects linear-projects.json --labels linear-labels.json
```

Validate marked comments with:

```sh
scripts/validate_marked_comments.ts <comment-file>
```

For structured intake dry runs, use:

```sh
scripts/intake_issue.ts --metadata <metadata.json> <input.yaml>
```

Use the local JavaScript package manager or runtime available to the agent. Bun can run the `.ts` scripts directly; Node/npm/pnpm/yarn environments should run them through a TypeScript runner such as `tsx`.

## Stop Conditions

- Stop at `capture-metadata` if Linear MCP read tools are unavailable and no current metadata snapshot exists.
- Stop at `create-issue` if the target team, target project, component tag, or type label cannot be selected from live metadata.
- Stop at `refine-plan` if required product facts are missing and cannot be accepted as unknowns.
- Stop at `implement` if verification cannot prove the ready plan was satisfied.
- Stop at `review-handoff` if the issue cannot be moved to exactly one final LLM state label.

If any phase is blocked by missing product facts or unavailable write authority, post or emit the precise `REQUIRED_LINEAR_MUTATIONS` and stop at the blocked handoff state instead of guessing.
