import { describe, expect, test } from "bun:test";
import path from "node:path";
import { validateReviewLedger } from "../scripts/validate_review_ledger";

const ROOT = path.resolve(import.meta.dir, "..");

describe("review ledger schema", () => {
  test("valid example passes", async () => {
    await expect(
      validateReviewLedger(path.join(ROOT, "examples/review-ledger.yaml"))
    ).resolves.toBeUndefined();
  });

  test("ticketed entry without issue id fails", async () => {
    await expect(
      validateReviewLedger(path.join(ROOT, "test/fixtures/review-ledger-bad.yaml"))
    ).rejects.toThrow(/review-ledger invalid/);
  });
});
