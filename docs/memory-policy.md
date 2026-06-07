# Memory Policy

The workflow uses boring, reviewable memory first. Optional AI memory tools can be added later, but they are not authoritative in v1.

## Canonical Memory

Canonical memory is human-visible and reviewable:

- marked Linear plan comments
- marked Linear status comments
- Linear bug and feature issue fields
- approved `spec` repository docs
- approved docs in target repositories
- code and tests
- PR descriptions and review comments

Agents may act on canonical memory.

## Project Memory File

If local project memory is useful, use a Markdown file such as:

- `memory/project-facts.md`

Rules:

- only store approved durable facts
- include source links where possible
- separate facts from preferences
- separate current decisions from historical notes
- do not store guesses

## Optional Memory Backends

Potential future tools:

- Cognee for MCP-native graph/RAG/code memory.
- Graphiti for temporal facts and evolving relationships.
- Mem0 for lighter user/session/agent memory.
- Letta if adopting a memory-first agent runtime.

These tools may improve recall. They must not replace canonical memory.

## LeanKG

LeanKG is code intelligence, not general memory.

Use it for:

- symbol lookup
- call graph
- dependency graph
- impact radius
- code clusters
- test relationships

Do not use it as the source of truth for issue decisions or product requirements.

## Promotion Rule

Memory becomes durable only after promotion into a canonical source.

Examples:

- A repeated user preference becomes durable when written to `spec` or approved memory Markdown.
- A question answer becomes durable when captured in the marked Linear plan comment.
- A code fact becomes durable when verified against code or tests.

## Staleness Rule

If memory conflicts with current Linear comments, approved docs, code, or tests, the current canonical source wins.

Agents must report the conflict instead of choosing silently.
