Created by decompose from the Sync design.

## Goal

Add a retry queue to the sync client so transient 5xx responses are retried with backoff.

## Why

Nightly syncs fail on single gateway hiccups and need a manual rerun.

## Design excerpt (link + section)

[Sync design](https://linear.app/h-cloud/document/sync-design-1a2b3c), section "Retries":

> Retries use exponential backoff with jitter, at most 5 attempts.

## Interfaces in

`SyncClient.send(batch: Batch): Promise<Result>` from XXX-40.

## Interfaces out

`RetryQueue.enqueue(batch: Batch, attempt: number): void`

## Files (expected touch set)

- `packages/sync/src/retry.ts` — new
- `packages/sync/src/retry.test.ts`
- packages/sync/src/client.ts wire the queue in

## Constraints

No new dependencies.

## Out of scope

none

## Acceptance criteria

- [ ] a 503 is retried up to 5 times
- [ ] a 400 is not retried

## Tests expected

- retry.test.ts: backoff schedule
- retry.test.ts: non-retryable status

## Verify (exact commands)

```sh
# unit tests
bun test packages/sync

bun run check
```
