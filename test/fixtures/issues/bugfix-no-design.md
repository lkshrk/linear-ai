## goal
Stop the CLI from crashing when the config file is empty.

## Why
`ns status` throws on a fresh install.

## Design excerpt
None.

## Interfaces in
none

## Interfaces out
none

## Files
* `packages/cli/src/config.ts`
* `packages/cli/src/config.test.ts`

## Constraints
none

## Out of scope
none

## Acceptance criteria
1. an empty config file gives the "no config" message

## Tests expected
- config.test.ts: empty file

## Verify
- `bun test packages/cli`
- `bun run check`
