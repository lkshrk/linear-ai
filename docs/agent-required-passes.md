# Agent Required Passes

These passes are part of every Linear AI agent contract. They are local instructions, not optional external skills. If an external skill such as `grill-me` or `grill-with-docs` is available, use it; otherwise run the local pass here exactly.

## Completion Rule

An agent is not finished until it has either:

- performed the required Linear writes with Linear MCP tools, or
- printed the exact status changes, description, comments and PR actions a human has to apply.

Do not end with only "recommended next state" when the issue state needs to change.

## Mandatory Local Grill Pass

Use this pass before `linear-refine` moves an issue to Todo.

1. Restate the implementation goal in one sentence.
2. Identify every branch where product behavior, repository ownership, data shape, security posture, rollout, migration, tests, or reversibility could vary.
3. For each branch, answer from source material when possible.
4. If source material cannot answer it, ask one concrete question at a time and include the recommended answer.
5. Continue until every material branch is resolved, explicitly deferred, or listed as an accepted unknown.
6. Convert resolved decisions into the description: acceptance criteria, tests expected, verify commands, constraints and out-of-scope items.

Do not move the issue to Todo while any unresolved question remains unless it is recorded in `## Constraints` as `Accepted unknown: …`.

Material ambiguity = any branch where product behavior, UX, scope, or data semantics could plausibly vary between reasonable options. Fix-design choices with more than one plausible option are always material, even when code evidence favors one — present the evidence with the recommended answer rather than deciding. Only purely mechanical choices (naming, file placement, replicating an identical existing pattern) may be decided without asking; record the rejected alternatives in `## Constraints` or `## Out of scope`.

In batch/subagent mode, questions route through the orchestrator relay — do not downgrade them to autonomous decisions.

## Mandatory Implementation Review Loop

Run this loop when implementation looks complete and local verification passes, before integration (`linear-implement` step 5). It is part of finishing implementation, not an optional extra.

### Round

1. Freeze the current change set (diff against the base ref) and gather the inputs every reviewer needs: the changed files/diff, the issue description with its acceptance criteria, constraints and out-of-scope items, and the target repositories.
2. Dispatch independent review subagents in parallel. Each reviewer is read-only, sees the same inputs, shares no state with the others, owns exactly one lens, and returns structured findings. Always run these five lenses:
   - **General correctness** - design integrity, does the code do what the author intends, caller-visible edge cases (empty/null/boundary), async and shared-state safety, error propagation and fallbacks, API contracts, unnecessary complexity (YAGNI). Reference agent: `code-reviewer` / `ecc:code-reviewer`.
   - **Refactor / code-smell** - named smells (long method, large class, long parameter list, data clumps, duplication, dead code, speculative generality, feature envy, message chains). For each: name the smell category, cite the line range, and the concrete refactoring move. Suggestions only; no behavior change. Reference agent: `code-simplifier` / `ecc:code-simplifier` (run read-only).
   - **Bug hunter** - logic defects where an execution path produces a wrong result: off-by-one, coercion/comparison traps, null deref, inverted conditionals, state-machine violations, TOCTOU/races, resource leaks on error paths, implicit assumptions (sorted input, timezone, threading). Reference agent: `ecc:silent-failure-hunter` plus a general bug lens.
   - **Security** - taint paths from external input to sinks (SQL/shell/HTML/path/deserializer), broken access control and deny-by-default, authn/session, crypto primitives and secrets, new/unpinned dependencies, sensitive data in logs. OWASP Top 10 grounded. Reference agent: `security-reviewer` / `ecc:security-reviewer`.
   - **Spec / scope verifier** - first extract a numbered requirement list from the description's acceptance criteria, then mark each MET / NOT MET / PARTIALLY MET, and flag every diff behavior with no corresponding requirement as EXTRA (out-of-scope). Both under- and over-implementation are findings. Reference agent: `critic` as a final gate.
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

Every justification is documented, not just held in working memory: list each justified finding and its one-line rationale in the `<!-- linear-ai:handoff -->` or `<!-- linear-ai:closed -->` comment. If Linear writes are unavailable, include them in the printed changes.

### Convergence

After dispositioning, run another full round on the updated change set. Repeat until a round produces no new actionable finding (every finding is fixed or matches a recorded justification).

The loop has a maximum of five review rounds. Do not exceed five review rounds in one implementation attempt unless the issue itself contains an explicit stricter or broader review-loop rule. If rounds keep surfacing new actionable findings without converging by the cap, stop looping and move the issue to Blocked with the outstanding findings for human direction instead of looping forever or lowering the bar.

After each review round, give a round summary in the session. The round summary must include the round number, reviewers/lenses run, findings by severity, fixed findings, justified findings, deferred or blocked findings, verification rerun, and the next decision: continue another round, converged, or blocked at the cap.

### Self-Gates

When the loop has converged, run two self-checks before declaring implementation done:

- **Confidence** - state in one or two sentences the confidence that the change is correct and complete against the acceptance criteria, and why. If not confident, return to implementation and re-enter the loop.
- **Test gaps** - enumerate behaviors and edge cases implied by the acceptance criteria that are not covered by tests. If a material gap exists, add the tests and re-enter the loop. If a gap is intentionally left, list it as a placeholder or accepted gap.

Implementation is done only when the loop has converged and both self-gates pass. Record the review loop outcome (rounds, findings resolved or justified) in the handoff or closeout comment. Only then integrate.
