import { readFile } from "node:fs/promises";

export type IssueSectionKey =
  | "goal"
  | "why"
  | "design"
  | "interfacesIn"
  | "interfacesOut"
  | "files"
  | "constraints"
  | "outOfScope"
  | "acceptance"
  | "tests"
  | "verify";

export type IssueErrorCode =
  | "missing_section"
  | "duplicate_section"
  | "unknown_section"
  | "empty_section"
  | "none_not_allowed"
  | "no_items"
  | "not_list_item"
  | "bad_path"
  | "no_link"
  | "no_commands";

export type IssueError = { code: IssueErrorCode; section?: string; message: string };

export type ParsedIssue = {
  sections: Record<IssueSectionKey, string>;
  designLinks: string[];
  files: string[];
  acceptance: string[];
  tests: string[];
  verify: string[];
};

export type IssueOptions = { allowNoDesign?: boolean };

export type IssueResult = { ok: true; issue: ParsedIssue } | { ok: false; errors: IssueError[] };

export const ISSUE_SECTIONS: readonly { key: IssueSectionKey; heading: string; none: boolean }[] = [
  { key: "goal", heading: "Goal", none: false },
  { key: "why", heading: "Why", none: false },
  { key: "design", heading: "Design excerpt", none: false },
  { key: "interfacesIn", heading: "Interfaces in", none: true },
  { key: "interfacesOut", heading: "Interfaces out", none: true },
  { key: "files", heading: "Files", none: false },
  { key: "constraints", heading: "Constraints", none: true },
  { key: "outOfScope", heading: "Out of scope", none: true },
  { key: "acceptance", heading: "Acceptance criteria", none: false },
  { key: "tests", heading: "Tests expected", none: false },
  { key: "verify", heading: "Verify", none: false },
];

