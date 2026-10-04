---
name: linear-reconcile
description: "Bring a repository's issue-linked branches, worktrees, commits and PRs back in line with Linear: prove what is already on main, finish or park the rest, clean up safely and correct the issue statuses. Use after many agents, branches or sessions left the repository and Linear out of sync."
---

# Linear Reconcile

Read `docs/workflow.md`. Prove state before deleting, merging, rebasing, closing or moving anything.

## Order

1. Discover issue-linked work.
2. Gather evidence from the repository, PRs and Linear.
3. Classify the repository state and the Linear state separately.
4. Show a reconciliation plan.
5. Confirm risky or destructive actions with the human.
6. Execute the approved safe actions.
7. Verify and report the final state and remaining risks.

## Do Not Trust A Single Source

Not the Linear status, not the PR state, not branch names, not timestamps, not comments alone. Combine
repository evidence with tracker evidence before any change; timestamps are supporting evidence only.

## Inputs

Explicit issue IDs, a branch, worktree, PR or commit range, all issue-tagged local branches and worktrees,
all open PRs naming issue IDs, or work since a date. Without a scope, list local branches, worktrees and open
PRs, and agree on a bounded candidate list first.

## Classify

Repository state per branch, worktree or PR:

| State | Meaning |
|---|---|
| `main_equivalent` | the content is already on main |
| `unmerged_complete` | complete against the acceptance criteria, verified, not yet on main |
| `active` | valuable but incomplete |
| `conflicted` | cannot be integrated cleanly or needs a product decision |
| `stale` | no recent progress and does not match the issue |
| `unknown` | evidence incomplete or contradictory |

Main equivalence: ancestry (`git merge-base --is-ancestor`, `git branch --contains`, `git cherry`) misses
squash and rebase merges, so also accept a PR merged into main whose expected file and content changes are
on current main, with the issue ID in the PR or commits and no later revert. Stable patch IDs
(`git patch-id --stable`) are supporting evidence, not proof.

Linear state per issue: correct, should be Done, should be In Review, should be In Progress, should be
Blocked, or contradictory.

## Act

- `main_equivalent`: remove the worktree with `git worktree remove` once it has no uncommitted changes;
  delete the local branch once proven merged; delete remote branches only with explicit confirmation;
  never touch dependent stacked branches. Close the issue through `linear-implement` step 6.
- `unmerged_complete`: rebase onto main, rerun the checks, integrate or open a PR per the repository's
  policy with the issue ID in commits and the PR; move the issue to In Review unless it merged now.
- `active`: rebase when safe, keep the worktree and branch, move the issue to In Progress and leave the
  exact next steps in a comment.
- `conflicted`, `stale`, `unknown`: do not delete code, do not force-push, do not close; move the issue to
  Blocked with the evidence gap and the decision needed.
- Never use `rm -rf` on a worktree, never remove the current directory, honour worktree locks.
- CI failures: name the failing job and the cause class (code, test, environment, flaky) before deciding;
  a failed pipeline alone does not make work stale.

Each issue gets at most one comment ending in `<!-- linear-ai:reconciled -->` with the evidence and the
change made. If Linear write tools are unavailable, print the changes for the human.

## Report

Per item: the classification, the evidence, what was done, what is left, and the recommended next skill.
Stop and ask whenever an action would delete unproven work or change the main branch.
