---
name: linear-repo-reconcile
description: "Reconcile messy Linear-linked repository state after multiple agents, branches, worktrees, commits, or PRs: discover issue-tagged work, compare it with main, PRs, Linear issue content, comments, revisions, and timeline evidence; produce a reconciliation plan; safely delete only proven-merged local work; integrate finished work; rebase active work; diagnose common pipeline failures; and update Linear statuses, labels, descriptions, and marked comments to match verified repository reality."
---

# Linear Repo Reconcile

Use this when a repository has accumulated issue-linked branches, worktrees, commits, PRs, or partially completed agent work and the operator wants to return the repo and Linear issues to a clean, truthful, resumable state.

This is a reconciliation and cleanup skill. It must prove state before deleting, merging, rebasing, closing, or moving issues.

## Execution Spine

Follow this order:

1. Discover issue-linked work.
2. Gather repo, PR, Linear, and timeline evidence.
3. Diagnose CI/pipeline failures.
4. Classify repo state and Linear state.
5. Produce a reconciliation plan.
6. Confirm risky or destructive actions.
7. Execute safe approved actions.
8. Verify repo and Linear state.
9. Report final state and remaining risks.

## Core Rule

Do not trust any single source alone.

- Do not trust Linear status alone.
- Do not trust PR state alone.
- Do not trust branch names alone.
- Do not trust timestamps alone.
- Do not trust issue labels alone.
- Do not trust agent comments alone.
- Use repo evidence plus tracker evidence before final mutations.
- Use timestamps only as supporting evidence, never as proof that code is merged or safe to delete.

## Scope

Reconcile issue-linked work from:

- local branches
- remote branches
- git worktrees
- commits mentioning Linear issue IDs
- PR titles, bodies, branches, and merge commits
- Linear issue IDs in branch names or commit messages
- Linear comments, marked plan/status revisions, descriptions, labels, status, relations, and timeline/history evidence when available

## Inputs

Accept any of:

- explicit Linear issue IDs
- a branch, worktree, PR, or commit range
- all issue-tagged local branches/worktrees
- all open PRs matching Linear issue IDs
- all local work since a given date
- a team/project/label-scoped Linear query

If no scope is supplied, inspect local branches/worktrees and open PRs, then produce a bounded candidate list before deeper work.

## Evidence Sources

Use available evidence in this order:

1. Git evidence:
   - `git status`
   - `git worktree list`
   - local and remote branches
   - `git log --all --grep <ISSUE-ID>`
   - `git branch --contains`
   - `git merge-base --is-ancestor`
   - `git cherry`
   - `git patch-id`
   - diffs against `main` / `origin/main`
2. PR evidence:
   - PR state
   - base/head refs
   - merge commit
   - commits
   - checks/CI
   - review state
   - linked issues
   - whether the PR was merged, closed unmerged, draft, blocked, or superseded
3. Linear evidence:
   - issue title, description, status, labels, assignee, project, relations
   - branch metadata and linked PRs/resources
   - comments
   - newest valid marked plan comment
   - newest valid marked status comment
   - dashboard block in the issue description
   - issue history/timeline if exposed
   - Airbyte/export/API Issue History when available
   - audit entries or webhook history when available
4. Time evidence:
   - issue created/updated/completed timestamps
   - comment timestamps
   - plan/status revision timestamps
   - branch creation/ref update time
   - commit author/committer dates
   - PR opened/updated/merged/closed timestamps

Time evidence explains likely sequence. It does not prove correctness.

## Discovery

Build an issue work map.

For each candidate, record:

```yaml
issue_id:
title:
linear_url:
repo_paths:
branches:
worktrees:
prs:
commits:
main_comparison:
linear_status:
linear_labels:
latest_plan_revision:
latest_status_revision:
timeline_summary:
suspected_owner:
evidence_gaps:
```

Normalize moved Linear issues. If an issue has an old team prefix and a new team prefix, treat old IDs as aliases and record both.

When an issue has aliases from team moves, search every alias in:

- branch names
- worktree paths
- PR titles and bodies
- commit subjects and bodies
- Linear comments
- release evidence
- closeout evidence

## Pipeline Failure Diagnosis

Before classifying finished or conflicted work, inspect CI/pipeline evidence for each PR or branch when available.

