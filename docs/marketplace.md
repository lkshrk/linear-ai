# Marketplace Distribution

Linear AI uses a tap-style distribution model.

## Source Repository

`lkshrk/linear-ai` is the canonical source repository. It owns:

- `skills/`
- `.codex-plugin/plugin.json`
- `.claude-plugin/plugin.json`
- schemas, templates, tests, and releases

Install directly with `npx skills`:

```sh
npx skills add lkshrk/linear-ai --agent codex --agent claude-code
```

## Marketplace Repository

Create a separate marketplace repository, for example:

```text
lkshrk/agent-marketplace
```

That repository should contain marketplace metadata and plugin release snapshots. This lets users configure one stable marketplace source and then install/update plugins from it.

Generate the marketplace files from this repository:

```sh
bun scripts/generate_marketplace_specs.ts --repository lkshrk/linear-ai --version package --out-dir dist/marketplace
```

Publish the generated files into the marketplace repository:

```text
dist/marketplace/
├── .agents/plugins/marketplace.json
├── .claude-plugin/marketplace.json
├── plugins/linear-ai/
└── README.md
```

Codex can install from the canonical released git source referenced by `.agents/plugins/marketplace.json`. Claude Code validates plugin sources as relative marketplace paths, so the generated marketplace includes a `plugins/linear-ai` snapshot for Claude.

## Codex Install From Marketplace

```sh
codex plugin marketplace add lkshrk/agent-marketplace --ref main
codex plugin add linear-ai --marketplace linear-ai
```

## Claude Code Install From Marketplace

```sh
claude plugin marketplace add lkshrk/agent-marketplace
claude plugin install linear-ai@linear-ai
```

## Release Automation

On a new `linear-ai` release:

1. Create the release commit and tag locally:

   ```sh
   bun scripts/create_release.ts patch
   bun scripts/create_release.ts minor
   bun scripts/create_release.ts major
   bun scripts/create_release.ts v1.2.3
   ```

   Use `--dry-run` to preview the target version. Use `--push` to push the release commit and tag after local checks pass.
2. Wait for source CI and release workflow to pass.
3. Generate marketplace specs for the released version.
4. Open a PR against the marketplace repository.
5. Marketplace CI validates Codex and Claude Code can install `linear-ai` from the updated manifests.
6. Merge the marketplace PR after validation.

Do not make every plugin source repository double as a marketplace. Keep marketplace metadata centralized, like a Homebrew tap.
