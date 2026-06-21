# Linear Review Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `linear-review` skill that fans out parallel reviewer subagents across a target repo or diff, dedups findings against a persistent ledger and Linear, and triages survivors into Linear tickets that enter the existing refine→implement→close funnel.

**Architecture:** This repo ships Claude/Codex *skills* — markdown SKILL.md files that reference `agents/*.md` briefs and `docs/*.md` operational docs, plus YAML schemas and templates validated by Bun/TS scripts. `linear-review` reuses the review vocabulary already in `docs/agent-required-passes.md`. New runtime-verifiable surface is one standalone YAML ledger validated by a new script + Bun test. Everything else is authored markdown verified by the existing skills smoke test and assertion checks.

**Tech Stack:** Bun (test + scripts), TypeScript, Ajv2020 JSON-schema validation, `yaml`, the `skills` npm CLI, Linear MCP.

## Global Constraints

- Plugin version stays `1.2.0` for this work; release bump is a separate step, not part of this plan.
- Exactly one `llm-*` workflow state label per issue (`docs/agent-required-passes.md`). Review-created issues use `llm-refine`; no new `llm-*` state is introduced.
- The ledger lives at `.linear-ai/review-ledger.yaml` in the **target** repo and is gitignored there — local-only, per-clone. Linear footer search is the only cross-machine dedup.
- Severity ladder is the repo's five levels: `CRITICAL | HIGH | MEDIUM | LOW | NIT`. Severity is realistic worst case, not theoretical maximum.
- Code comments: write almost none. No banner/section/step comments in scripts; a one-line `why` only when non-obvious.
- Source spec: `docs/superpowers/specs/2026-06-21-linear-review-design.md`.

---

## File Structure

- `schemas/linear-ai.review-ledger.v1.schema.yaml` — JSON-schema for the standalone ledger file.
- `scripts/validate_review_ledger.ts` — loads a ledger YAML, validates against the schema; exports `validateReviewLedger`.
- `examples/review-ledger.yaml` — valid ledger fixture (used by `validate:ledger` and the test).
- `test/fixtures/review-ledger-bad.yaml` — invalid fixture (ticketed entry missing issue id).
- `test/review_ledger.test.ts` — Bun test: good fixture passes, bad fixture rejects.
- `templates/linear-review-finding-footer.md` — the single-line dedup footer + its rules.
- `agents/reviewer.md` — per-lane reviewer briefs, finding shape, gates, FP blocklist, fingerprint algorithm.
- `docs/reviewer.md` — orchestration: scope, kickoff, pipeline, dedup, ledger spec, triage, ticket creation, handoff, edge handling, Linear MCP contract.
- `skills/linear-review/SKILL.md` — the skill entrypoint, mirrors `skills/linear-refine/SKILL.md`.
- `.claude-plugin/plugin.json` — add the skill to the `skills` array.
- `scripts/skills_smoke.ts` — add `linear-review` assertions + list entry.
- `README.md` — add the skill to the skill list.
- `docs/workflow.md` — add a "Review Lifecycle" section.
- `package.json` — add a `validate:ledger` script.

---

### Task 1: Ledger schema, validator, and Bun test

**Files:**
- Create: `schemas/linear-ai.review-ledger.v1.schema.yaml`
- Create: `scripts/validate_review_ledger.ts`
- Create: `examples/review-ledger.yaml`
- Create: `test/fixtures/review-ledger-bad.yaml`
- Test: `test/review_ledger.test.ts`
- Modify: `package.json` (scripts block)

**Interfaces:**
- Produces: `validateReviewLedger(filePath: string): Promise<void>` — resolves on valid ledger, rejects with `Error` whose message starts `review-ledger invalid:` otherwise. Ledger shape: `{ schema: "linear-ai.review-ledger.v1", entries: Entry[] }`, `Entry = { fp, state: "ignored"|"ticketed", category, anchor, issue?: string|null, reason?, recorded_at }`, where `state: ticketed` requires a non-empty string `issue`.