Gather:

- latest PR checks
- failed job names
- failed test names
- lint/typecheck/build errors
- dependency/install errors
- mergeability status
- base branch drift
- required check status
- flaky-test hints from retries or prior runs

Classify common failure reasons:

```yaml
pipeline_failure:
  # none | base_drift | merge_conflict | test_failure | lint_failure |
  # typecheck_failure | build_failure | dependency_failure | missing_secret |
  # environment_failure | flaky | cancelled | unknown
```

Use this classification to decide whether the branch is recoverable:

- `base_drift`: rebase/merge onto main, rerun targeted verification.
- `merge_conflict`: classify as `conflicted` unless conflict is mechanical and safe.
- `test_failure`: inspect whether failure is caused by branch changes, main drift, or unrelated flake.
- `lint_failure` / `typecheck_failure` / `build_failure`: fix only if scoped and mechanical; otherwise mark blocked.
- `dependency_failure`: retry install or update lockfile only if consistent with repo policy.
- `missing_secret` / `environment_failure`: do not modify code; mark blocked with infrastructure evidence.
- `flaky`: preserve branch, record evidence, rerun once if cheap and allowed.
- `cancelled` / `unknown`: do not infer completion from absence of green CI.

A branch is not `unmerged_complete` unless required verification is green or the missing verification is explicitly accepted in Linear evidence.

Working branches are valuable evidence. Do not delete or abandon a branch merely because its PR failed CI. First diagnose whether the failure is due to base drift, mechanical breakage, environment problems, missing secrets, flaky tests, or a real implementation defect.

## Classification

Classify repo state and Linear state separately.

```yaml
repo_state:
  # main_equivalent | unmerged_complete | active_dirty | conflicted | stale | unknown

linear_state:
  # done_correct | should_be_done | should_be_review | should_be_active | should_be_blocked | state_conflict
```

### Repo State Rules

`main_equivalent`:

- Branch/worktree/PR content is already present on `main` or `origin/main`.
- Proof can be merge commit ancestry, branch tip ancestry, patch-equivalent diff, or direct file/content evidence.
- Squash and rebase merges often rewrite commits, so ancestry checks can produce false negatives. A linked PR merged into the target mainline can prove main equivalence when PR merge/squash evidence and current main content agree, even if branch commits are not ancestors of main.
- Do not trust merged PR state alone when the PR targeted a non-main branch, was later reverted, is cross-repo with unclear base, or has content that no longer matches current main.

`unmerged_complete`:

- Work appears complete against issue acceptance criteria.
- Not yet present on main.
- Required verification is green or the missing verification is explicitly accepted in Linear evidence.
- Needs merge, PR, or direct integration.

`active_dirty`:

- Work is incomplete but valuable.
- Branch/worktree has meaningful diff not on main.
- Issue still has open checklist items, blockers, active implementation state, or known repairable CI failures.

`conflicted`:

- Work is valuable but cannot be cleanly rebased/merged.
- Semantic conflicts, real implementation defects, or CI failures require product/design judgment.

`stale`:

- Work has no clear recent progress and does not match current issue state.
- Do not assign only because CI failed.
- Do not delete unless also proven `main_equivalent` or explicitly abandoned by durable evidence.

`unknown`:

- Evidence is incomplete or contradictory.
- Do not mutate destructively.

### Linear State Rules

`done_correct`:

- Linear says Done and repo evidence proves work is on main/released.

`should_be_done`:

- Repo evidence proves work is on main/released, but Linear is not Done.

`should_be_review`:

- Work is complete but awaiting PR/review/merge.

`should_be_active`:

- Work is in progress and should remain active.

`should_be_blocked`:

- Work is blocked, conflicted, ambiguous, stale, or missing required decisions.

`state_conflict`:

- Linear status, labels, comments, and repo evidence disagree.

## Reconciliation Plan

Always produce a reconciliation plan before destructive or history-changing actions.

The plan must include:

```yaml
summary:
issues:
  - issue_id:
    repo_state:
    linear_state:
    pipeline_failure:
    evidence:
    proposed_repo_actions:
    proposed_linear_actions:
    destructive_actions:
    verification:
    risk:
    requires_confirmation:
```

Safe actions may proceed automatically when proven and reversible.

Safe automatic actions:

