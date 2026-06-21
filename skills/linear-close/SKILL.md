---
name: linear-close
description: "Finalize a Linear issue after review: verify merged PR evidence, issue-ID commit evidence, moved cross-team issue IDs, or squash/import release file evidence, update dashboard/status evidence, move the issue to Done, and clear LLM workflow labels."
---

# Linear Close

Use this after implementation review when a PR has been merged, a direct issue-ID commit is present, or squash/import release evidence proves the expected files and content are present on current main and release/main CI passed. If the current Linear issue ID and the implemented issue ID recorded in the ticket evidence have different team prefixes because the issue was moved to another team, manually verify the old implemented ID according to the same closeout rules, then close the current issue with a note naming both IDs.

Read and follow:

- `agents/closer.md`
- `docs/workflow.md`
- `docs/agent-required-passes.md`
- `docs/comment-validation.md`
- `docs/tools.md`
- `templates/linear-status-comment.md`

Do not implement code, merge PRs, or alter review policy. This skill only finalizes work after merged PR evidence, issue-ID commit evidence, or squash/import release evidence exists.

The issue may already be in `Done` when this skill runs, because the implementer's closing magic word (`Fixes HCL-123`) makes Linear auto-move it on merge. Treat an already-`Done` issue as expected: still verify the evidence, update the dashboard, post the closeout comment, and strip `llm-*` and `in-use`. Moving status to `Done` is then a no-op. Do not reopen the issue or treat already-`Done` as an error or as a reason to skip the closeout finalization.

## Claim Lock

Follow the Claim Lock Rule in `docs/workflow.md`. On start, re-read the issue; if it already carries `in-use` and this run is not resuming its own claim, stop and report the issue as claimed without changing it. Otherwise add the `in-use` label when claiming the issue. `in-use` is outside the `llm-*` namespace, so the closeout `llm-*` strip does not remove it; remove `in-use` explicitly during finalization (and on any blocked or abandoned stop).

When claiming, write the `linear-ai:claim` block to the issue description (`templates/linear-claim-block.md`) with `claimed_by: linear-close` and an ISO 8601 `claimed_at`. During finalization, remove the claim block together with removing the `in-use` label.

## Linear MCP Contract

Use these Linear MCP tools when available:

- `get_issue` - read the issue description dashboard, labels, status, project, branch metadata, and links.
- `list_comments` - find newest marked plan/status comments and prior closeout evidence.
- `save_comment` - post the final immutable marked status/closeout comment or blocked closeout evidence.
- `save_issue` - update the issue description dashboard, move status to `Done`, remove all `llm-*` labels, remove the `in-use` claim, and preserve cumulative `sp-*` labels.

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

For squash/import release closeout, capture release evidence with successful release/main checks plus file assertions that can be verified against the current mainline ref:

```json
{
  "statusCheckRollup": [
    { "name": "release main CI", "status": "COMPLETED", "conclusion": "SUCCESS" }
  ],
  "files": [
    { "path": "dist/manifest.json", "contains": "\"version\":\"2026.06.14\"" }
  ]
}
```

Validate closeout evidence with:

```sh
scripts/verify_closeout.ts --issue-id <ISSUE-ID> --pr pr.json --repo . --base origin/main
scripts/verify_closeout.ts --issue-id <ISSUE-ID> --commit commit.json --repo . --base origin/main
scripts/verify_closeout.ts --issue-id <CURRENT-ISSUE-ID> --implemented-issue-id <OLD-ISSUE-ID> --commit commit.json --repo . --base origin/main
scripts/verify_closeout.ts --issue-id <ISSUE-ID> --release release.json --repo . --base origin/main
```

Use `--implemented-issue-id` only when the current issue key and implemented issue key have different Linear team prefixes after an issue move. For PR evidence, include PR commits so the helper can verify a commit mentions the old implemented ID. The closeout comment must state that `<CURRENT-ISSUE-ID>` was moved from or implemented under `<OLD-ISSUE-ID>`, and that implementation, mainline, and CI evidence were manually verified against the old ID.

Validate final marked comments and the issue description dashboard with:

```sh
scripts/validate_marked_comments.ts --description <issue-description-file> <status-comment-file>
```

Use the local JavaScript package manager or runtime available to the agent: Bun can run the `.ts` scripts directly; Node/npm/pnpm/yarn environments should run them through a TypeScript runner such as `tsx`.

## Closeout Requirements

Before moving the issue to `Done`, prove all of the following:

- the linked PR is merged
- or direct commit evidence contains the issue ID
- or, for a cross-team moved issue, PR commit evidence or direct commit evidence contains the old implemented issue ID and the current issue ID has a different team prefix
- or squash/import release evidence proves the expected file paths and content are present on current main
- mainline contains the merge commit, the direct issue-ID commit, equivalent remote mainline evidence, or the expected release file/content evidence
- CI is complete and successful for the merged PR, merge commit, direct issue-ID commit, or release/main evidence
- final dashboard/status evidence does not contradict closeout
- all `llm-*` workflow state labels and the `in-use` claim label will be removed
- cumulative `sp-*` labels will be preserved

If any required evidence is missing, do not close the issue. Post blocked evidence or emit `REQUIRED_LINEAR_MUTATIONS`.

## Finalization

Successful closeout must:

- update the marked dashboard block in the issue description when present
- post one final immutable marked status/closeout comment, including both IDs when closeout used an old implemented issue ID after a team move, or the verified file/content and release/main CI evidence when closeout used squash/import release evidence
- move Linear status to `Done` (a no-op when a closing magic word already moved it there)
- remove `llm-refine`, `llm-ready`, `llm-active`, `llm-blocked`, `llm-review`, and `llm-split`
- remove the `in-use` claim label
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
