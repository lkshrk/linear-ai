---
name: linear-close
description: "Finalize a Linear issue after review: verify merged PR evidence or issue-ID commit evidence, update dashboard/status evidence, move the issue to Done, and clear LLM workflow labels."
---

# Linear Close

Use this after implementation review when a PR has been merged or a direct issue-ID commit is present and the Linear issue still needs final closeout.

Read and follow:

- `agents/closer.md`
- `docs/workflow.md`
- `docs/agent-required-passes.md`
- `docs/comment-validation.md`
- `docs/tools.md`
- `templates/linear-status-comment.md`

Do not implement code, merge PRs, or alter review policy. This skill only finalizes work after merged PR evidence or issue-ID commit evidence exists.

## Linear MCP Contract

Use these Linear MCP tools when available:

- `get_issue` - read the issue description dashboard, labels, status, project, branch metadata, and links.
- `list_comments` - find newest marked plan/status comments and prior closeout evidence.
- `save_comment` - post the final immutable marked status/closeout comment or blocked closeout evidence.
- `save_issue` - update the issue description dashboard, move status to `Done`, remove all `llm-*` labels, and preserve cumulative `sp-*` labels.

Use Git/GitHub evidence when available:

```sh
gh pr view <PR> --json url,state,isDraft,baseRefName,mergeCommit,statusCheckRollup,commits > pr.json
git pull
git merge-base --is-ancestor <merge-commit> origin/main
```

For direct commit closeout, capture commit evidence containing the issue ID plus completed status checks:

```json
{
  "oid": "replace-with-commit-sha",
  "subject": "fix(HCL-123): example issue commit",
  "statusCheckRollup": [
    { "name": "test", "status": "COMPLETED", "conclusion": "SUCCESS" }
  ]
}
```

Validate closeout evidence with:

```sh
scripts/verify_closeout.ts --issue-id <ISSUE-ID> --pr pr.json --repo . --base origin/main
scripts/verify_closeout.ts --issue-id <ISSUE-ID> --commit commit.json --repo . --base origin/main
```

Validate final marked comments and the issue description dashboard with:

```sh
scripts/validate_marked_comments.ts --description <issue-description-file> <status-comment-file>
```

Use the local JavaScript package manager or runtime available to the agent: Bun can run the `.ts` scripts directly; Node/npm/pnpm/yarn environments should run them through a TypeScript runner such as `tsx`.

## Closeout Requirements

Before moving the issue to `Done`, prove all of the following:

- the linked PR is merged
- or direct commit evidence contains the issue ID
- mainline contains the merge commit, the direct issue-ID commit, or equivalent remote mainline evidence
- CI is complete and successful for the merged PR, merge commit, or direct issue-ID commit
- final dashboard/status evidence does not contradict closeout
- all `llm-*` workflow state labels will be removed
- cumulative `sp-*` labels will be preserved

If any required evidence is missing, do not close the issue. Post blocked evidence or emit `REQUIRED_LINEAR_MUTATIONS`.

## Finalization

Successful closeout must:

- update the marked dashboard block in the issue description when present
- post one final immutable marked status/closeout comment
- move Linear status to `Done`
- remove `llm-refine`, `llm-ready`, `llm-active`, `llm-blocked`, `llm-review`, and `llm-split`
- preserve cumulative `sp-*` labels such as `sp-clarify`, `sp-plan`, `sp-tdd`, `sp-implement`, `sp-verify`, and `sp-review`

If Linear MCP write tools are unavailable, do not claim labels, status, dashboard, or comments were updated. Emit `REQUIRED_LINEAR_MUTATIONS` with the exact issue description, final closeout comment, labels, and status changes.

## Step Completion Handoff

When closeout completes or blocks, report what changed, merge evidence, CI evidence, dashboard/status evidence, current Linear labels/status, and the recommended next step.

Ask if there is anything else to add for this closeout step. If yes, continue the current step by checking that closeout evidence or updating the closeout report. If no, recommend moving to the next workflow step, normally `linear-status` to confirm the issue is closed or to inspect any remaining issue.

After the add-more question is answered "no", ask whether the user wants to continue with the recommended next skill. Name the recommended next skill explicitly and wait for user confirmation; do not auto-run it.

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
