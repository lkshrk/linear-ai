# Linear Review — Design

## Overview

A `linear-review` skill that fans out parallel reviewer subagents across a target,
deduplicates findings against a persistent ledger and live Linear state, then triages
the survivors into Linear tickets that enter the existing refine → implement → close
funnel. Findings the user explicitly ignores are remembered so they never re-surface.

The skill runs against a **target** repository under review (e.g. `backend`, `web`,
`spec`), not the `linear-ai` tooling repo. All per-repo state lives in the target repo.

## Goals

- Surface code-quality findings across 13 dimensions via parallel review lanes.
- Never re-propose a finding the user has explicitly ignored.
- Avoid double-filing a finding already turned into a Linear ticket, including across
  machines.
- Feed accepted findings into the existing Linear AI workflow rather than a parallel one.

## Non-Goals

- No automated fixing. The skill files tickets; implementation flows through
  `linear-refine` / `linear-implement` as usual.
- No shared/team-wide ignore memory. The ledger is local per clone (see Ledger).

## Invocation & Scope

- No argument → **whole-repo audit**.
- Argument is a base ref, PR, or `HEAD~n` → **diff review** of changed code only.
- Optional `--min=<severity>` threshold at kickoff (e.g. `--min=high`): only surfaces
  findings at or above that severity; the rest are auto-**deferred** (not ignored — they
  return next run).

## Pipeline

```
scope resolve
  → fan-out (6 parallel review lanes)
  → collect + normalize findings
  → fingerprint
  → dedup (drop ledger-ignored, ledger-ticketed, and live Linear fingerprint matches)
  → severity rank
  → triage (mode chosen at kickoff)
  → write (Linear tickets + ledger entries)
  → standalone continuation prompt
```

## Review Lanes

Six parallel reviewer subagents cover 13 dimensions. Each finding is tagged with its
specific dimension regardless of which lane produced it.

| Lane | Dimensions |
|---|---|
| Correctness | bugs, silent-failures / error-handling, concurrency / races |
| Security & deps | security, dependency-health (CVE / outdated / unused) |
| Maintainability | code-smell, refactoring, duplication, docs / naming / type-safety |
| Performance | optimization |
| Dead weight | dead code, handrolled-vs-lib |
| Tests | test gaps |

Each finding returns:

- `dimension`
- `severity` — `critical | high | medium | low`
- `anchor` — `file:symbol`
- `snippet` — the offending code
- `why` — the problem
- `suggested_fix`

## Fingerprint & Ledger

One local store, gitignored, in the target repo: `.linear-ai/review-ledger.yaml`.
It holds both `ignored` and `ticketed` states.

```yaml
entries:
  - fp: "smell:src/auth/token.ts:verify:d4e5f6"
    state: ignored          # ignored | ticketed
    category: code-smell
    anchor: "src/auth/token.ts:verify"
    issue: null             # set to e.g. HCL-123 when state=ticketed
    reason: "perf hot path, readability traded knowingly"
    recorded_at: "2026-06-21T..."
```

### Fingerprint

```
fp = category + coarse_anchor(file or symbol) + content_hash(normalized snippet)
```

- **No line numbers** — they drift on unrelated edits.
- `normalized snippet` = offending code with whitespace and comments stripped, so
  reformatting does not change the fingerprint.
- A human-readable `anchor` and `reason` are stored for re-location and audit.
- If the offending code itself is rewritten, the snippet hash changes and the finding
  re-surfaces. This is intended: rewritten code deserves a fresh look, and re-ignoring is
  a single appended entry.

### Dedup sources

- **ledger `ignored`** → never re-proposed.
- **ledger `ticketed`** → local dedup.
- **live Linear fingerprint-footer search** → cross-machine backstop, so a fresh clone or
  a second developer does not double-file an existing ticket.
- **defer** at triage → not written to the ledger; re-surfaces next run.

### Local-only consequence (accepted)

The ledger is gitignored, so ignore decisions are per-clone. A fresh clone or CI re-surfaces
findings once. Linear fingerprint search is the only cross-machine dedup. This is the
intended trade for simplicity.

## Triage

Triage **mode** is chosen at kickoff and controls presentation:

1. **Hybrid (default)** — severity-ranked table; "tell me more about #N" drills into any
   finding before deciding.
2. **Bulk table** — mark each finding ticket / ignore / defer in one pass.
3. **One at a time** — questioner-style, each finding discussed individually.

**Severity** controls ordering and default dispositions. Findings are grouped by tier:

| Tier | Default disposition |
|---|---|
| Critical | ticket |
| High | ticket |
| Medium | defer |
| Low | defer |

`ignore` is **never** a default. It is a durable human statement and only ever the result
of an explicit choice, so the ledger gains `ignored` entries by deliberate action, never by
a default sweep. The user may accept-all-defaults in one keystroke or override per finding.

## Ticket Creation

Each chosen finding becomes a Linear issue following `linear-create-issue` conventions:

- `bug` label for bugs, security, and silent-failure findings; otherwise a tech-debt-style
  classification (feature / enhancement).
- `llm-refine` so the issue enters the normal pipeline. (Open question — see below — whether
  some findings should enter at `llm-ready` instead.)
- A marked footer for live dedup:
  `<!-- linear-ai:review-finding fp=... dimension=... -->`
- Default one ticket per finding; the skill offers to group near-duplicate findings into a
  single ticket.

When a finding is `ticketed`, its fingerprint is written to the ledger with `state: ticketed`
and the resulting `issue` ID.

## Files to Add

Matches the existing skill anatomy (SKILL.md → agents/*.md + docs/*.md + schemas + templates).

- `skills/linear-review/SKILL.md`
- `agents/reviewer.md` — lane reviewer brief, finding shape, fingerprint rules
- `docs/reviewer.md` — full pipeline, dedup, triage, ledger spec
- `schemas/linear-ai.review-ledger.v1.schema.yaml`
- `templates/linear-review-finding-footer.md`
- `docs/workflow.md` — add a "Review Lifecycle" section

## Edge Handling

- **No claim lock.** Review is repo-wide, not scoped to a single issue, so it takes no
  `in-use` claim. Tickets it creates follow the normal claim/flow rules afterward.
- **Linear writes unavailable** → emit `REQUIRED_LINEAR_MUTATIONS` with exact ticket bodies
  and label changes; the ledger is still written locally.
- **Clean review** → report "no new findings" plus dedup counts (X ignored, Y already
  ticketed) so the run is auditable.

## Open Question

- Should review-created tickets land at `llm-refine` (full funnel) or `llm-ready` (skip
  refinement, since the finding already names the fix)? Current design: `llm-refine` for
  all, revisit if findings prove consistently implementation-ready.
