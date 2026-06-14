# Workflow

## Labels

AI labels are the workflow state. Normal Linear statuses remain the human-visible work state. Product labels such as `Bug` and `Feature` classify the issue but do not drive the AI state machine.

Exactly one `llm-*` workflow state label may be present on an issue at a time. Applying a new `llm-*` state means removing the previous one.

- `bug` - issue is a bug report.
- `feature` - issue is a feature request or product enhancement.
- `llm-refine` - issue needs refinement by the questioner.
- `llm-ready` - newest marked plan is ready for implementation.
- `llm-active` - implementation agent is actively working.
- `llm-blocked` - implementation is blocked by questions or missing authority.
- `llm-review` - implementation is ready for human review.
- `llm-split` - issue was split into sub-issues.
- Closed issues have no `llm-*` workflow state label.

## Status Mapping

Recommended status transitions:

- `llm-refine` -> backlog or triage status.
- `llm-ready` -> ready status.
- `llm-active` -> In Progress.
- `llm-blocked` -> Blocked if the team uses that status; otherwise keep current status and rely on label.
- `llm-review` -> In Review.
- merged PR -> Done through `linear-close` after merge, mainline, and CI evidence is verified.

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
3. Orchestrator removes all other `llm-*` states, adds `llm-active`, and moves the issue to In Progress.
4. Implementer works in an isolated issue worktree or equivalent isolated git worktree.
5. Implementer opens a draft PR as soon as useful implementation state exists.
6. Implementer posts marked status comments with completed work, verification, placeholders, and batched questions.
7. If questions block further safe work, orchestrator removes all other `llm-*` states and adds `llm-blocked`.
8. Questioner resumes refinement and writes a new plan revision.
9. Orchestrator removes `llm-blocked`, adds `llm-active`, and requeues implementation when the newest plan revision resolves the blocker.
10. When complete, orchestrator removes all other `llm-*` states, adds `llm-review`, moves the issue to In Review, and marks the PR ready.

When a standalone lifecycle skill finishes its current phase, it asks whether there is anything else to add for that phase. If the answer is no, it asks whether the user wants to continue with the recommended next workflow skill, names that skill, and waits for confirmation instead of auto-running it. This standalone continuation prompt does not replace evidence gates, marked comments, dashboards, label/status mutations, or stop conditions.

## Closeout Lifecycle

1. Closer finds an issue with `llm-review` and a linked PR, direct issue-ID commit evidence, old implemented issue-ID evidence from a cross-team move, or review-ready status comment.
2. Closer verifies the linked PR is merged for PR-based closeout, or verifies direct commit evidence mentions the issue ID for commit-based closeout. If the current issue ID and implemented issue ID have different Linear team prefixes because the issue was moved to another team, closer verifies the old implemented ID according to the same rules and closes the current issue with a note naming both IDs.
3. Closer verifies mainline contains the merge commit or direct issue-ID commit, either with local Git or reliable remote evidence.
4. Closer verifies CI is complete and successful for the merged PR, merge commit, or direct issue-ID commit.
5. Closer updates the issue description dashboard when a marked dashboard block is present.
6. Closer posts one final immutable closeout/status comment with merge evidence, CI evidence, dashboard evidence, and final mutations.
7. Closer moves the issue to `Done`, removes all `llm-*` labels, and preserves cumulative `sp-*` labels.

If merged PR or direct issue-ID commit evidence, moved old-ID implementation evidence, mainline evidence, or CI evidence is missing, closer must not move the issue to `Done`. It reports the missing evidence and leaves the issue in review state. If Linear writes are unavailable after evidence is proven, closer emits `REQUIRED_LINEAR_MUTATIONS` with the final closeout comment, dashboard update, `Done` status, and label cleanup.

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
