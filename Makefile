.PHONY: test validate marketplace-generate marketplace-publish marketplace-smoke release-check release-create self-review install-smoke skills-smoke skills-sync skills-sync-check

test:
	bun test

validate:
	bun scripts/validate_issue.ts examples/issue.md
	bun scripts/validate_review_ledger.ts examples/review-ledger.yaml

marketplace-generate:
	bun scripts/generate_marketplace_specs.ts --version package

marketplace-publish:
	bun scripts/publish_marketplace.ts $(if $(PUSH),--push,)

marketplace-smoke:
	bun scripts/marketplace_smoke.ts

release-check: marketplace-generate
	bun scripts/verify_release.ts --marketplace-dir dist/marketplace

release-create:
	bun scripts/create_release.ts $(VERSION)

self-review:
	bun scripts/self_review.ts

install-smoke:
	bun scripts/install_smoke.ts

skills-smoke:
	bun scripts/skills_smoke.ts

skills-sync:
	bun scripts/sync_skill_references.ts

skills-sync-check:
	bun scripts/sync_skill_references.ts --check
