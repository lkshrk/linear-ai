import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const SKILLS = ["linear-implement", "linear-intake", "linear-reconcile", "linear-refine", "linear-review", "linear-status"];
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? walk(rel) : rel.endsWith(".md") ? [rel] : [];
  });
}

describe("skills contract", () => {
  test("exactly the six v2 skills exist, each with a matching name and a description", () => {
    const dirs = readdirSync(path.join(ROOT, "skills")).filter((d) => existsSync(path.join(ROOT, "skills", d, "SKILL.md")));
    expect(dirs.sort()).toEqual(SKILLS);
    for (const skill of SKILLS) {
      const md = read(`skills/${skill}/SKILL.md`);
      expect(md).toMatch(new RegExp(`^---\\nname: ${skill}\\n`));
      expect(md).toMatch(/\ndescription: ".{60,}"\n/);
    }
  });

  test("every comment marker a skill writes is documented in the workflow", () => {
    const workflow = read("docs/workflow.md");
    for (const skill of SKILLS) {
      for (const marker of read(`skills/${skill}/SKILL.md`).matchAll(/<!-- linear-ai:([a-z-]+) -->/g)) {
        expect(workflow).toContain(`<!-- linear-ai:${marker[1]} -->`);
      }
    }
  });

  test("no v1 workflow constructs outside the migration sections", () => {
    const allowed = new Set(["skills/linear-status/SKILL.md", "README.md"]);
    const files = [...walk("docs").filter((f) => !f.startsWith("docs/superpowers")), ...SKILLS.map((s) => `skills/${s}/SKILL.md`), "README.md", "memory/project-facts.md"];
    const v1 = /\bllm-(refine|ready|active|blocked|review)\b|\bin-use\b|dashboard block|REQUIRED_LINEAR_MUTATIONS|plan_status|nontechnical-intake/;
    const hits = files.filter((f) => !allowed.has(f) && !f.includes("/skills/") && v1.test(read(f)));
    expect(hits).toEqual([]);
  });
});