- deleting a local branch that is proven redundant, clean, not checked out by any worktree, has no unpushed unique work, and has no plausible active owner
- updating Linear issue fields/comments when evidence is complete and write tools are available

Require explicit confirmation before:

- deleting worktrees
- deleting remote branches
- deleting local branches with unpushed unique commits, recent activity, unclear ownership, or active worktree association
- force-pushing
- closing PRs
- rewriting shared branches
- moving ambiguous issues to Done
- discarding unmerged code
- applying semantic conflict resolutions
- any action that cannot be trivially reversed

## Repo Actions

### Already Merged / Main Equivalent

When work is proven `main_equivalent`:

- remove redundant local worktree only after confirming it has no uncommitted changes
- delete local branch only after proving it is merged or patch-equivalent
- delete remote branch only with explicit confirmation unless repository policy allows automatic cleanup
- do not delete dependent stacked branches
- record exact proof

Valid proof examples:

```sh
git merge-base --is-ancestor <branch-or-commit> origin/main
git branch --contains <commit>
git cherry origin/main <branch>
git diff origin/main...<branch>
```

Ancestry-only checks such as `git merge-base --is-ancestor`, `git branch --contains`, and `git branch --merged origin/main` can falsely report squash-merged or rebase-merged work as unmerged. Treat them as sufficient when positive, not sufficient when negative.

For patch-equivalence checks, compare stable patch IDs from branch-only commits against mainline commits near the suspected merge window:

```sh
git log --cherry-pick --right-only --no-merges --format=%H origin/main...<branch>
git show <branch-commit> -- | git patch-id --stable
git show <main-candidate-commit> -- | git patch-id --stable
```

Patch IDs are supporting evidence, not magic proof. They can fail when squash commits include conflict resolutions, follow-up edits, formatting changes, or multiple logical changes in one commit. If patch IDs do not match, compare the final diff and PR evidence before classifying.

For squash/rebase merges, prefer:

- linked PR merged into the intended target branch
- merge/squash commit or PR close event present on current mainline
- current main contains the PR's expected file/content changes
- issue ID or alias appears in PR title/body, commits, merge message, release evidence, or Linear linked resources
- no later revert or superseding PR invalidates the content

## Active Ownership Checks

Before removing, rebasing, force-updating, or deleting any branch/worktree, check whether someone or another agent may still be using it.

Inspect:

- `git worktree list --porcelain` for checked-out branches and lock state
- whether the current shell is inside the target worktree
- uncommitted changes, staged changes, untracked files, and ignored generated artifacts
- unpushed commits unique to the branch
- recent `HEAD`, index, or working-tree mtimes
- running processes whose current working directory is inside the worktree
- active Linear `in-use` labels or claim blocks
- recent Linear comments/status updates indicating active work
- recent PR updates, pushes, or CI runs

If active ownership is plausible, classify the item as `active_dirty` or `should_be_blocked`. Do not remove it.

## Worktree Removal

Remove worktrees only with:

```sh
git worktree remove <path>
```

Never use `rm -rf` for git worktrees. Never remove the current working directory. Honor worktree locks. Do not force-remove a worktree unless explicitly confirmed, the worktree is proven abandoned, and the branch/ref has been preserved or proven redundant.

### Finished But Unmerged

When work is `unmerged_complete`:

- rebase or merge onto current main
- run targeted verification
- create/update PR or merge to main according to repo policy
- preserve issue ID in commit/PR title/body
- include Linear closing magic word only when final destination should close the issue
- update Linear to review state unless merged during this run

### Active Work

When work is `active_dirty`:

- rebase or merge onto current main when safe
- resolve mechanical conflicts only when obvious
- keep worktree/branch
- update issue dashboard with current branch/worktree/PR
- leave exact next steps

### Blocked / Conflicted

When work is `conflicted`, `stale`, or `unknown`:

- do not delete code
- do not force-push
- do not move issue to Done
- preserve branch/worktree
- update Linear to blocked state or emit required mutations
- record blocker, files, evidence gap, pipeline failure class, and recommended decision

## Linear Actions

Repository reconciliation is incomplete until Linear reflects verified repo state.

For every touched issue, update Linear or emit exact `REQUIRED_LINEAR_MUTATIONS`.

Update:

