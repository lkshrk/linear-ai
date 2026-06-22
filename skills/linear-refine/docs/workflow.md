# Workflow

## Ticket Reference Rule

Whenever an agent mentions a ticket that differs from the one it last spoke about, or switches focus to a different ticket, it must include a short content summary of that ticket. The summary always names the issue ID, the exact issue title, and a one-line description of what the issue is about, so the human always has context for which ticket is in play. This applies to queue summaries, per-issue dispatch, continuation prompts, and final summaries. Do not mention a ticket by ID alone when switching focus.

## Claim Lock Rule

Before an agent starts working an issue, it claims the issue by adding the `in-use` label. The agent removes `in-use` when it stops working the issue: on phase completion and handoff, block, failure, cancellation, or skip. Because `in-use` is outside the `llm-*` namespace, operations that "remove all `llm-*` labels" do not touch it; only an explicit claim release removes it, so every stop path that uses a bulk `llm-*` strip must also drop `in-use`.

Before picking or dispatching an issue, every agent checks for `in-use`. If the issue already carries `in-use` and the agent is not resuming its own claim, it treats the issue as claimed and skips it, recording the skip and observed Linear state drift. This prevents two agents from picking the same issue.

When Linear writes are unavailable, the claim and release are surfaced as `REQUIRED_LINEAR_MUTATIONS` rather than silently skipped.

Whenever an agent takes the lock it also writes a `linear-ai:claim` block to the issue description (`templates/linear-claim-block.md`) with `claimed_by` and an ISO 8601 `claimed_at`, and removes that block when releasing. The `in-use` label and the claim block are present together and absent together. `linear-status` uses this to detect orphaned locks: structural contradictions from labels alone (for example `in-use` on a Done issue or beside `llm-ready`/`llm-blocked`), and staleness when `now - claimed_at` exceeds the stale threshold (default 60 minutes). A stale or contradictory lock is repaired by removing `in-use` and the claim block.

## Labels

AI labels are the workflow state. Normal Linear statuses remain the human-visible work state. Product labels such as `Bug` and `Feature` classify the issue but do not drive the AI state machine.

Exactly one `llm-*` workflow state label may be present on an issue at a time. Applying a new `llm-*` state means removing the previous one. The `in-use` claim label is outside the `llm-*` namespace and coexists with the single state label.

- `bug` - issue is a bug report.
- `feature` - issue is a feature request or product enhancement.
- `llm-refine` - issue needs refinement by the questioner.
- `llm-ready` - newest marked plan is ready for implementation.
- `llm-active` - implementation agent is actively working.
- `llm-blocked` - implementation is blocked by questions or missing authority.
- `llm-review` - implementation is ready for human review.
- `llm-split` - issue was split into sub-issues.
- `in-use` - claim lock: an agent is currently working this issue. Not an `llm-*` workflow state; coexists with the state label.
- Closed issues have no `llm-*` workflow state label.

## Status Mapping

Recommended status transitions:

- `llm-refine` -> backlog or triage status.
- `llm-ready` -> ready status.
- `llm-active` -> In Progress.
- `llm-blocked` -> Blocked if the team uses that status; otherwise keep current status and rely on label.
- `llm-review` -> In Review.
- merged PR or verified squash/import release evidence -> Done through `linear-close` after merge or release file/content evidence, mainline, and CI evidence is verified. A closing magic word (`Fixes HCL-123`) on the merged PR or commit may move the issue to Done automatically; `linear-close` still runs to verify evidence, update the dashboard, post the closeout comment, and strip `llm-*` and `in-use`.

Labels and statuses can coexist. The label is the AI state machine. The status is the team planning signal.

## Intake Lifecycle

1. Human gives the issue-intake agent a rough bug or feature thought.
2. Issue-intake determines whether the issue is a bug, feature, or needs classification.
3. Issue-intake asks for missing required fields one question at a time.
4. Issue-intake drafts a Linear-ready issue using the bug or feature template.
5. Issue-intake routes the issue to the `Civora` Linear team.
6. Issue-intake applies or recommends the `bug` or `feature` label.
7. Issue-intake applies or recommends `llm-refine` when implementation planning is needed, removing any other `llm-*` state.

