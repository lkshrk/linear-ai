---
name: linear-deliver-feature
description: "Run the full Linear AI workflow for one feature or bug: create issue, refine plan, implement work, verify, prepare review handoff, and close after merge. Use when the user wants one feature delivered through all Linear AI steps end to end."
---

# Linear Deliver Feature

Use this as the combined lifecycle controller for one Linear issue. Run the narrower skills as phase implementations, but keep the state transitions here.

Read and follow `docs/superpowers-linear-persistence.md` before changing workflow state or code.

Start by running `linear-status` against the actual Linear issue. Use the detected labels, status, newest marked comments, and issue description dashboard to resume from the detected phase. Do not start from memory or from the user's last chat message when Linear evidence is available.

## Lifecycle State Machine

1. `detect-current-state` - run `linear-status` to identify current phase, missing evidence, state disagreement, and recommended next skill.
2. `capture-metadata` - query live Linear teams, projects, and labels, then normalize them with `scripts/linear_metadata.ts capture`.
3. `create-issue` - run `linear-create-issue` to create or update the issue with target team, target project, proposed matching labels/tags, type label, and one LLM state label.
4. `refine-plan` - run `linear-refine` until the issue has a marked plan comment with `plan_status: ready` or an explicit blocked/accepted-unknown state.
5. `implement` - run `linear-implement` only after the ready plan exists and the Superpowers task list is mirrored into the issue description dashboard; make code changes, run verification, update the dashboard before moving between top-level tasks, and post marked status comments only for blockers, review readiness, abandoned work, verification failures, handoffs, or write-unavailable mutations.
6. `validate-comments` - run `scripts/validate_marked_comments.ts` against the final plan/status comments and issue description dashboard before claiming the workflow is ready for review.
7. `review-handoff` - confirm PRs or patches are ready, verification evidence is present, and the issue has exactly one workflow state label: `llm-review` when review is ready, or `llm-blocked` when not.
8. `closeout` - run `linear-close` after review only when the PR is merged; verify merged PR, mainline, and CI evidence, then move the issue to `Done`, remove all `llm-*` labels, preserve cumulative `sp-*` labels, update the dashboard, and post final closeout evidence.
9. `final-linear-mutations` - apply final labels/comments through Linear MCP when write tools are available, or emit `REQUIRED_LINEAR_MUTATIONS` with exact changes.

Do not advance to the next lifecycle state when the current state lacks required evidence. Stop at the current state and record the blocker.

## Step Completion Handoff

After each lifecycle state completes, report what changed, the evidence that the current state is satisfied, current Linear labels/status, any marked comment revision, and the recommended next step.

Ask if there is anything else to add for this lifecycle state. If yes, continue the current step and update the relevant issue, plan, code, verification, or status comment. If no, recommend moving to the next workflow step and name the next lifecycle state.

Use this response shape:

- Current phase
- What changed
- Evidence
- Missing evidence
- Open blocker
- Recommended next step
- Recommended next skill
- Question: Is there anything else to add before moving on?

## Linear MCP Contract

Use Linear MCP through each phase skill:

- `linear-status` uses `get_issue` and `list_comments`.
- `linear-create-issue` uses `list_teams`, `list_projects`, `list_issue_labels`, and `save_issue`.
- `linear-refine` uses `get_issue`, `list_comments`, `save_comment`, and `save_issue`.
- `linear-implement` uses `get_issue`, `list_comments`, `save_comment`, and `save_issue`.
- `linear-close` uses `get_issue`, `list_comments`, `save_comment`, and `save_issue`.

Do not skip validation between phases. Capture live metadata with:

```sh
scripts/linear_metadata.ts capture --teams linear-teams.json --projects linear-projects.json --labels linear-labels.json
```

Validate marked comments and the `linear-ai.dashboard.v1` issue description dashboard with CLI-style task list and `symbol` task markers with:

```sh
scripts/validate_marked_comments.ts --description <issue-description-file> <comment-file>
```

For structured intake dry runs, use:

```sh
scripts/intake_issue.ts --metadata <metadata.json> <input.yaml>
```

Use the local JavaScript package manager or runtime available to the agent. Bun can run the `.ts` scripts directly; Node/npm/pnpm/yarn environments should run them through a TypeScript runner such as `tsx`.

## Stop Conditions

- Stop at `capture-metadata` if Linear MCP read tools are unavailable and no current metadata snapshot exists.
- Stop at `create-issue` if the target team, target project, proposed matching labels/tags, or type label cannot be selected from live metadata.
- Stop at `refine-plan` if required product facts are missing and cannot be accepted as unknowns.
- Stop at `implement` if verification cannot prove the ready plan was satisfied.
- Stop at `review-handoff` if the issue cannot be moved to exactly one final LLM state label.
- Stop at `closeout` if PR merge, mainline, or CI evidence is missing; keep `llm-review` until closeout is proven.

If any phase is blocked by missing product facts or unavailable write authority, post or emit the precise `REQUIRED_LINEAR_MUTATIONS` and stop at the blocked handoff state instead of guessing.