- [ ] **Step 1: Write the failing test**

Create `test/review_ledger.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import path from "node:path";
import { validateReviewLedger } from "../scripts/validate_review_ledger";

const ROOT = path.resolve(import.meta.dir, "..");

describe("review ledger schema", () => {
  test("valid example passes", async () => {
    await expect(
      validateReviewLedger(path.join(ROOT, "examples/review-ledger.yaml"))
    ).resolves.toBeUndefined();
  });

  test("ticketed entry without issue id fails", async () => {
    await expect(
      validateReviewLedger(path.join(ROOT, "test/fixtures/review-ledger-bad.yaml"))
    ).rejects.toThrow(/review-ledger invalid/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test test/review_ledger.test.ts`
Expected: FAIL — cannot resolve `../scripts/validate_review_ledger` (module does not exist yet).

- [ ] **Step 3: Create the schema**

Create `schemas/linear-ai.review-ledger.v1.schema.yaml`:

```yaml
$schema: https://json-schema.org/draft/2020-12/schema
$id: linear-ai.review-ledger.v1
title: Linear AI Review Ledger
# Standalone gitignored file in the target repo. One entry per finding fingerprint.
type: object
additionalProperties: false
required:
  - schema
  - entries
properties:
  schema:
    const: linear-ai.review-ledger.v1
  entries:
    type: array
    items:
      type: object
      additionalProperties: false
      required:
        - fp
        - state
        - category
        - anchor
        - recorded_at
      properties:
        fp:
          type: string
          minLength: 1
        state:
          enum: [ignored, ticketed]
        category:
          type: string
          minLength: 1
        anchor:
          type: string
          minLength: 1
        issue:
          type: [string, "null"]
        reason:
          type: string
        recorded_at:
          # ISO 8601 timestamp the entry was recorded.
          type: string
          minLength: 1
      allOf:
        # A ticketed finding must carry the created issue id.
        - if:
            properties:
              state:
                const: ticketed
          then:
            required: [issue]
            properties:
              issue:
                type: string
                minLength: 1
```

- [ ] **Step 4: Create the validator script**

Create `scripts/validate_review_ledger.ts`:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import YAML from "yaml";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCHEMA_FILE = "linear-ai.review-ledger.v1.schema.yaml";

export async function validateReviewLedger(filePath: string): Promise<void> {
  const ajv = new Ajv2020({ allErrors: true });
  const schema = YAML.parse(await readFile(path.join(ROOT, "schemas", SCHEMA_FILE), "utf8"));
  const validate = ajv.compile(schema);
  const data = YAML.parse(await readFile(filePath, "utf8"));
  if (!validate(data)) {
    const detail = (validate.errors ?? [])
      .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
      .join("; ");
    throw new Error(`review-ledger invalid: ${detail}`);
  }
}

if (import.meta.main) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    process.stderr.write("usage: bun scripts/validate_review_ledger.ts FILE [FILE...]\n");
    process.exit(1);
  }
  try {
    for (const file of files) await validateReviewLedger(file);
    process.stdout.write(`ok review-ledger (${files.length})\n`);
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(1);
  }
}
```

- [ ] **Step 5: Create the valid example fixture**

Create `examples/review-ledger.yaml`:

```yaml
schema: linear-ai.review-ledger.v1
entries:
  - fp: "smell:src/auth/token.ts:verify:d4e5f6"
    state: ignored
    category: code-smell
    anchor: "src/auth/token.ts:verify"
    issue: null
    reason: "perf hot path, readability traded knowingly"
    recorded_at: "2026-06-21T14:32:00Z"
  - fp: "security:src/db/query.ts:run:a1b2c3"
    state: ticketed
    category: security
    anchor: "src/db/query.ts:run"
    issue: HCL-123
    reason: ""
    recorded_at: "2026-06-21T14:35:00Z"
