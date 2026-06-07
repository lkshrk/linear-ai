import { readFile } from "node:fs/promises";
import YAML from "yaml";

const PLAN_START = /<!--\s*linear-ai:plan v1\b.*?-->/s;
const PLAN_END = /<!--\s*\/linear-ai:plan\s*-->/s;
const STATUS_START = /<!--\s*linear-ai:status v1\b.*?-->/s;
const STATUS_END = /<!--\s*\/linear-ai:status\s*-->/s;
const YAML_BLOCK = /```yaml\n(.*?)```/s;
const LLM_STATE_LABELS = ["llm-refine", "llm-ready", "llm-active", "llm-blocked", "llm-review", "llm-split"];

class ValidationError extends Error {}

type Mapping = Record<string, unknown>;
type ValidatorOptions = {
  knownLabels?: Set<string>;
};

function isMapping(value: unknown): value is Mapping {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function extractBlock(content: string, startMarker: RegExp, endMarker: RegExp, kind: string): string {
  const startMatch = content.match(startMarker);
  const endMatch = content.match(endMarker);
  if (!startMatch || startMatch.index == null) throw new ValidationError(`missing ${kind} start marker`);
  if (!endMatch || endMatch.index == null) throw new ValidationError(`missing ${kind} end marker`);

  const block = content.slice(startMatch.index + startMatch[0].length, endMatch.index);
  const yamlMatch = block.match(YAML_BLOCK);
  if (!yamlMatch) throw new ValidationError(`missing ${kind} fenced YAML block`);
  return yamlMatch[1];
}

function loadYaml(yamlText: string, kind: string): Mapping {
  try {
    const data = YAML.parse(yamlText);
    if (!isMapping(data)) throw new ValidationError(`${kind} YAML must be a mapping`);
    return data;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(`invalid ${kind} YAML: ${(error as Error).message}`);
  }
}

function requireFields(data: Mapping, fields: string[]): void {
  for (const field of fields) {
    if (!Object.hasOwn(data, field)) throw new ValidationError(`${field} is required`);
  }
}

function requireArray(data: Mapping, field: string, min = 0): unknown[] {
  const value = data[field];
  if (!Array.isArray(value)) throw new ValidationError(`${field} must be an array`);
  if (value.length < min) throw new ValidationError(`${field} must contain at least one item`);
  return value;
}

function requireMappingItems(items: unknown[], field: string): Mapping[] {
  return items.map((item, index) => {
    if (!isMapping(item)) throw new ValidationError(`${field}[${index}] must be a mapping`);
    return item;
  });
}

function requireItemFields(items: unknown[], field: string, requiredFields: string[]): Mapping[] {
  const mappings = requireMappingItems(items, field);
  mappings.forEach((item, index) => {
    for (const requiredField of requiredFields) {
      if (!Object.hasOwn(item, requiredField)) throw new ValidationError(`${field}[${index}].${requiredField} is required`);
    }
  });
  return mappings;
}

function requireItemEnum(items: Mapping[], field: string, itemField: string, allowedValues: string[]): void {
  items.forEach((item, index) => {
    if (!allowedValues.includes(String(item[itemField]))) {
      throw new ValidationError(`${field}[${index}].${itemField} is invalid`);
    }
  });
}

function requireUniqueLlmStateLabel(data: Mapping, field: string): void {
  const labels = data[field];
  if (!Array.isArray(labels)) return;

  const llmStateLabels = labels.filter((label) => typeof label === "string" && LLM_STATE_LABELS.includes(label));
  if (llmStateLabels.length > 1) throw new ValidationError(`${field} may contain only one llm workflow state label`);
}

function requireKnownLabels(data: Mapping, field: string, knownLabels?: Set<string>): void {
  if (!knownLabels) return;
  const labels = data[field];
  if (!Array.isArray(labels)) return;

  for (const label of labels) {
    if (typeof label === "string" && !knownLabels.has(label)) {
      throw new ValidationError(`${field} contains unknown Linear label ${label}`);
    }
  }
}

function validatePlan(data: Mapping, options: ValidatorOptions = {}): void {
  requireFields(data, [
    "schema",
    "issue_id",
    "revision",
    "plan_status",
    "source_issue_url",
    "target_repositories",
    "labels_to_apply",
    "labels_to_remove",
    "split_recommendation",
    "accepted_unknowns",
    "open_questions",
    "implementation_checklist",
    "acceptance_criteria",
    "verification",
    "do_not_assume"
  ]);

  if (data.schema !== "linear-ai.plan.v1") throw new ValidationError("schema must be linear-ai.plan.v1");
  if (!Number.isInteger(data.revision) || Number(data.revision) <= 0) throw new ValidationError("revision must be a positive integer");
  if (!["draft", "ready", "blocked"].includes(String(data.plan_status))) throw new ValidationError("plan_status is invalid");

  requireArray(data, "target_repositories", 1);
  requireArray(data, "labels_to_apply");
  requireArray(data, "labels_to_remove");
  requireUniqueLlmStateLabel(data, "labels_to_apply");
  requireKnownLabels(data, "labels_to_apply", options.knownLabels);
  requireKnownLabels(data, "labels_to_remove", options.knownLabels);
  const accepted = requireArray(data, "accepted_unknowns");
  const openQuestions = requireArray(data, "open_questions");
  const checklist = requireItemFields(requireArray(data, "implementation_checklist", 1), "implementation_checklist", ["id", "repository", "task", "status"]);
  const acceptance = requireItemFields(requireArray(data, "acceptance_criteria", 1), "acceptance_criteria", ["id", "criterion"]);
  const verification = requireItemFields(requireArray(data, "verification", 1), "verification", ["id", "command_or_check"]);
  void acceptance;
  void verification;
  requireItemEnum(checklist, "implementation_checklist", "status", ["todo", "in_progress", "done", "blocked"]);
  requireArray(data, "do_not_assume", 1);

  const split = data.split_recommendation;
  if (!isMapping(split)) throw new ValidationError("split_recommendation must be a mapping");
  if (split.recommended !== true && split.recommended !== false) throw new ValidationError("split_recommendation.recommended is required");
  if (!Object.hasOwn(split, "reason")) throw new ValidationError("split_recommendation.reason is required");

  if (data.plan_status === "ready") {
    const unresolved = openQuestions.filter((question) => !accepted.includes(question));
    if (unresolved.length > 0) throw new ValidationError("ready plan has open questions not listed as accepted unknowns");
  }
}

function validateStatus(data: Mapping, options: ValidatorOptions = {}): void {
  requireFields(data, [
    "schema",
    "issue_id",
    "plan_revision",
    "status_revision",
    "implementation_status",
    "draft_prs",
    "completed_items",
    "blocked_items",
    "skipped_items",
    "placeholders",
    "questions",
    "verification",
    "recommended_labels_to_apply",
    "recommended_labels_to_remove",
    "recommended_status"
  ]);

  if (data.schema !== "linear-ai.status.v1") throw new ValidationError("schema must be linear-ai.status.v1");
  if (!Number.isInteger(data.plan_revision) || Number(data.plan_revision) <= 0) throw new ValidationError("plan_revision must be a positive integer");
  if (!Number.isInteger(data.status_revision) || Number(data.status_revision) <= 0) throw new ValidationError("status_revision must be a positive integer");
  if (!["active", "blocked", "review_ready", "abandoned"].includes(String(data.implementation_status))) {
    throw new ValidationError("implementation_status is invalid");
  }

  const draftPrs = requireItemFields(requireArray(data, "draft_prs"), "draft_prs", ["repository", "url"]);
  void draftPrs;
  requireArray(data, "completed_items");
  requireArray(data, "blocked_items");
  requireArray(data, "skipped_items");
  requireItemFields(requireArray(data, "placeholders"), "placeholders", ["id", "location", "reason"]);
  const questions = requireItemFields(requireArray(data, "questions"), "questions", ["id", "blocks", "question"]);
  questions.forEach((question, index) => {
    if (!Array.isArray(question.blocks)) throw new ValidationError(`questions[${index}].blocks must be an array`);
  });
  const verification = requireItemFields(requireArray(data, "verification", 1), "verification", ["check", "result", "reason"]);
  requireItemEnum(verification, "verification", "result", ["passed", "failed", "not_run"]);
  requireArray(data, "recommended_labels_to_apply");
  requireArray(data, "recommended_labels_to_remove");
  requireUniqueLlmStateLabel(data, "recommended_labels_to_apply");
  requireKnownLabels(data, "recommended_labels_to_apply", options.knownLabels);
  requireKnownLabels(data, "recommended_labels_to_remove", options.knownLabels);
}

async function validateFile(path: string, options: ValidatorOptions = {}): Promise<string> {
  const content = await readFile(path, "utf8");

  if (PLAN_START.test(content)) {
    const yaml = extractBlock(content, PLAN_START, PLAN_END, "plan");
    validatePlan(loadYaml(yaml, "plan"), options);
    return `ok ${path} plan`;
  }

  if (STATUS_START.test(content)) {
    const yaml = extractBlock(content, STATUS_START, STATUS_END, "status");
    validateStatus(loadYaml(yaml, "status"), options);
    return `ok ${path} status`;
  }

  throw new ValidationError("no linear-ai marked comment found");
}

async function loadKnownLabels(path: string): Promise<Set<string>> {
  const data = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ValidationError("metadata must be a JSON object");
  const labels = (data as { labels?: unknown }).labels;
  if (!Array.isArray(labels)) throw new ValidationError("metadata.labels must be an array");

  return new Set(
    labels
      .map((label) => (label && typeof label === "object" && !Array.isArray(label) ? (label as { name?: unknown }).name : undefined))
      .filter((name): name is string => typeof name === "string")
  );
}

async function parseArgs(argv: string[]): Promise<{ files: string[]; options: ValidatorOptions }> {
  const files: string[] = [];
  const options: ValidatorOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--metadata") {
      const metadataPath = argv[index + 1];
      if (!metadataPath) throw new ValidationError("--metadata requires a path");
      options.knownLabels = await loadKnownLabels(metadataPath);
      index += 1;
    } else {
      files.push(arg);
    }
  }

  return { files, options };
}

async function main(argv: string[]): Promise<number> {
  if (argv.length === 0) {
    console.error("usage: bun scripts/validate_marked_comments.ts [--metadata metadata.json] FILE [FILE...]");
    return 2;
  }

  const { files, options } = await parseArgs(argv);
  if (files.length === 0) {
    console.error("usage: bun scripts/validate_marked_comments.ts [--metadata metadata.json] FILE [FILE...]");
    return 2;
  }

  let failures = 0;
  for (const path of files) {
    try {
      console.log(await validateFile(path, options));
    } catch (error) {
      failures += 1;
      console.error(`${path}: ${(error as Error).message}`);
    }
  }

  return failures === 0 ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
