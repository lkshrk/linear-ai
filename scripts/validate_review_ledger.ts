import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import YAML from "yaml";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCHEMA_FILE = "linear-ai.review-ledger.v1.schema.yaml";

export async function validateReviewLedger(filePath: string): Promise<void> {
  const ajv = new Ajv2020({ allErrors: true });
  const schema = YAML.parse(await readFile(path.join(ROOT, "schemas", SCHEMA_FILE), "utf8"));
  const validate = ajv.compile(schema);
  const data = YAML.parse(await readFile(filePath, "utf8"));
  if (!validate(data)) {
    const detail = (validate.errors ?? [])
      .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
      .join("; ");
    throw new Error(`review-ledger invalid: ${detail}`);
  }
}

if (import.meta.main) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    process.stderr.write("usage: bun scripts/validate_review_ledger.ts FILE [FILE...]\n");
    process.exit(1);
  }
  try {
    for (const file of files) await validateReviewLedger(file);
    process.stdout.write(`ok review-ledger (${files.length})\n`);
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(1);
  }
}