```

- [ ] **Step 6: Create the invalid fixture**

Create `test/fixtures/review-ledger-bad.yaml`:

```yaml
schema: linear-ai.review-ledger.v1
entries:
  - fp: "security:src/db/query.ts:run:a1b2c3"
    state: ticketed
    category: security
    anchor: "src/db/query.ts:run"
    issue: null
    recorded_at: "2026-06-21T14:35:00Z"
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `bun test test/review_ledger.test.ts`
Expected: PASS — both tests green.

- [ ] **Step 8: Add the package.json script**

In `package.json` `scripts`, add after the `validate:node` line:

```json
    "validate:ledger": "bun scripts/validate_review_ledger.ts examples/review-ledger.yaml",
```

- [ ] **Step 9: Run the new script directly**

Run: `bun run validate:ledger`
Expected: `ok review-ledger (1)`

- [ ] **Step 10: Commit**

```bash
git add schemas/linear-ai.review-ledger.v1.schema.yaml scripts/validate_review_ledger.ts examples/review-ledger.yaml test/fixtures/review-ledger-bad.yaml test/review_ledger.test.ts package.json
git commit -m "feat(review): add review-ledger schema, validator, and test"
```

---

### Task 2: Finding-footer template

**Files:**
- Create: `templates/linear-review-finding-footer.md`

**Interfaces:**
- Produces: the dedup marker format `<!-- linear-ai:review-finding fp=<fp> dimension=<dimension> -->` consumed by the SKILL dedup step and `docs/reviewer.md`.

- [ ] **Step 1: Write the template**

Create `templates/linear-review-finding-footer.md`:

````markdown
# Linear AI Review Finding Footer

Append this single-line marker to the description of every Linear issue created from a review finding. It is the dedup key: before proposing a finding, `linear-review` searches Linear for an open issue whose description carries the same `fp`.

```text
<!-- linear-ai:review-finding fp=security:src/db/query.ts:run:a1b2c3 dimension=security -->
```

## Rules

- One footer per review-created issue.
- `fp` is the finding fingerprint (see `docs/reviewer.md`): `category:anchor:snippet-hash`, never line-anchored.
- `dimension` is the specific dimension, for example `concurrency-race`, `dead-code`, or `dependency-cve`.
- The footer is a single HTML comment, not a fenced YAML block. It is not schema-validated, only string-matched for dedup.
- Never remove the footer; it is the dedup key for the issue's lifetime.
````

- [ ] **Step 2: Verify the marker is present**

