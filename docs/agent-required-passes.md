# Agent Required Passes

These passes are part of every Linear AI agent contract. They are local instructions, not optional external skills. If an external skill such as `grill-me` or `grill-with-docs` is available, use it; otherwise run the local pass here exactly.

## Completion Rule

An agent is not finished until it has either:

- performed the required Linear writes with Linear MCP tools, or
- emitted a `REQUIRED_LINEAR_MUTATIONS` block listing the exact labels, status, comments, and PR actions that a human or finalizer must apply.

Do not end with only "recommended next state" when the issue state needs to change.

## Mandatory Local Grill Pass

Use this pass before any questioner marks a plan `ready`.

1. Restate the implementation goal in one sentence.
2. Identify every branch where product behavior, repository ownership, data shape, security posture, rollout, migration, tests, or reversibility could vary.
3. For each branch, answer from source material when possible.
4. If source material cannot answer it, ask one concrete question at a time and include the recommended answer.
5. Continue until every material branch is resolved, explicitly deferred, or listed as an accepted unknown.
6. Convert resolved decisions into acceptance criteria, implementation checklist items, verification checks, and `do_not_assume` entries.

Do not set `plan_status: ready` while any unresolved question remains unless the same item is listed in `accepted_unknowns` and protected by `do_not_assume`.

## Mandatory Implementation Review Loop

Run this loop when implementation looks complete and local verification passes, before the Final Destination Gate and before applying `llm-review`. It is part of finishing implementation, not an optional extra.

### Round

1. Freeze the current change set (diff against the base ref) and gather the inputs every reviewer needs: the changed files/diff, the newest ready plan with its acceptance criteria and `do_not_assume` entries, and the target repositories.
2. Dispatch independent review subagents in parallel. Each reviewer is read-only, sees the same inputs, shares no state with the others, owns exactly one lens, and returns structured findings. Always run these five lenses:
   - **General correctness** - design integrity, does the code do what the author intends, caller-visible edge cases (empty/null/boundary), async and shared-state safety, error propagation and fallbacks, API contracts, unnecessary complexity (YAGNI). Reference agent: `code-reviewer` / `ecc:code-reviewer`.
   - **Refactor / code-smell** - named smells (long method, large class, long parameter list, data clumps, duplication, dead code, speculative generality, feature envy, message chains). For each: name the smell category, cite the line range, and the concrete refactoring move. Suggestions only; no behavior change. Reference agent: `code-simplifier` / `ecc:code-simplifier` (run read-only).
   - **Bug hunter** - logic defects where an execution path produces a wrong result: off-by-one, coercion/comparison traps, null deref, inverted conditionals, state-machine violations, TOCTOU/races, resource leaks on error paths, implicit assumptions (sorted input, timezone, threading). Reference agent: `ecc:silent-failure-hunter` plus a general bug lens.
   - **Security** - taint paths from external input to sinks (SQL/shell/HTML/path/deserializer), broken access control and deny-by-default, authn/session, crypto primitives and secrets, new/unpinned dependencies, sensitive data in logs. OWASP Top 10 grounded. Reference agent: `security-reviewer` / `ecc:security-reviewer`.
   - **Spec / scope verifier** - first extract a numbered requirement list from the ready plan's acceptance criteria, then mark each MET / NOT MET / PARTIALLY MET, and flag every diff behavior with no corresponding requirement as EXTRA (out-of-scope). Both under- and over-implementation are findings. Reference agent: `critic` as a final gate.
3. Also dispatch any specialized reviewer the runtime provides that matches the change's language, framework, or area (for example `ecc:typescript-reviewer`, `ecc:react-reviewer`, `ecc:go-reviewer`, `ecc:database-reviewer`). When no specialized agent exists, dispatch a generic reviewer with the matching role brief above and name the language/area in the prompt. Never skip a relevant lens just because a named agent is missing.
4. Each reviewer returns findings in this shape and does not edit code:

   ```text
   SEVERITY: CRITICAL | HIGH | MEDIUM | LOW | NIT
   LOCATION: <file>:<line-range>
   LENS: correctness | refactor | bug | security | spec
   PROBLEM: one sentence — what is wrong and why it matters
   EVIDENCE: the exact code span, or the execution path that triggers the failure
   RECOMMENDATION: concrete fix (CRITICAL/HIGH) or "fix or justify the trade-off" (MEDIUM/LOW)
   CONFIDENCE: HIGH | MEDIUM | LOW
   ```

### Finding Severity And Discipline

