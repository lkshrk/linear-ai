import { readFile } from "node:fs/promises";

class MetadataError extends Error {}

const REQUIRED_TYPE_LABELS = ["Bug", "Feature", "Improvement"];
const REQUIRED_LLM_LABELS = ["llm-active", "llm-blocked", "llm-ready", "llm-refine", "llm-review", "llm-split"];

type LinearTeam = {
  name?: unknown;
};

type LinearLabel = {
  name?: unknown;
  parent?: unknown;
};

type LinearProject = {
  name?: unknown;
  teams?: LinearTeam[];
};

type LinearMetadata = {
  teams?: LinearTeam[];
  projects?: LinearProject[];
  labels?: LinearLabel[];
};

type Args = {
  command?: string;
  metadata?: string;
  teams?: string;
  projects?: string;
  labels?: string;
  targetTeam?: string;
  targetProject?: string;
  componentTag?: string;
  selectedLabels?: string;
  typeLabel?: string;
  llmLabel?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { command: argv[0] };
  for (let index = 1; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!value) throw new MetadataError(`missing value for ${key}`);
    index += 1;

    switch (key) {
      case "--metadata":
        args.metadata = value;
        break;
      case "--teams":
        args.teams = value;
        break;
      case "--projects":
        args.projects = value;
        break;
      case "--labels":
        args.labels = value;
        break;
      case "--target-team":
        args.targetTeam = value;
        break;
      case "--target-project":
        args.targetProject = value;
        break;
      case "--component-tag":
        args.componentTag = value;
        break;
      case "--selected-labels":
        args.selectedLabels = value;
        break;
      case "--type-label":
        args.typeLabel = value;
        break;
      case "--llm-label":
        args.llmLabel = value;
        break;
      default:
        throw new MetadataError(`unknown argument ${key}`);
    }
  }
  return args;
}

function names(values: { name?: unknown }[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.name).filter((name): name is string => typeof name === "string"))].sort();
}

function labelsByParent(metadata: LinearMetadata, parent: string): string[] {
  return names((metadata.labels ?? []).filter((label) => label.parent === parent));
}

function allLabels(metadata: LinearMetadata): string[] {
  return names(metadata.labels);
}

function selectedLabels(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
}

async function loadMetadata(path: string | undefined): Promise<LinearMetadata> {
  if (!path) throw new MetadataError("--metadata is required");
  const data = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new MetadataError("metadata must be a JSON object");
  }
  return data as LinearMetadata;
}

async function loadJson(path: string | undefined, flag: string): Promise<unknown> {
  if (!path) throw new MetadataError(`${flag} is required`);
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function objectValuesForKey(data: unknown, key: "teams" | "projects" | "labels"): unknown[] {
  if (Array.isArray(data)) {
    return data.flatMap((entry) => objectValuesForKey(entry, key));
  }
  if (data && typeof data === "object") {
    const value = (data as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value;
    if ("name" in data) return [data];
  }
  return [];
}

function compactTeams(data: unknown): LinearTeam[] {
  return objectValuesForKey(data, "teams").flatMap((team) => {
    if (!team || typeof team !== "object") return [];
    const name = (team as LinearTeam).name;
    return typeof name === "string" ? [{ name }] : [];
  });
}

function compactProjects(data: unknown): LinearProject[] {
  return objectValuesForKey(data, "projects").flatMap((project) => {
    if (!project || typeof project !== "object") return [];
    const value = project as LinearProject;
    if (typeof value.name !== "string") return [];
    return [{ name: value.name, teams: compactTeams(value.teams) }];
  });
}

function compactLabels(data: unknown): LinearLabel[] {
  return objectValuesForKey(data, "labels").flatMap((label) => {
    if (!label || typeof label !== "object") return [];
    const value = label as LinearLabel;
    if (typeof value.name !== "string" || typeof value.parent !== "string") return [];
    return [{ name: value.name, parent: value.parent }];
  });
}

function uniqueByName<T extends { name?: unknown }>(values: T[]): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (typeof value.name !== "string" || seen.has(value.name)) return false;
    seen.add(value.name);
    return true;
  });
}