Run: `grep -c "linear-ai:review-finding fp=" templates/linear-review-finding-footer.md`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add templates/linear-review-finding-footer.md
git commit -m "feat(review): add review finding footer template"
```

---

### Task 3: Reviewer agent brief

**Files:**
- Create: `agents/reviewer.md`

**Interfaces:**
- Consumes: severity ladder, finding shape, and gates from `docs/agent-required-passes.md`.
- Produces: the per-lane reviewer contract and the finding block (`SEVERITY/CONFIDENCE/LENS/DIMENSION/LOCATION/PROBLEM/EVIDENCE/RECOMMENDATION/FP`) consumed by `docs/reviewer.md` and `skills/linear-review/SKILL.md`.

- [ ] **Step 1: Write the agent brief**

Create `agents/reviewer.md` with exactly this content:

````markdown
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
- **Spec / scope** — diff mode only, when a ready plan exists. Extract a numbered requirement list from the plan's acceptance criteria, mark each MET / NOT MET / PARTIALLY MET, and flag every diff behavior with no matching requirement as EXTRA.

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
````

- [ ] **Step 2: Verify the key anchors are present**

Run: `grep -cE "Reasoning lanes|Tool-backed lanes|Adversarial self-audit|False-positive blocklist|fp = category" agents/reviewer.md`
Expected: `5`

- [ ] **Step 3: Commit**

```bash
git add agents/reviewer.md
git commit -m "feat(review): add reviewer agent brief"
```

---

### Task 4: Reviewer orchestration doc

**Files:**
- Create: `docs/reviewer.md`

**Interfaces:**
- Consumes: the finding shape and lanes from `agents/reviewer.md`; the ledger schema from Task 1; the footer from Task 2.
- Produces: the pipeline, dedup, triage matrix, and handoff rules referenced by `skills/linear-review/SKILL.md`.

- [ ] **Step 1: Write the orchestration doc**

Create `docs/reviewer.md` with exactly this content:

````markdown
# Reviewer

`linear-review` runs the reviewer lanes in `agents/reviewer.md`, dedups findings, and turns survivors into Linear tickets. It runs against a target repository under review, not the linear-ai tooling repo.

## Invocation and scope

- No argument reviews the whole target repository.
- An argument naming a base ref, PR, or `HEAD~n` reviews only changed code against that base.
- Optional `--min=<severity>` surfaces only findings at or above that severity; the rest are auto-deferred (not ignored — they return next run).

## Kickoff choices

Confirm before fanning out, each with a recommended default:

1. Scope — whole-repo or diff, from the argument.
2. Severity threshold — `--min`, default none.
3. Triage mode — Hybrid (default), Bulk table, or One at a time.
4. Handoff mode — Draft only (default), or Draft + refine.

## Pipeline

```text
scope resolve
  -> fan-out (parallel review lanes, agents/reviewer.md)
  -> collect + normalize findings
  -> fingerprint
  -> dedup (drop ledger-ignored, ledger-ticketed, live Linear footer matches)
  -> severity rank
  -> triage (chosen mode)
  -> write (Linear tickets + ledger entries)
  -> standalone continuation prompt
```

Lanes are dispatched as independent parallel subagents in a single batch and collected when all return: in whole-repo mode, five reasoning lanes (correctness, security, maintainability, performance, tests) plus two tool-backed lanes (dead-weight, dependency-health); in diff mode with a ready plan, add the Spec lane.

## Fingerprint and ledger

The ledger is a single gitignored file in the target repo: `.linear-ai/review-ledger.yaml`, matching `schemas/linear-ai.review-ledger.v1.schema.yaml`. It holds both `ignored` and `ticketed` states.

```yaml
schema: linear-ai.review-ledger.v1
entries:
  - fp: "smell:src/auth/token.ts:verify:d4e5f6"
    state: ignored          # ignored | ticketed
    category: code-smell
    anchor: "src/auth/token.ts:verify"
    issue: null             # set to the issue id when state is ticketed
    reason: "perf hot path, readability traded knowingly"
    recorded_at: "2026-06-21T14:32:00Z"
