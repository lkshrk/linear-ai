import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { validateMetadata } from "./linear_metadata.ts";

class IntakeError extends Error {}

type IssueData = Record<string, unknown>;
type Metadata = Record<string, unknown>;

const BUG_FIELDS = ["title", "problem", "expected_behavior", "actual_behavior", "reproduction_steps", "context", "evidence_links"];
const FEATURE_FIELDS = [
  "title",
  "problem_opportunity",
  "desired_outcome",
  "user_actor",
  "current_behavior",
  "proposed_behavior",
  "context",
  "evidence_links"
];

function parseArgs(argv: string[]): { metadataPath: string; inputPath: string } {
  if (argv.length !== 3 || argv[0] !== "--metadata") {
    throw new IntakeError("usage: bun scripts/intake_issue.ts --metadata metadata.json INPUT.yaml");
  }
  return { metadataPath: argv[1], inputPath: argv[2] };
}

async function loadYaml(path: string): Promise<IssueData> {
  const data = YAML.parse(await readFile(path, "utf8")) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new IntakeError("input YAML must be a mapping");
  return data as IssueData;
}

async function loadJson(path: string): Promise<Metadata> {
  const data = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new IntakeError("metadata must be a JSON object");
  return data as Metadata;
}

function requireFields(data: IssueData, fields: string[]): void {
  for (const field of fields) {
    const value = data[field];
    if (value == null || value === "" || (field !== "evidence_links" && Array.isArray(value) && value.length === 0)) {
      throw new IntakeError(`${field} is required`);
    }
  }
}

function lines(value: unknown): string {
  const items = Array.isArray(value) ? value : [value];
  if (items.length === 0) return "None.";
  return items.map((item) => `- ${item}`).join("\n");
}

function selectedLabels(data: IssueData): string[] {
  const labels = Array.isArray(data.selected_labels) ? data.selected_labels : data.component_tag ? [data.component_tag] : [];
  return labels.filter((label): label is string => typeof label === "string" && label.length > 0);
}

function numbered(value: unknown): string {
  const items = Array.isArray(value) ? value : [value];
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function context(data: IssueData): string {
  const labels = selectedLabels(data);
  return [
    `Target team: ${data.target_team}`,
    `Target project: ${data.target_project}`,
    `Suggested labels: ${labels.length > 0 ? labels.join(", ") : "None"}`,
    lines(data.context)
  ].join("\n");
}

function renderBug(data: IssueData): string {
  requireFields(data, [...BUG_FIELDS, "target_team", "target_project"]);
  return `# ${data.title}

## Problem

${data.problem}

## Expected Behavior

${data.expected_behavior}

## Actual Behavior

${data.actual_behavior}

## Reproduction Steps

${numbered(data.reproduction_steps)}

## Context

${context(data)}

## Evidence / Links

${lines(data.evidence_links)}
`;
}

function renderFeature(data: IssueData): string {
  requireFields(data, [...FEATURE_FIELDS, "target_team", "target_project"]);
  return `# ${data.title}

## Problem / Opportunity

${data.problem_opportunity}

## Desired Outcome

${data.desired_outcome}

## User / Actor

${data.user_actor}

## Current Behavior

${data.current_behavior}

## Proposed Behavior

${data.proposed_behavior}

## Context

${context(data)}

## Evidence / Links

${lines(data.evidence_links)}
`;
}

function render(data: IssueData): string {
  if (data.type === "bug") return renderBug(data);
  if (data.type === "feature") return renderFeature(data);
  throw new IntakeError("type must be bug or feature");
}

function metadataFor(data: IssueData): Record<string, unknown> {
  const typeLabel = data.type === "bug" ? "Bug" : "Feature";
  const labels = [...new Set([typeLabel, ...selectedLabels(data)])];
  if (data.add_llm_refine !== false && !labels.includes("llm-refine")) labels.push("llm-refine");
  return {
    issue_type: data.type,
    target_team: data.target_team,
    target_project: data.target_project,
    selected_labels: selectedLabels(data),
    labels_to_apply: labels
  };
}

async function main(argv: string[]): Promise<number> {
  try {
    const args = parseArgs(argv);
    const metadata = await loadJson(args.metadataPath);
    const input = await loadYaml(args.inputPath);
    const typeLabel = input.type === "bug" ? "Bug" : input.type === "feature" ? "Feature" : undefined;
    const errors = validateMetadata(metadata, {
      targetTeam: String(input.target_team ?? ""),
      targetProject: String(input.target_project ?? ""),
      componentTag: String(input.component_tag ?? ""),
      selectedLabels: selectedLabels(input).join(","),
      typeLabel,
      llmLabel: input.add_llm_refine === false ? undefined : "llm-refine"
    });
    if (errors.length > 0) {
      process.stderr.write(`${errors.join("\n")}\n`);
      return 1;
    }

    process.stdout.write(`${JSON.stringify({ issue_body: render(input), metadata: metadataFor(input) }, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
