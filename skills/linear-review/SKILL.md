---
name: linear-review
description: "Run parallel reviewer subagents across a target repository or diff for correctness, security, maintainability, performance, tests, dead code and dependency health, deduplicate findings against a persistent ledger and Linear, and turn the survivors into Linear issues. Use for a code review, a repository health audit, or to file review findings."
---

# Linear Review

Read and follow `docs/reviewer.md` (pipeline, dedup, triage, ticket creation), `docs/review-lanes.md`
(lanes, finding shape, gates, fingerprint), `templates/linear-review-finding-footer.md` and
`schemas/linear-ai.review-ledger.v1.schema.yaml`.

## Scope

No argument reviews the whole target repository. A base ref, PR or `HEAD~n` reviews only the changed code
against that base.

## Kickoff

Confirm before fanning out, each with a recommended default: severity threshold (default none), triage mode
(hybrid, bulk table, or one at a time) and handoff mode (draft only, or draft + refine).

## Fan-Out

Run the lanes from `docs/review-lanes.md` as independent parallel subagents: five reasoning lanes
(correctness, security, maintainability, performance, tests), the spec lane only in diff mode when the issue
has acceptance criteria, and the two tool-backed lanes (dead weight, dependency health).

## Dedup, Triage, Tickets

Fingerprint every finding and drop those recorded as `ignored` or `ticketed` in
`.linear-ai/review-ledger.yaml` and those matching an open Linear issue with the
`linear-ai:review-finding` footer. Present the survivors in the chosen triage mode. If the team and project
for new tickets are not clear from the session, ask. Create the chosen tickets in Backlog
(`docs/reviewer.md` → Ticket creation) and record them in the ledger; validate it with
`scripts/validate_review_ledger.ts .linear-ai/review-ledger.yaml`.

If Linear write tools are unavailable, print the tickets for the human to create and do not write the
ledger.

## Handoff

Report the dedup counts, the tickets created and the ledger writes. Draft only: recommend `linear-refine`.
Draft + refine: continue into `linear-refine` on the created tickets with each finding's evidence. Ask
whether the human wants to continue; do not run the next skill automatically in draft-only mode.