```

The fingerprint algorithm is defined in `agents/reviewer.md`: `category + coarse_anchor + content_hash(normalized snippet)`, never line-anchored.

The ledger is local-only and per-clone. A fresh clone or CI re-surfaces findings once; Linear footer search is the only cross-machine dedup. This is the accepted trade for keeping ignore decisions out of version control.

## Dedup sources

- ledger `ignored` -> never re-proposed.
- ledger `ticketed` -> local dedup.
- live Linear search for an open issue carrying the `linear-ai:review-finding` footer with the same `fp` -> cross-machine backstop, so a fresh clone or a second developer does not double-file.
- `defer` at triage -> not written to the ledger; re-surfaces next run.

Report the dedup counts (how many findings were dropped as ignored vs already ticketed) so each run is auditable.

## Triage

Triage mode controls presentation; severity and confidence control ordering and default disposition.

- Hybrid (default) — severity-ranked table; "tell me more about #N" drills into a finding before deciding.
- Bulk table — mark each finding ticket / ignore / defer in one pass.
- One at a time — each finding discussed individually.

A low-confidence CRITICAL/HIGH does not auto-ticket; it lands in an Open Questions group.

| Tier | High confidence | Low confidence |
| --- | --- | --- |
| Critical / High | ticket | Open Questions (defer) |
| Medium | defer | defer |
| Low / NIT | defer | defer |

`ignore` is never a default. It is a durable human statement and only ever the result of an explicit choice, so the ledger gains `ignored` entries by deliberate action, never by a default sweep. The user may accept-all-defaults in one keystroke or override per finding.

## Ticket creation

Each chosen finding becomes a Linear issue following `linear-create-issue` conventions:

- `bug` label for bugs, security, and silent-failure findings; otherwise the feature/tech-debt template.
- `llm-refine`, removing any other `llm-*` state per `docs/agent-required-passes.md`.
- The `linear-ai:review-finding` footer (`templates/linear-review-finding-footer.md`) appended to the description for live dedup.
- Default one ticket per finding; offer to group near-duplicate findings into a single ticket.

When ticketed, write the fingerprint to the ledger with `state: ticketed` and the issue id. When ignored, write `state: ignored` with the user's reason. Deferred findings are not written.

## Handoff

- Draft only — tickets land at `llm-refine`; stop and recommend `linear-refine` or `linear-batch-refine`.
- Draft + refine — chain directly into `linear-refine` (or `linear-batch-refine` for several) on the created tickets, carrying each finding's evidence and suggested fix as refinement context.

## Edge handling

- No claim lock — review is repo-wide, not scoped to one issue, so it takes no `in-use` claim. Created tickets follow the normal Claim Lock Rule afterward.
- Linear writes unavailable — emit `REQUIRED_LINEAR_MUTATIONS` with the exact issue bodies, labels, and footers; still write the local ledger.
- Clean review — report "no new findings" plus dedup counts.

## Linear MCP contract

Use these Linear MCP tools when available:

- `list_issues` / `search_documentation` — find open issues carrying a `linear-ai:review-finding` footer for dedup.
- `save_issue` — create the finding issue, apply labels, append the footer.
- `list_comments` — read existing marked comments when chaining into refinement.

If Linear MCP write tools are unavailable, do not claim issues were created. Emit `REQUIRED_LINEAR_MUTATIONS` and still write the local ledger.
````

- [ ] **Step 2: Verify the key anchors are present**

Run: `for p in "Kickoff choices" "Dedup sources" "Open Questions" "is never a default" "REQUIRED_LINEAR_MUTATIONS"; do grep -q "$p" docs/reviewer.md && echo "ok: $p" || echo "MISSING: $p"; done`
Expected: five `ok:` lines, no `MISSING:`.

- [ ] **Step 3: Commit**

```bash
git add docs/reviewer.md
git commit -m "feat(review): add reviewer orchestration doc"
```

---

### Task 5: The linear-review skill

**Files:**
- Create: `skills/linear-review/SKILL.md`

**Interfaces:**
- Consumes: `agents/reviewer.md`, `docs/reviewer.md`, the footer template, the ledger schema.
- Produces: the skill entrypoint whose `name: linear-review` frontmatter and key phrases are asserted by `scripts/skills_smoke.ts` in Task 6.

- [ ] **Step 1: Write the SKILL.md**

Create `skills/linear-review/SKILL.md` with exactly this content:

````markdown
---
name: linear-review
description: "Run parallel reviewer subagents across a target repo or diff to surface findings across correctness, security, maintainability, performance, tests, dead code, and dependency health, dedup them against a persistent ledger and Linear, then triage survivors into Linear tickets. Use when the user wants a code review, repo health audit, or to turn review findings into tickets."
---

# Linear Review

Use the repository root as the workflow source. Read and follow:

- `agents/reviewer.md`
- `docs/reviewer.md`
- `docs/agent-required-passes.md`
- `docs/workflow.md`
- `templates/linear-review-finding-footer.md`
- `schemas/linear-ai.review-ledger.v1.schema.yaml`
- `templates/linear-bug-issue.md`
- `templates/linear-feature-issue.md`

## Scope

No argument reviews the whole target repository. An argument naming a base ref, PR, or `HEAD~n` reviews only the changed code against that base.

## Kickoff Choices

Confirm before fanning out, each with a recommended default: the severity threshold (`--min`, default none), the triage mode (Hybrid default, Bulk table, or One at a time), and the handoff mode (Draft only default, or Draft + refine).

## Review Fan-Out

Dispatch the review lanes as independent parallel subagents per `agents/reviewer.md`: five reasoning lanes (correctness, security, maintainability, performance, tests), the Spec lane only in diff mode with a ready plan, and two tool-backed lanes (dead-weight, dependency-health). Each reviewer is read-only, owns one lens, shares no state, and returns findings in the shape defined in `agents/reviewer.md`.

## Dedup

Fingerprint every finding per `docs/reviewer.md`. Drop findings whose fingerprint is recorded `ignored` or `ticketed` in `.linear-ai/review-ledger.yaml`, and findings whose fingerprint matches an open Linear issue carrying the `linear-ai:review-finding` footer. Report the dedup counts.

## Triage And Tickets

Present survivors in the chosen triage mode, grouped by severity with the confidence-aware defaults in `docs/reviewer.md`. Create a Linear issue for each chosen finding through `linear-create-issue` conventions: apply `bug` for bug, security, and silent-failure findings and the feature template otherwise, add `llm-refine`, append the `linear-ai:review-finding` footer, and record the fingerprint to the ledger as `ticketed` with the issue id. Write `ignored` ledger entries only for findings the user explicitly ignores. Deferred findings are not written.

## Claim Lock

`linear-review` is repo-wide and takes no `in-use` claim. Tickets it creates follow the normal Claim Lock Rule afterward.

## Linear MCP Contract

Use `list_issues` / `search_documentation` to find open issues carrying the `linear-ai:review-finding` footer for dedup, `save_issue` to create the finding issue and append the footer, and `list_comments` when chaining into refinement. If Linear MCP write tools are unavailable, do not claim issues were created; emit `REQUIRED_LINEAR_MUTATIONS` with the exact issue bodies, labels, and footers, and still write the local ledger.

## Step Completion Handoff

In draft-only handoff, stop after creating tickets and recommend `linear-refine` or `linear-batch-refine`. In draft + refine, chain into `linear-refine` (or `linear-batch-refine`) on the created tickets, carrying each finding's evidence and suggested fix as refinement context.

When the review step completes, report what changed, the dedup counts, tickets created, ledger writes, current Linear labels/status, and the recommended next step. Ask if there is anything else to add for this review step. If no, name the recommended next skill and wait for confirmation; do not auto-run it.
````

- [ ] **Step 2: Verify the frontmatter and a key phrase**

Run: `grep -cE "^name: linear-review$|Dispatch the review lanes as independent parallel subagents" skills/linear-review/SKILL.md`
Expected: `2`

- [ ] **Step 3: Commit**

```bash
git add skills/linear-review/SKILL.md
git commit -m "feat(review): add linear-review skill"
```

---

### Task 6: Register the skill

**Files:**
- Modify: `.claude-plugin/plugin.json` (skills array)
- Modify: `scripts/skills_smoke.ts` (assertions + list loop)
- Modify: `README.md` (skill list)

**Interfaces:**
- Consumes: `skills/linear-review/SKILL.md` from Task 5.
- Produces: skill registration so `npx skills add --list` and the smoke test recognize `linear-review`. (`.codex-plugin/plugin.json` uses a `./skills/` directory glob and needs no edit.)

- [ ] **Step 1: Add to the Claude plugin manifest**

In `.claude-plugin/plugin.json`, add `"./skills/linear-review"` as the last entry of the `skills` array (after `"./skills/linear-doctor"`). Add a comma to the previous line.

- [ ] **Step 2: Add the smoke assertion**

In `scripts/skills_smoke.ts`, inside `main()` after the existing `assertContains(... "docs/implementer.md" ...)` assertions and before the `const listOutput = ...` line, add:

```ts
    await assertContains(path.join(ROOT, "skills/linear-review/SKILL.md"), "name: linear-review");
    await assertContains(path.join(ROOT, "skills/linear-review/SKILL.md"), "Dispatch the review lanes as independent parallel subagents");
