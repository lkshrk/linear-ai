# Linear Claim Lock Block Template

Copy this marked block into the Linear issue description when an agent takes the `in-use` claim lock. Remove the entire block when the lock is released. Preserve any human-authored description text and the dashboard block outside these markers.

````markdown
<!-- linear-ai:claim v1 issue=TEAM-123 -->

```yaml
schema: linear-ai.claim.v1
issue_id: TEAM-123
claimed_by: linear-refine
claimed_at: "2026-06-21T14:32:00Z"
```

<!-- /linear-ai:claim -->
````

## Validity Rules

- YAML should match `schemas/linear-ai.claim.v1.schema.yaml`.
- There should be at most one claim block in the issue description.
- The block is present only while the issue holds the `in-use` label; releasing the lock removes the block.
- `claimed_by` names the claiming skill or agent, for example `linear-refine`, `linear-implement`, or `linear-close`.
- `claimed_at` is an ISO 8601 timestamp used by `linear-status` to detect stale locks.
- Keep the claim block consistent with the `in-use` label: both present together, both absent together.
