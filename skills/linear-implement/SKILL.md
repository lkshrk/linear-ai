---
name: linear-implement
description: "Implement a ready Linear issue end to end: claim it, work in an issue worktree, run bounded review rounds, integrate into main, verify the change is on main and close the issue. Use when an issue is in Todo with a valid description, or to finish an issue whose change was merged."
---

# Linear Implement

Read and follow `docs/workflow.md` (state, claiming, comments, implementation rules) and
`docs/agent-required-passes.md` (review lenses and self-gates).

Batch mode: when asked for several issues, discover Todo issues in scope (`docs/workflow.md` → Scope),
show the queue with ID and title, confirm it and the parallelism with the human, then run one issue per
isolated worktree. Never run two agents on the same issue.

## 1. Claim

1. Read the issue. If it is In Progress and was updated by someone else within the stale threshold, stop
   and report it as claimed. If it belongs to nightshift (`docs/workflow.md` → Nightshift coexistence),
   stop.
2. Save the description to a file and run `scripts/validate_issue.ts <file>` (add `--require-design` when
   the project uses design documents). If it fails, move the issue to Backlog with the problems as a
   comment and recommend `linear-refine`.
3. Set yourself as assignee (or the AI app as delegate) and move the issue to In Progress.

## 2. Gate

Before changing code, re-read the description and the code it names. If a material question is open, move
the issue to Blocked with one `<!-- linear-ai:blocked -->` comment that batches the questions and mentions
the human. Do not start with an open question.

## 3. Implement

- Work in `<repo>/.worktrees/<issue-id>[-suffix]`; create it from the up-to-date main branch.
- Run in auto mode: inspect, edit, test and verify without asking again. Ask or block only for
  destructive, irreversible, credential-gated, production-affecting, scope-changing or genuinely ambiguous
  steps.
- Split independent work (by repository, module, acceptance item or test surface) into parallel lanes,
  each in its own temporary worktree; merge lanes back only after reviewing their diff and rerunning the
  checks. Remove temporary worktrees afterwards.
- `## Files` is the expected touch set; touching other files is fine when needed, but say so in the
  handoff.
- Run every command in `## Verify` and the repository's own checks.

## 4. Review Rounds

When the change is complete and verification passes, run review rounds with independent reviewers
(general, refactor, bug hunter, security, scope against the description, plus language/area reviewers the
runtime has). Fix or justify every finding and rerun verification. At most five rounds unless the issue
says otherwise; after each round give a short summary (findings by severity, fixed, justified, open). If
the cap is reached without convergence, move the issue to Blocked with the open findings.

## 5. Integrate

The project's `ai-merge` label decides the destination (`docs/workflow.md` → Implementation Rules):
`manual` → PR, `auto` → merge to main once checks pass, `feature-branch` → `feature/<project>`.
Without the label: rebase onto the local main branch, squash to the minimal reviewable commits and
integrate into main; use a feature branch or PR only when the issue explicitly requires it. Ask the human
when the destination is unclear; never infer it from a branch name or an existing draft PR.

- Commit subjects use Conventional Commits with the issue ID as scope: `fix(ABC-123): …`.
- Link with a closing magic word: `Fixes ABC-123` in the commit body (direct to main) or in the PR
  description (PR destination).
- With a PR destination, move the issue to In Review and post `<!-- linear-ai:handoff -->` with the PR,
  the verification commands and their results. Closing happens in step 6 once the PR is merged.

## 6. Close

Close only when the change is on main. Capture evidence and verify it:

```sh
gh pr view <PR> --json url,state,isDraft,baseRefName,mergeCommit,statusCheckRollup,commits > pr.json
scripts/verify_closeout.ts --issue-id <ISSUE-ID> --pr pr.json --repo . --base origin/main
scripts/verify_closeout.ts --issue-id <ISSUE-ID> --commit commit.json --repo . --base origin/main
scripts/verify_closeout.ts --issue-id <ISSUE-ID> --release release.json --repo . --base origin/main
```

`commit.json` is `{ "oid", "subject", "statusCheckRollup": [...] }`; `release.json` lists
`statusCheckRollup` plus `files: [{ "path", "contains" }]` for squash or import releases. For an issue moved
to another team, add `--implemented-issue-id <OLD-ID>` and name both IDs in the closeout comment.

When the evidence passes, move the issue to Done (already Done through the magic word is expected), post
`<!-- linear-ai:closed -->` with the evidence, and remove the worktree. When it fails, keep the issue in In
Review and report what is missing.

## Sub-Issues

When the issue has a parent: moving the child to In Progress moves the parent to In Progress if it was
earlier; the parent is Done when every child is Done or Canceled.

## Without Linear Writes

If Linear write tools are unavailable, do not claim that anything changed in Linear. Print the exact
status changes and comments the human has to apply.

## Handoff

Finish with: current status, what changed, evidence (commands and results), anything missing or open, and
the recommended next skill. Ask whether the human wants to continue with it; do not run it automatically.

Scripts run with Bun directly or with `tsx` under Node.
