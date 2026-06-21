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

Beyond exact-`fp` dedup, group surviving findings by anchor (`file:symbol`) across lanes before triage. Because the fingerprint prefixes the lane/category, the same code spot flagged by two lanes carries two distinct `fp`s and would otherwise file two tickets; co-located findings collapse into one finding carrying each lane's note and produce one ticket. Each lens note keeps its own `fp` in the ledger so dedup stays per-lens on later runs.

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
| Medium | ticket | defer |
| Low / NIT | defer | defer |

High-confidence MEDIUM defaults to ticket, not defer: a review whose purpose is filing tickets should not silently drop confirmed defects and test gaps. Low-confidence MEDIUM still defers and returns next run at no cost.

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