```

- [ ] **Step 3: Add to the smoke skill list**

In the same file, in the `for (const skill of [ ... ])` array, add `"linear-review",` as a new entry after `"linear-doctor"`.

- [ ] **Step 4: Add to the README skill list**

In `README.md`, in the skill list near the `linear-doctor` line, add:

```markdown
- `linear-review` - run parallel reviewers, dedup findings, and turn survivors into Linear tickets.
```

- [ ] **Step 5: Verify the skill is listed**

Run: `bun run skills:smoke`
Expected: ends with `ok skills smoke (npx skills add/use, codex, claude-code)`. (Requires network for `npx skills`. If offline, instead run `npx -y skills add . --list` is skipped; verify manually with `grep -n "linear-review" .claude-plugin/plugin.json scripts/skills_smoke.ts README.md` returning three hits.)

- [ ] **Step 6: Commit**

```bash
git add .claude-plugin/plugin.json scripts/skills_smoke.ts README.md
git commit -m "chore(review): register linear-review skill"
```

---

### Task 7: Workflow doc — Review Lifecycle

**Files:**
- Modify: `docs/workflow.md` (add a section after "Closeout Lifecycle")

**Interfaces:**
- Consumes: the lifecycle described across Tasks 3-5.
- Produces: the workflow-level description tying review into the existing funnel.

- [ ] **Step 1: Add the Review Lifecycle section**

In `docs/workflow.md`, immediately after the "Closeout Lifecycle" section and before "Plan Revision Rule", insert:

```markdown
## Review Lifecycle

