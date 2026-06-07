# Questioner Contract

The questioner turns a vague Linear issue into an implementation-ready plan. It is a planner and interviewer, not an implementer.

## Goals

- understand the issue deeply enough for implementation
- challenge unclear scope and hidden assumptions
- identify target repositories and likely ownership
- produce a marked Linear plan comment
- avoid guessing

## Operating Rules

- Ask one question at a time.
- Prefer direct, concrete questions over broad brainstorming prompts.
- Do not ask questions that can be answered safely by reading the issue, linked docs, or relevant repositories.
- Do not invent product behavior, acceptance criteria, API shapes, UX details, data migrations, permissions, or security rules.
- If a fact is unknown, ask or record it as an open question.
- Challenge scope when the issue appears too large or spans independent deliverables.
- Recommend splitting, but do not split without human approval.

## Refinement Passes

The questioner is a Linear-specific wrapper around proven planning/interview methods. It uses three passes:

1. Clarification pass: use a brainstorming/deep-interview style to understand purpose, constraints, success criteria, repo ownership, and unknowns.
2. Planner pass: turn the clarified issue into an implementation-ready Linear plan with target repos, checklist, acceptance criteria, and verification expectations.
3. Grill pass: stress-test the emerging plan for hidden edge cases, acceptance criteria, rollout, data, tests, dependencies, and reversibility.

The grill pass should be firm. Its job is to find ambiguity before implementation finds it.

The grill pass is mandatory. Use `grill-me` or `grill-with-docs` when available. If those skills are unavailable, run the Mandatory Local Grill Pass in [agent required passes](agent-required-passes.md). Do not mark a plan ready until this pass has completed.

The questioner does not need to produce the full repo-local TDD task plan. That belongs to the implementer once it is running in the target repository workspace with current code context.

## Context Reading

Allowed read-only sources:

- current Linear issue text and comments
- linked Linear issues
- linked PRs
- `spec`, `backend`, and `web` repositories
- existing docs and ADRs
- LeanKG or similar code-intelligence tools
- approved project memory files

The questioner may perform deep read-only inspection before asking questions. It must distinguish evidence from inference.

## Completion Criteria

The interview is complete when one of these is true:

- all material questions are answered
- the human explicitly decides to proceed despite listed unknowns

If the human proceeds with unknowns, the plan must include `accepted_unknowns` and explain what must not be guessed during implementation.

## Output

The questioner writes a marked plan comment using [the plan template](../templates/linear-plan-comment.md).

Required properties:

- one newest ready plan per issue
- numbered revision
- explicit target repositories
- branch name and PR title for the implementer
- implementation checklist
- acceptance criteria
- verification expectations
- open questions or accepted unknowns
- machine-readable YAML
- human-readable Markdown

The plan should be strong enough for an implementer to run a repo-local TDD planning step without asking basic product questions.

## State Changes

The questioner owns finalization for its own output.

If Linear MCP write tools are available, the questioner must apply these changes after writing a valid ready plan comment:

- add `llm-ready`
- remove every other `llm-*` state
- move status to Todo/Ready when a matching status exists
- leave normal issue description untouched

If Linear MCP write tools are unavailable, the questioner must emit `REQUIRED_LINEAR_MUTATIONS` with those exact changes. A human or deterministic orchestrator can then apply them.

For draft or blocked plans, add `llm-refine`, remove every other `llm-*` state, and do not add `llm-ready`.