const USAGE = "usage: bun scripts/validate_issue.ts FILE [--require-design]";
const NO_COMMANDS = "no commands (use a fenced block or one inline-code command per list item)";
const FENCE = /^\s{0,3}(```|~~~)/;
const LIST_ITEM = /^\s{0,3}(?:[-*+]|\d+[.)])\s+(.*)$/;
const NONE = /^none\.?$/i;
const LINK = /\]\((https?:\/\/[^)\s]+)\)|(?<!\()(https?:\/\/[^\s)>\]]+)/g;

type RawSection = { heading: string; lines: string[] };

function splitSections(description: string): RawSection[] {
  const text = description.replace(/<!--[\s\S]*?-->/g, "");
  const out: RawSection[] = [];
  let fence: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const marker = FENCE.exec(line)?.[1];
    if (marker && (fence === null || fence === marker)) fence = fence === null ? marker : null;
    const heading = fence === null && !marker ? /^## +(.+?)\s*#*\s*$/.exec(line)?.[1] : undefined;
    if (heading) out.push({ heading, lines: [] });
    else out.at(-1)?.lines.push(line);
  }
  return out;
}

function normalize(heading: string): string {
  return heading.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
}

function listItems(lines: readonly string[]): string[] {
  const items: string[] = [];
  let fence = false;
  for (const line of lines) {
    if (FENCE.test(line)) fence = !fence;
    const item = fence ? undefined : LIST_ITEM.exec(line)?.[1];
    if (item) items.push(item.replace(/^\[[ xX]\]\s+/, "").trim());
  }
  return items;
}

function fileEntry(item: string): string {
  return /^`([^`]+)`/.exec(item)?.[1]?.trim() ?? item.split(/\s+/)[0] ?? "";
}

function pathProblem(path: string): string | undefined {
  if (path.startsWith("/") || path.startsWith("~") || /^[A-Za-z]:[\\/]/.test(path)) return "is absolute";
  if (path.split(/[\\/]/).includes("..")) return "leaves the repository";
  return undefined;
}

function commands(lines: readonly string[]): string[] {
  const out: string[] = [];
  let fence = false;
  for (const line of lines) {
    if (FENCE.test(line)) {
      fence = !fence;
      continue;
    }
    const trimmed = line.trim();
    if (fence) {
      if (trimmed !== "" && !/^#(\s|$)/.test(trimmed)) out.push(trimmed);
      continue;
    }
    const code = /^`([^`]+)`$/.exec(LIST_ITEM.exec(line)?.[1]?.trim() ?? "")?.[1]?.trim();
    if (code) out.push(code);
  }
  return out;
}

export function validateIssue(description: string, opts: IssueOptions = {}): IssueResult {
  const errors: IssueError[] = [];
  const found = new Map<IssueSectionKey, string[]>();
  const byName = new Map(ISSUE_SECTIONS.map((s) => [s.heading.toLowerCase(), s]));

  for (const raw of splitSections(description)) {
    const def = byName.get(normalize(raw.heading));
    if (!def) {
      const name = raw.heading.trim();
      errors.push({ code: "unknown_section", section: name, message: `unknown section ## ${name}` });
    } else if (found.has(def.key)) {
      errors.push({ code: "duplicate_section", section: def.heading, message: `duplicate section ## ${def.heading}` });
    } else {
      found.set(def.key, raw.lines);
    }
  }
  for (const def of ISSUE_SECTIONS) {
    if (found.has(def.key)) continue;
    errors.push({ code: "missing_section", section: def.heading, message: `missing section ## ${def.heading}` });
  }

  const sections = Object.fromEntries(ISSUE_SECTIONS.map((s) => [s.key, ""])) as Record<IssueSectionKey, string>;
  const parsed: Omit<ParsedIssue, "sections"> = { designLinks: [], files: [], acceptance: [], tests: [], verify: [] };

  for (const def of ISSUE_SECTIONS) {
    const lines = found.get(def.key);
    if (!lines) continue;
    const fail = (code: IssueErrorCode, message: string) =>
      errors.push({ code, section: def.heading, message: `## ${def.heading}: ${message}` });
    const content = lines.join("\n").trim();
    if (content === "") {
      fail("empty_section", "empty");
      continue;
    }
    if (NONE.test(content)) {
      if (def.none || (def.key === "design" && opts.allowNoDesign)) continue;
      fail("none_not_allowed", "'none' is not allowed");
      continue;
    }
    sections[def.key] = content;

    if (def.key === "design") {
      parsed.designLinks = [...content.matchAll(LINK)].map((m) => m[1] ?? (m[2] ?? "").replace(/[.,;:]+$/, ""));
      if (parsed.designLinks.length === 0) fail("no_link", "no link to the design document");
    } else if (def.key === "files") {
      for (const line of lines) {
        if (line.trim() === "") continue;
        const item = LIST_ITEM.exec(line)?.[1];
        if (item === undefined) {
          fail("not_list_item", `'${line.trim()}' is not a list item`);
          continue;
        }
        const path = fileEntry(item.trim());
        const problem = pathProblem(path);
        if (problem) fail("bad_path", `'${path}' ${problem}`);
        else parsed.files.push(path);
      }
    } else if (def.key === "acceptance" || def.key === "tests") {
      const items = listItems(lines);
      if (items.length === 0) fail("no_items", "no list items");
      parsed[def.key] = items;
    } else if (def.key === "verify") {
      parsed.verify = commands(lines);
      if (parsed.verify.length === 0) fail("no_commands", NO_COMMANDS);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, issue: { sections, ...parsed } };
}

async function main(argv: string[]): Promise<number> {
  const file = argv.find((a) => !a.startsWith("--"));
  if (!file) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const result = validateIssue(await readFile(file, "utf8"), { allowNoDesign: !argv.includes("--require-design") });
  if (result.ok) {
    process.stdout.write(`${file}: valid issue\n`);
    return 0;
  }
  for (const error of result.errors) process.stdout.write(`${file}: ${error.message}\n`);
  return 1;
}

if (import.meta.main ?? process.argv[1]?.endsWith("validate_issue.ts")) {
  process.exit(await main(process.argv.slice(2)));
}