export async function captureMetadata(args: Args): Promise<LinearMetadata> {
  return {
    teams: uniqueByName(compactTeams(await loadJson(args.teams, "--teams"))),
    projects: uniqueByName(compactProjects(await loadJson(args.projects, "--projects"))),
    labels: uniqueByName(compactLabels(await loadJson(args.labels, "--labels")))
  };
}

export function summarize(metadata: LinearMetadata): Record<string, string[]> {
  return {
    teams: names(metadata.teams),
    projects: names(metadata.projects),
    labels: allLabels(metadata),
    component_tags: labelsByParent(metadata, "Component"),
    type_labels: labelsByParent(metadata, "Type"),
    llm_labels: labelsByParent(metadata, "LLM")
  };
}

export function validateMetadata(metadata: LinearMetadata, args: Args): string[] {
  const summary = summarize(metadata);
  const errors: string[] = [];

  if (args.targetTeam && !summary.teams.includes(args.targetTeam)) {
    errors.push(`target team ${args.targetTeam} is not an available Linear team`);
  }
  if (args.targetProject && !summary.projects.includes(args.targetProject)) {
    errors.push(`target project ${args.targetProject} is not an available Linear project`);
  }
  if (args.componentTag && !summary.component_tags.includes(args.componentTag)) {
    errors.push(`component tag ${args.componentTag} is not an available Component label`);
  }
  for (const label of selectedLabels(args.selectedLabels)) {
    if (!summary.labels.includes(label)) errors.push(`selected label ${label} is not an available Linear label`);
  }
  if (args.typeLabel && !summary.type_labels.includes(args.typeLabel)) {
    errors.push(`type label ${args.typeLabel} is not an available Type label`);
  }
  if (args.llmLabel && !summary.llm_labels.includes(args.llmLabel)) {
    errors.push(`llm label ${args.llmLabel} is not an available LLM label`);
  }

  return errors;
}

export function metadataWarnings(metadata: LinearMetadata): string[] {
  const summary = summarize(metadata);
  const warnings: string[] = [];

  if (summary.teams.length === 0) warnings.push("warning: no Linear teams found");
  if (summary.projects.length === 0) warnings.push("warning: no Linear projects found");
  if (summary.type_labels.length === 0) warnings.push("warning: no Type labels found");
  if (summary.llm_labels.length === 0) warnings.push("warning: no LLM labels found");

  const missingTypeLabels = REQUIRED_TYPE_LABELS.filter((label) => !summary.type_labels.includes(label));
  if (summary.type_labels.length > 0 && missingTypeLabels.length > 0) {
    warnings.push(`warning: missing Type labels: ${missingTypeLabels.join(", ")}`);
  }

  const missingLlmLabels = REQUIRED_LLM_LABELS.filter((label) => !summary.llm_labels.includes(label));
  if (summary.llm_labels.length > 0 && missingLlmLabels.length > 0) {
    warnings.push(`warning: missing LLM labels: ${missingLlmLabels.join(", ")}`);
  }

  return warnings;
}

async function main(argv: string[]): Promise<number> {
  try {
    const args = parseArgs(argv);

    if (args.command === "capture") {
      const metadata = await captureMetadata(args);
      const warnings = metadataWarnings(metadata);
      if (warnings.length > 0) process.stderr.write(`${warnings.join("\n")}\n`);
      process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
      return 0;
    }

    const metadata = await loadMetadata(args.metadata);

    if (args.command === "summary") {
      process.stdout.write(`${JSON.stringify(summarize(metadata), null, 2)}\n`);
      return 0;
    }

    if (args.command === "validate") {
      const errors = validateMetadata(metadata, args);
      if (errors.length > 0) {
        process.stderr.write(`${errors.join("\n")}\n`);
        return 1;
      }
      process.stdout.write("ok Linear metadata\n");
      return 0;
    }

    throw new MetadataError("usage: bun scripts/linear_metadata.ts summary|validate --metadata metadata.json [--target-team TEAM --target-project PROJECT --selected-labels LABEL[,LABEL...] --type-label LABEL --llm-label LABEL]\n       bun scripts/linear_metadata.ts capture --teams teams.json --projects projects.json --labels labels.json");
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
