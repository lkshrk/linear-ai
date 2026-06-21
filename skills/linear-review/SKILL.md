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