- issue status
- `llm-*` workflow labels
- `in-use` claim label/block
- issue description dashboard
- marked reconciliation/status comment
- branch/worktree/PR metadata when relevant
- preserve cumulative `sp-*` labels

### Mapping

`main_equivalent` + `should_be_done`:

- move issue to Done
- remove `llm-refine`, `llm-ready`, `llm-active`, `llm-blocked`, `llm-review`, `llm-split`
- remove `in-use`
- preserve `sp-*`
- post closeout/reconciliation evidence

`unmerged_complete` + `should_be_review`:

- set issue to In Review or team equivalent
- apply `llm-review`
- remove `llm-refine`, `llm-ready`, `llm-active`, `llm-blocked`, `llm-split`
- remove stale `in-use` unless actively claimed by this run
- record PR/branch/verification evidence

`active_dirty` + `should_be_active`:

- set issue to In Progress or team equivalent
- apply `llm-active`
- remove contradictory `llm-*`
- keep or refresh `in-use` only if this run is actively claiming the work
- update dashboard with active ref/worktree and remaining checklist

`conflicted`, `stale`, or `unknown`:

- set issue to Blocked or Todo depending on remaining value
- apply `llm-blocked` when action is blocked by missing evidence, conflicts, pipeline failures, or required decisions
- remove contradictory active/review labels
- post blocker comment with exact next decision

`state_conflict`:

- prefer verified marked comments over stale labels
- prefer repo proof over tracker assumptions
- make the smallest Linear repair that restores truth

## Reconciliation Comment

Post a marked comment for every issue changed or requiring action.

Use this shape:

````md
<!-- linear-ai:reconcile v1 issue=TEAM-123 -->

```yaml
schema: linear-ai.reconcile.v1
issue_id: TEAM-123
repo_state: main_equivalent
linear_state: should_be_done
pipeline_failure: none
source_refs:
  - branch: feature/TEAM-123-example
  - pr: https://github.com/org/repo/pull/123
main_evidence:
  - type: merge_commit
    value: abc123
  - type: ancestry
    value: "abc123 is ancestor of origin/main"
verification:
  - check: npm test
    result: passed
repo_actions:
  - deleted local branch feature/TEAM-123-example
linear_actions:
  - moved issue to Done
  - removed llm-* labels
  - removed in-use
remaining_risk: none
```

Summary of what was reconciled.

<!-- /linear-ai:reconcile -->
````

If the skill cannot write to Linear, emit:

```md
## REQUIRED_LINEAR_MUTATIONS

- issue: TEAM-123
- status: Done
- add_labels: []
- remove_labels: [`llm-refine`, `llm-ready`, `llm-active`, `llm-blocked`, `llm-review`, `llm-split`, `in-use`]
- description_update: ...
- comment: ...
```

## Verification

Before claiming completion:

- run repo status checks relevant to touched code
- verify no unintended dirty worktree remains
- verify merged/deleted branches were actually removed
- verify active branches still exist
- verify Linear issue status/labels/comments changed as intended, or emit exact `REQUIRED_LINEAR_MUTATIONS`
- verify no issue-linked work was silently dropped

Minimum final checks:

```sh
git status --short
git worktree list
git branch --merged origin/main
git branch --no-merged origin/main
```

`git branch --merged origin/main` is ancestry-only. It will not reliably list squash-merged or rebase-merged branches. Use it as a cleanup hint, not the sole proof of what is redundant.

Use project-specific lint/typecheck/tests when code was integrated, rebased, or conflict-resolved.

## Final Report

Return:

```yaml
mode: linear-repo-reconcile
scope:
main_ref:
issues_reconciled:
deleted_local_branches:
deleted_worktrees:
deleted_remote_branches:
integrated_work:
rebased_active_work:
blocked_items:
ambiguous_items:
pipeline_failures:
linear_updates:
required_linear_mutations:
verification:
remaining_risks:
next_actions:
```

## Stop Conditions

Stop when:

- all scoped issue-linked work is classified
- safe reconciliation actions are complete
- destructive actions are either completed with confirmation or listed as pending
- Linear is updated or exact required mutations are emitted
- repo has a clean, documented, resumable state

Do not stop with unknown deleted code, unreported conflicts, or Linear state known to contradict repo evidence.
