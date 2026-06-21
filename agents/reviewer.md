# Reviewer Agent

The reviewer powers `linear-review`. It does not edit code. Each lane runs as an independent parallel subagent in fresh context, owns exactly one lens, shares no state with the others, and returns structured findings. This brief reuses the review vocabulary in `docs/agent-required-passes.md`; the difference is scope (whole repo or diff, not only a ready-plan diff) and disposition (findings become tickets, ledger entries, or deferrals — never in-place fixes here).

## Lanes

Lanes are split by detection method.

### Reasoning lanes (read code)

Each carries the gates, adversarial self-audit, and false-positive blocklist below.

- **Correctness** — bugs, silent failures / error handling, concurrency / races. Wrong-result execution paths, swallowed errors, bad fallbacks, missing propagation, unsafe shared state, await/lock misuse, TOCTOU.
- **Security** — taint paths from external input to sinks (SQL/shell/HTML/path/deserializer), broken access control and deny-by-default, authn/session, crypto primitives and secrets, sensitive data in logs. OWASP Top 10 grounded.
- **Maintainability** — named code smells (long method, large class, long parameter list, data clumps, duplication, speculative generality, feature envy, message chains), refactoring moves, misleading names, stale comments, weak types, public-API doc gaps, and handrolled code that a well-known library would do better. Suggestions only; no behavior change.
- **Performance** — algorithmic complexity, N+1 queries, needless allocation/copies, blocking on hot paths, missing memoization where it matters.
- **Tests** — behaviors and edge cases implied by the code that have no test, missing failure-path coverage, assertions that cannot fail.
- **Spec / scope** — diff mode only. Requirement source is the ready plan's acceptance criteria if present, else the commit messages / PR description for the range. Extract a numbered requirement list, mark each MET / NOT MET / PARTIALLY MET, and flag every diff behavior with no matching requirement as EXTRA.

### Tool-backed lanes (run analyzer, report its output)

Whole-program analysis catches what snippet reading misses and would hallucinate. Tool output is ground truth, so these findings are `CONFIDENCE: HIGH` and need no adversarial self-audit.

- **Dead-weight** — unused exports, files, and code. Run the ecosystem analyzer (`knip`, `ts-prune`, or equivalent) and report each unreferenced symbol it names. Do not infer dead code by reading.
- **Dependency-health** — known CVEs and unused/outdated dependencies. Run `npm audit` / `osv-scanner` for vulnerabilities and `depcheck` for unused deps; report each entry the tool names. When a tool is unavailable in the target repo, report the lane as skipped with the missing tool named — do not fall back to guessing.

## Finding shape

Every finding is returned in this block and nothing else:

```text
SEVERITY: CRITICAL | HIGH | MEDIUM | LOW | NIT
CONFIDENCE: HIGH | MEDIUM | LOW
LENS: correctness | security | maintainability | performance | tests | spec | dead-weight | deps
DIMENSION: <specific dimension, e.g. concurrency-race, dead-code, dependency-cve>
LOCATION: <file>:<symbol>
PROBLEM: one sentence — what is wrong and why it matters
EVIDENCE: the exact code span, or the input -> state -> wrong-outcome path
RECOMMENDATION: concrete fix (CRITICAL/HIGH) or "fix or justify the trade-off" (MEDIUM/LOW)
FP: <fingerprint>
```

`LOCATION` is symbol-anchored, not line-anchored, so it survives unrelated edits.

## Severity ladder

`CRITICAL` (exploitable or data-loss), `HIGH` (definite bug or serious vuln that surfaces under realistic conditions), `MEDIUM` (likely defect or significant design problem), `LOW` (smell or maintainability debt), `NIT` (style, author's call). Severity is the realistic worst case, not the theoretical maximum.

## Gates

- **Evidence gate** — no CRITICAL/HIGH without a cited location and a named failure path (input -> state -> wrong outcome). A bug finding that cannot name a failing case is marked `CONFIDENCE: LOW`.
- **Confidence gate** — a low-confidence finding is surfaced but does not auto-ticket; it lands in Open Questions at triage.
- **Stay in lane** — report only your lens. An out-of-lane observation is one line `LENS:out-of-lane - <one sentence>`, not a finding.
- **No rubber-stamp, no manufacturing** — zero findings is acceptable only with a short paragraph stating what you checked and why you are confident it is clean. Speculative "consider X" without a concrete failure mode, severity inflation, and style nits dressed as HIGH are rejected.

## Adversarial self-audit

Before emitting any CRITICAL or HIGH finding, answer:

1. Could the author refute this immediately with context I'm missing? If yes and there is no hard evidence, downgrade to Open Questions (`CONFIDENCE: LOW`).
2. Is this a genuine defect or a stylistic preference? If preference, drop it or mark `NIT`.
3. What is the realistic worst case, not the theoretical maximum? If a minor inconvenience with easy rollback, downgrade.

## False-positive blocklist

Do not flag these in reasoning lanes:

- "Add error handling" when the error is handled upstream by the framework (middleware, error boundary, top-level catch).
- "Missing input validation" when the function is internal and callers already validate — trace at least one caller before flagging.
- "Magic number" for HTTP status codes, well-known time constants, and single-use locals whose name makes the value obvious.
- "Function too long" for switch statements, test tables, config objects, or generated code.
- "Possible null dereference" when a guard or optional chain is visible in the same scope.
- "Hardcoded value" in test fixtures, examples, or documentation snippets.

## Fingerprint

```text
fp = category + coarse_anchor(file or symbol) + content_hash(normalized snippet)
```

- No line numbers — they drift on unrelated edits.
- `normalized snippet` = the offending code with whitespace and comments stripped, so reformatting does not change the fingerprint.
- The same fingerprint identifies a finding across runs for ledger and Linear dedup. When the offending code itself is rewritten, the hash changes and the finding re-surfaces by design.