Issue-intake creates a good Linear issue. It does not create an implementation-ready plan. That remains the questioner's job.

## Refinement Lifecycle

1. Human or triage process labels an issue `llm-refine`.
2. Questioner reads the issue and relevant repo context.
3. Questioner interviews one question at a time.
4. Questioner writes or updates a marked plan comment.
5. When ready, all other `llm-*` states are removed and `llm-ready` is added.

An interview is finished only when all material questions are answered or the human explicitly decides to proceed with listed unknowns.

## Implementation Lifecycle

1. Orchestrator finds an issue with `llm-ready`.
2. Orchestrator reads the newest valid marked plan comment where `plan_status: ready`.
3. Orchestrator removes all other `llm-*` states, adds `llm-active`, claims the issue with `in-use` per the Claim Lock Rule, and moves the issue to In Progress.
4. Before changing code, implementer re-confirms no open questions remain (blocking with `llm-blocked` if any material question is unanswered) and decomposes the ready plan into independent parallel lanes, then works in the issue worktree at `<repo>/.worktrees/<issue-id>-<optional suffix>`, handing disjoint lanes to parallel subagents. Implementation never happens directly on a branch working tree, `main`, or `master`.
5. Implementer completes and verifies the ready plan in the issue worktree, runs the Mandatory Implementation Review Loop (parallel independent reviewers, fix-or-justify each finding documented in per-round summaries, maximum five review rounds unless the issue explicitly sets a different cap, then confidence and test-gap self-gates), then follows the default integration path: rebase onto the local main branch, squash to the minimal number of reviewable commits, and integrate into the local main branch. Feature branch or PR handoff is allowed only when the issue itself explicitly requires it.
6. Implementer treats a ticket as completed only when the code is in the main branch; an open PR is not sufficient. It does not infer exceptions from branch metadata, issue worktrees, draft PRs, or local convention.
7. Implementer posts marked status comments with completed work, verification, placeholders, batched questions, and the chosen `final_destination`.
8. If questions block further safe work, orchestrator removes all other `llm-*` states, adds `llm-blocked`, and releases the `in-use` claim.
9. Questioner resumes refinement and writes a new plan revision.
10. Orchestrator removes `llm-blocked`, adds `llm-active`, reclaims `in-use`, and requeues implementation when the newest plan revision resolves the blocker.
11. When complete and the destination is explicit, orchestrator removes all other `llm-*` states, adds `llm-review`, releases the `in-use` claim, moves the issue to In Review, and marks the PR ready only when the chosen destination includes a PR.

When a standalone lifecycle skill finishes its current phase, it asks whether there is anything else to add for that phase. If the answer is no, it asks whether the user wants to continue with the recommended next workflow skill, names that skill, and waits for confirmation instead of auto-running it. This standalone continuation prompt does not replace evidence gates, marked comments, dashboards, label/status mutations, or stop conditions.

## Closeout Lifecycle

1. Closer finds an issue with `llm-review` and a linked PR, direct issue-ID commit evidence, old implemented issue-ID evidence from a cross-team move, squash/import release file/content evidence, or review-ready status comment.
2. Closer verifies the linked PR is merged for PR-based closeout, or verifies direct commit evidence mentions the issue ID for commit-based closeout. If the current issue ID and implemented issue ID have different Linear team prefixes because the issue was moved to another team, closer verifies the old implemented ID according to the same rules and closes the current issue with a note naming both IDs.
3. For squash/import release closeout, closer verifies current main contains the expected file/content evidence and release/main CI passed.
4. Closer verifies mainline contains the merge commit, direct issue-ID commit, expected release file/content evidence, or equivalent remote evidence.
5. Closer verifies CI is complete and successful for the merged PR, merge commit, direct issue-ID commit, or release/main evidence.
6. Closer updates the issue description dashboard when a marked dashboard block is present.
7. Closer posts one final immutable closeout/status comment with merge or release evidence, CI evidence, dashboard evidence, and final mutations.
8. Closer moves the issue to `Done` (a no-op when a closing magic word already moved it there), removes all `llm-*` labels and the `in-use` claim, and preserves cumulative `sp-*` labels.

