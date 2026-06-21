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
