# Linear Claim Lease Design

## Purpose

Linear issue claim locks currently prevent duplicate work with the `in-use` label plus a `linear-ai:claim` block containing `claimed_by` and `claimed_at`. That blocks concurrent pickup, but it cannot distinguish a live long-running agent from an abandoned ticket, and it cannot identify whether a later run is the same agent instance or only the same workflow name.

The claim contract should be portable across agent CLIs. Codex, Claude, OMX, or a custom agent should be able to inspect Linear and decide whether the agent that claimed an issue is still maintaining the claim.

## Design

Use a Linear-visible lease as the source of truth. The existing `linear-ai:claim` block remains in the issue description, but it gains a unique instance identifier and heartbeat lease fields:

```yaml
schema: linear-ai.claim.v1
issue_id: TEAM-123
agent_instance_id: "01J..."
agent_kind: "codex"
claimed_by: "linear-implement"
claimed_at: "2026-06-21T14:32:00Z"
last_heartbeat_at: "2026-06-21T14:37:00Z"
lease_expires_at: "2026-06-21T14:42:00Z"
heartbeat_interval_seconds: 300
```

`agent_instance_id` is the ownership key. It must be unique per agent run, preferably a UUID or ULID. `claimed_by` remains a human-readable workflow or skill name. `agent_kind` is descriptive only and must not be required for liveness checks.

`last_heartbeat_at` and `lease_expires_at` make the claim externally verifiable. Any agent can read the Linear issue and determine whether the claim is still being maintained without access to the original process, terminal, machine, or CLI runtime.

## Claim Lifecycle

When an agent claims an issue, it:

- generates a fresh `agent_instance_id`,
- writes the `linear-ai:claim` block,
- sets `claimed_at`, `last_heartbeat_at`, and `lease_expires_at`,
- adds the `in-use` label.

While working, the claiming agent refreshes `last_heartbeat_at` and extends `lease_expires_at` before the lease expires. A heartbeat interval of 300 seconds is the default unless a workflow has a documented reason to use another interval.

When the agent stops working the issue, it removes both the `in-use` label and the claim block. Stop paths include phase completion, handoff, block, failure, cancellation, skip, or final closeout.

## Conflict And Resume Rules

Before starting work, an agent re-reads the issue from Linear.

If the issue has `in-use` and a valid unexpired claim owned by a different `agent_instance_id`, the new agent skips the issue and records the observed claim owner and lease expiry.

If the issue has `in-use` and an expired claim, any agent may repair the stale lock by removing `in-use` and the claim block. After repair, it may reclaim the issue if the workflow state still makes it eligible.

If the current agent has the same `agent_instance_id` as the claim block, it may resume, refresh, or release the claim. Agents must not treat matching `claimed_by` alone as ownership; two runs of `linear-implement` are different owners unless their `agent_instance_id` matches.

## Stale Detection

Lease-first stale detection replaces age-only stale detection for new claim blocks:

- `lease_expires_at < now` means the claim is stale.
- `lease_expires_at >= now` means the claim is live, even if `claimed_at` is old.
- `in-use` without a claim block remains a repair-state mismatch.
- A claim block without `in-use` remains a repair-state mismatch.

For backward compatibility, old claim blocks without lease fields fall back to the current `claimed_at` stale threshold. The default fallback threshold remains 60 minutes unless the status workflow or user overrides it.

Structural contradictions still take precedence. For example, `in-use` on a Done issue, or `in-use` beside a state that should release on stop, is repair-state even if the lease has not expired.

## Schema And Validation

`linear-ai.claim.v1` should add optional lease fields first, preserving compatibility with existing comments:

- `agent_instance_id`
- `agent_kind`
- `last_heartbeat_at`
- `lease_expires_at`
- `heartbeat_interval_seconds`

The validator should accept both old and new v1 claim blocks during the migration window. When any lease field is present, all required lease fields for the new contract should be present and non-empty. `heartbeat_interval_seconds` should be a positive integer.

Templates should show the new lease form. Workflow docs should state that `agent_instance_id` is the ownership key and `lease_expires_at` is the portable liveness check.

## Testing

Add or update validation coverage for:

- a valid legacy claim block,
- a valid lease claim block,
- a lease claim missing one required lease field,
- a non-positive heartbeat interval,
- multiple claim blocks in one description,
- claim block and `in-use` mismatch documented in workflow/status guidance.

Status workflow tests or fixtures should cover lease-first stale detection and fallback `claimed_at` stale detection for legacy claim blocks.

## Out Of Scope

This design does not require a central process registry, local OMX state, tmux state, or per-CLI runtime integration. Local runtime evidence may be useful for diagnostics, but Linear-visible lease metadata is the portable contract.