1. Human runs `linear-review` against a target repo (whole repo) or a base ref/PR (diff).
2. The skill confirms kickoff choices: severity threshold, triage mode, handoff mode.
3. It dispatches parallel reviewer subagents — reasoning lanes (correctness, security, maintainability, performance, tests; spec in diff mode) and tool-backed lanes (dead-weight, dependency-health) — per `agents/reviewer.md`.
4. Findings are fingerprinted and deduped against the local `.linear-ai/review-ledger.yaml` and open Linear issues carrying the `linear-ai:review-finding` footer.
5. Survivors are triaged with the human. Each chosen finding becomes a Linear issue at `llm-refine` with the finding footer, and its fingerprint is recorded `ticketed`. Explicitly ignored findings are recorded `ignored` and never resurface; deferred findings are not recorded and return next run.
6. In draft-only handoff the skill stops and recommends refinement; in draft + refine it chains into `linear-refine`.

Review creates issues that enter the normal Refinement -> Implementation -> Closeout lifecycle. It introduces no new `llm-*` state and takes no `in-use` claim.
```

- [ ] **Step 2: Verify the section is present**

Run: `grep -c "## Review Lifecycle" docs/workflow.md`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add docs/workflow.md
git commit -m "docs(review): add Review Lifecycle to workflow"
```

---

### Task 8: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the test suite**

Run: `bun test`
Expected: all tests pass, including `test/review_ledger.test.ts`.

- [ ] **Step 2: Run the marked-comment and ledger validators**

Run: `bun run validate && bun run validate:ledger`
Expected: existing validation passes; `ok review-ledger (1)`.

- [ ] **Step 3: Run self-review and skills smoke**

Run: `bun run self-review && bun run skills:smoke`
Expected: self-review passes; skills smoke ends `ok skills smoke ...`. (skills:smoke needs network; if offline, confirm `grep -rn "linear-review" .claude-plugin/plugin.json scripts/skills_smoke.ts README.md skills/linear-review/SKILL.md` shows the skill registered and present.)

- [ ] **Step 4: Confirm no stray references and clean tree**

Run: `git status` and `grep -rn "linear-review" docs/ skills/ agents/ schemas/ templates/ | wc -l`
Expected: working tree clean (all committed); grep count is non-zero and every reference resolves to a file created in this plan.
````
