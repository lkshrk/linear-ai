import { readdir, readFile, writeFile, mkdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SKILLS_DIR = path.join(ROOT, "skills");
const REF_PREFIXES = ["agents", "docs", "templates", "scripts", "schemas", "examples"];
const REF_PATTERN = new RegExp(`(?:${REF_PREFIXES.join("|")})/[A-Za-z0-9_./-]+`, "g");

type Drift = { skill: string; file: string; reason: "missing" | "stale" | "orphan" };

function parseReferences(skillMd: string): Set<string> {
  const refs = new Set<string>();
  for (const match of skillMd.matchAll(REF_PATTERN)) refs.add(match[0]);
  return refs;
}

// Scripts assume the repo layout (sibling imports, ROOT-relative schema reads), so a
// referenced .ts needs its local deps copied alongside it to run from a skill bundle.
async function expandDeps(rel: string, seen: Set<string>): Promise<void> {
  if (seen.has(rel)) return;
  seen.add(rel);
  if (!rel.endsWith(".ts")) return;
  const content = await readFile(path.join(ROOT, rel), "utf8");
  for (const m of content.matchAll(/from\s+["']\.\/([A-Za-z0-9_.-]+)["']/g)) {
    const name = m[1].endsWith(".ts") ? m[1] : `${m[1]}.ts`;
    await expandDeps(path.posix.join(path.posix.dirname(rel), name), seen);
  }
  if (/\bschemas\b/.test(content)) {
    for (const f of await readdir(path.join(ROOT, "schemas"))) {
      if (f.endsWith(".yaml")) seen.add(path.posix.join("schemas", f));
    }
  }
}

async function resolveBundle(skillMd: string): Promise<string[]> {
  const seen = new Set<string>();
  for (const ref of parseReferences(skillMd)) {
    if (!existsSync(path.join(ROOT, ref))) continue;
    await expandDeps(ref, seen);
  }
  return [...seen].sort();
}

async function listManagedFiles(skillDir: string): Promise<string[]> {
  const out: string[] = [];
  for (const prefix of REF_PREFIXES) {
    const base = path.join(skillDir, prefix);
    if (!existsSync(base)) continue;
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(abs);
        else out.push(path.relative(skillDir, abs));
      }
    };
    await walk(base);
  }
  return out;
}

async function sync(check: boolean): Promise<number> {
  const drift: Drift[] = [];
  for (const name of (await readdir(SKILLS_DIR)).sort()) {
    const skillDir = path.join(SKILLS_DIR, name);
    if (!(await stat(skillDir)).isDirectory()) continue;
    const skillMdPath = path.join(skillDir, "SKILL.md");
    if (!existsSync(skillMdPath)) continue;

    const bundle = await resolveBundle(await readFile(skillMdPath, "utf8"));
    const wanted = new Set(bundle);

    for (const rel of bundle) {
      const src = await readFile(path.join(ROOT, rel), "utf8");
      const dest = path.join(skillDir, rel);
      if (check) {
        if (!existsSync(dest)) drift.push({ skill: name, file: rel, reason: "missing" });
        else if ((await readFile(dest, "utf8")) !== src) drift.push({ skill: name, file: rel, reason: "stale" });
      } else {
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, src);
      }
    }

    for (const rel of await listManagedFiles(skillDir)) {
      if (wanted.has(rel)) continue;
      if (!existsSync(path.join(ROOT, rel))) continue; // hand-authored skill file (e.g. agents/openai.yaml), not a copy
      if (check) drift.push({ skill: name, file: rel, reason: "orphan" });
      else await rm(path.join(skillDir, rel));
    }
  }

  if (check && drift.length) {
    process.stderr.write("Skill reference bundles out of sync:\n");
    for (const d of drift) process.stderr.write(`  ${d.reason}: ${d.skill}/${d.file}\n`);
    process.stderr.write("Run `bun scripts/sync_skill_references.ts` to fix.\n");
    return 1;
  }
  process.stdout.write(check ? "ok skill reference bundles in sync\n" : "synced skill reference bundles\n");
  return 0;
}

if (import.meta.main) {
  process.exitCode = await sync(process.argv.includes("--check"));
}
