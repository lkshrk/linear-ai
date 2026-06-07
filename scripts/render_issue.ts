import { readFile } from "node:fs/promises";
import YAML from "yaml";

class RenderError extends Error {}

const BUG_FIELDS = [
  "title",
  "problem",
  "expected_behavior",
  "actual_behavior",
  "reproduction_steps",
  "context",
  "evidence_links"
];

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

type IssueData = Record<string, unknown>;

async function loadInput(path: string): Promise<IssueData> {
  try {
    const data = YAML.parse(await readFile(path, "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new RenderError("input YAML must be a mapping");
    }
    return data as IssueData;
  } catch (error) {
    if (error instanceof RenderError) throw error;
    throw new RenderError(`invalid YAML: ${(error as Error).message}`);
  }
}

function requireFields(data: IssueData, fields: string[]): void {
  for (const field of fields) {
    const value = data[field];
    const empty = value == null || (field !== "evidence_links" && Array.isArray(value) && value.length === 0) || value === "";
    if (empty) throw new RenderError(`${field} is required`);
  }
}

function renderList(value: unknown, numbered = false): string {
  const items = Array.isArray(value) ? value : [value];
  if (items.length === 0) return "None.";

  return items.map((item, index) => (numbered ? `${index + 1}. ${item}` : `- ${item}`)).join("\n");
}

function renderBug(data: IssueData): string {
  requireFields(data, BUG_FIELDS);

  return `# ${data.title}

## Problem

${data.problem}

## Expected Behavior

${data.expected_behavior}

## Actual Behavior

${data.actual_behavior}

## Reproduction Steps

${renderList(data.reproduction_steps, true)}

## Context

${renderList(data.context)}

## Evidence / Links

${renderList(data.evidence_links)}
`;
}

function renderFeature(data: IssueData): string {
  requireFields(data, FEATURE_FIELDS);

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

${renderList(data.context)}

## Evidence / Links

${renderList(data.evidence_links)}
`;
}

function render(data: IssueData): string {
  if (data.type === "bug") return renderBug(data);
  if (data.type === "feature") return renderFeature(data);
  throw new RenderError("type must be bug or feature");
}

async function main(argv: string[]): Promise<number> {
  if (argv.length !== 1 || argv.includes("-h") || argv.includes("--help")) {
    console.error("usage: bun scripts/render_issue.ts INPUT.yaml");
    return argv.length === 1 ? 0 : 2;
  }

  try {
    process.stdout.write(render(await loadInput(argv[0])));
    return 0;
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