If merged PR or direct issue-ID commit evidence, moved old-ID implementation evidence, squash/import release file/content evidence, mainline evidence, or CI evidence is missing, closer must not move the issue to `Done`. It reports the missing evidence and leaves the issue in review state. If Linear writes are unavailable after evidence is proven, closer emits `REQUIRED_LINEAR_MUTATIONS` with the final closeout comment, dashboard update, `Done` status, and label cleanup.

## Review Lifecycle

1. Human runs `linear-review` against a target repo (whole repo) or a base ref/PR (diff).
2. The skill confirms kickoff choices: severity threshold, triage mode, handoff mode.
3. It dispatches parallel reviewer subagents — reasoning lanes (correctness, security, maintainability, performance, tests; spec in diff mode) and tool-backed lanes (dead-weight, dependency-health) — per `agents/reviewer.md`.
4. Findings are fingerprinted and deduped against the local `.linear-ai/review-ledger.yaml` and open Linear issues carrying the `linear-ai:review-finding` footer, then survivors are grouped by anchor (`file:symbol`) so the same code spot flagged by several lanes becomes one ticket rather than one per lane.
5. Survivors are triaged with the human. Default disposition is confidence-aware: high-confidence Critical/High and Medium findings default to a ticket; low-confidence and Low/NIT default to defer. Each chosen finding becomes a Linear issue at `llm-refine` with the finding footer, and its fingerprint is recorded `ticketed`. Explicitly ignored findings are recorded `ignored` and never resurface; deferred findings are not recorded and return next run.
6. In draft-only handoff the skill stops and recommends refinement; in draft + refine it chains into `linear-refine`.

Review creates issues that enter the normal Refinement -> Implementation -> Closeout lifecycle. It introduces no new `llm-*` state and takes no `in-use` claim.

## Plan Revision Rule

The newest valid marked plan comment wins.

A valid plan comment must contain:

- `<!-- linear-ai:plan v1 ... -->`
- fenced YAML matching the template
- Markdown sections that do not contradict the YAML
- `plan_status: ready` before implementation can start

If YAML and Markdown conflict, agents must stop and report a validation failure.

## Splitting Issues

The orchestrator may recommend splitting when an issue spans multiple repositories, independent deliverables, or parallelizable work. It must not create child issues until the human approves.

When split is approved:

- original issue becomes the parent tracking issue
- parent receives `llm-split`
- child issues receive compact marked plan comments
- ready children receive `llm-ready`
- unclear children receive `llm-refine`

Prefer one child issue per meaningful repo-owned deliverable. For tiny mechanical cross-repo changes, one issue with multiple PRs is acceptable.

## Repository Boundaries

Current Civora repositories:

- `spec` - durable workflow definitions, instance data, approved domain facts.
- `backend` - service, API, persistence, data behavior.
- `web` - user interface and frontend behavior.

Plans should name target repositories explicitly. If a repo is unknown, the questioner asks. Agents may infer candidate repositories from code inspection, but must label that as a recommendation, not a fact.

## PR Rules

Link work to Linear with a closing magic word plus the issue ID: in the PR description when the destination includes a PR (`Fixes HCL-123`, or `Fixes HCL-123, HCL-124` for multiple issues; magic words do not work in PR comments), or in the commit message body for direct-to-branch destinations. Linear then auto-links and moves the issue to In Progress on push/open and Done on merge to the default branch. The Conventional Commit subject keeps the `(HCL-123)` scope; the magic word drives the automation. Because Done can be reached automatically, `linear-close` reconciles an already-Done issue.

Draft PRs are allowed and expected for partial implementation.

An implementation PR may remain draft while:

- questions are unresolved
- checks fail due to incomplete agreed scope
- placeholders exist
- human review is not yet requested

A PR can be marked ready only when:

- all unambiguous checklist items are complete
- required tests/checks pass or gaps are explicitly accepted by the human
- unresolved questions are either gone or explicitly accepted as deferred scope
- placeholders are removed or explicitly accepted

## Blocking Rule

The implementer must stop and ask when continuing requires an assumption or when more work would create rework that is not cheap to fix later.

If an ambiguous item is isolated, the implementer skips that item and continues with other unambiguous checklist items.