Severity ladder: **CRITICAL** (exploitable or data-loss), **HIGH** (definite bug/serious vuln that surfaces under realistic conditions), **MEDIUM** (likely defect or significant design problem), **LOW** (smell/maintainability debt), **NIT** (style, author's call). CRITICAL and HIGH block; MEDIUM and LOW are fix-or-justify; NIT is optional.

Every reviewer follows these rules:

- **Evidence gate** - no CRITICAL/HIGH finding without a cited line plus a named failure path (input -> state -> wrong outcome). Bug findings should name a failing test case; if none can be named, mark CONFIDENCE: LOW.
- **Confidence gate** - a LOW-confidence finding is surfaced for human attention but does not block convergence on its own.
- **Stay in lane** - report only your lens. If you spot a critical issue in another lens, emit one line `LENS:out-of-lane - <one sentence>` and stop; do not elaborate. This keeps the five reviewers non-overlapping.
- **Adversarial stance, no rubber-stamp** - assume at least one issue exists in your lens. Zero findings is an acceptable and expected outcome, but only with a short paragraph stating what you checked and why you are confident it is clean. A blank finding list with no reasoning is rejected.
- **No manufactured findings** - speculative "consider X" without a concrete failure mode, severity inflation, and style nits dressed as HIGH are the primary failure modes; do not produce them.

### Disposition

For every finding, the implementer either:

- **fixes** it, so the fix re-enters the next round's change set, or
- **justifies** why it is acceptable, recording a one-line rationale.

Track justifications in a ledger keyed by finding so a re-raised finding that was already justified is answered from the ledger instead of reopening it. A finding is never silently dropped.

Every justification is documented in the Linear issue, not just held in working memory: record each justified finding and its one-line rationale in the marked status comment (a `review_justifications` list, or `verification` entries naming the finding and why it is acceptable). If Linear writes are unavailable, include the justifications in the emitted `REQUIRED_LINEAR_MUTATIONS` status comment.

### Convergence

After dispositioning, run another full round on the updated change set. Repeat until a round produces no new actionable finding (every finding is fixed or matches a recorded justification).

Bound the loop. If rounds keep surfacing new actionable findings without converging (default cap: five rounds), stop looping and post a blocked status with the outstanding findings for human direction instead of looping forever or lowering the bar.

### Self-Gates

When the loop has converged, run two self-checks before declaring implementation done:

- **Confidence** - state in one or two sentences the confidence that the change is correct and complete against the acceptance criteria, and why. If not confident, return to implementation and re-enter the loop.
- **Test gaps** - enumerate behaviors and edge cases implied by the acceptance criteria that are not covered by tests. If a material gap exists, add the tests and re-enter the loop. If a gap is intentionally left, list it as a placeholder or accepted gap.

Implementation is done only when the loop has converged and both self-gates pass. Record the review loop outcome in the status comment `verification` entries (for example a `security review` check with `result: passed` and a reason summarizing findings resolved or justified). Only then proceed to the Final Destination Gate and the review-ready handoff.

## Linear Finalization Pass

Use this pass at the end of every agent run.

Exactly one `llm-*` workflow state label may be present on an issue at a time:

- `llm-refine`
- `llm-ready`
- `llm-active`
- `llm-blocked`
- `llm-review`
- `llm-split`

Whenever an agent adds one of these labels, it must remove every other `llm-*` workflow state label in the same finalization pass. Product/component labels such as `Bug`, `Feature`, `API`, or `Web` are independent and may coexist.

If Linear MCP write tools are available, apply the exact state changes after producing the marked comment or issue draft. If a write fails, report the failed write and emit `REQUIRED_LINEAR_MUTATIONS`.

If Linear MCP write tools are not available, emit:

```text
REQUIRED_LINEAR_MUTATIONS
- issue: TEAM-123
- add_labels: [...]
- remove_labels: [...]
- status: ...
- comment: plan | status | issue body | none
- pr_action: draft | ready | none
```

## Issue Intake State

When intake produces a clean issue draft:

- apply or emit product label `Bug` or `Feature` when classification is clear
- apply or emit `llm-refine` when implementation planning is needed
- when applying `llm-refine`, remove `llm-ready`, `llm-active`, `llm-blocked`, `llm-review`, and `llm-split`
- never apply `llm-ready`
- leave status in Backlog/Todo unless the human supplied another target status

## Questioner State

When the questioner produces a valid ready plan:

- create or update the marked plan comment
- add `llm-ready`
- remove `llm-refine`, `llm-active`, `llm-blocked`, `llm-review`, and `llm-split`
- move status to Todo/Ready when that status exists; otherwise leave the current status unchanged

When the plan is still blocked or draft:

- create or update the marked plan comment
- add `llm-refine`
- remove `llm-ready`, `llm-active`, `llm-blocked`, `llm-review`, and `llm-split`
- do not add `llm-ready`

## Implementer State

When implementation starts from a ready plan:

- add `llm-active`
- remove `llm-refine`, `llm-ready`, `llm-blocked`, `llm-review`, and `llm-split`
- move status to In Progress

When blocked by questions:

- add `llm-blocked`
- remove `llm-refine`, `llm-ready`, `llm-active`, `llm-review`, and `llm-split`
- create the marked status comment with batched questions
- do not add `llm-review`

When blockers are resolved and implementation can resume:

- add `llm-active`
- remove `llm-refine`, `llm-ready`, `llm-blocked`, `llm-review`, and `llm-split`

When implementation is review-ready:

- create the marked status comment
- add `llm-review`
- remove `llm-refine`, `llm-ready`, `llm-active`, `llm-blocked`, and `llm-split`
- move status to In Review
- mark the draft PR ready only when tests/checks and placeholders satisfy the implementer contract

## Orchestrator State

The orchestrator remains the deterministic fallback and repair agent. It must apply or emit the same finalization mutations and must never silently continue past invalid marked comments.
