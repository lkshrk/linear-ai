import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { test } from "bun:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const SKILLS_DIR = path.join(ROOT, "skills");
const REF_PREFIXES = ["agents", "docs", "templates", "scripts", "schemas", "examples"];
const REF_PATTERN = new RegExp(`(?:${REF_PREFIXES.join("|")})/[A-Za-z0-9_./-]+`, "g");

async function skillNames(): Promise<string[]> {
  const out: string[] = [];
  for (const name of (await readdir(SKILLS_DIR)).sort()) {
    const dir = path.join(SKILLS_DIR, name);
    if ((await stat(dir)).isDirectory() && existsSync(path.join(dir, "SKILL.md"))) out.push(name);
  }
  return out;
}

function referencesIn(skillMd: string): string[] {
  return [...new Set([...skillMd.matchAll(REF_PATTERN)].map((m) => m[0]))]
    .filter((rel) => existsSync(path.join(ROOT, rel)))
    .sort();
}

function runScript(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("bun", ["scripts/sync_skill_references.ts", ...args], { cwd: ROOT });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });
}

test("every SKILL.md reference is bundled into the skill dir with matching content", async () => {
  for (const name of await skillNames()) {
    const skillDir = path.join(SKILLS_DIR, name);
    const refs = referencesIn(await readFile(path.join(skillDir, "SKILL.md"), "utf8"));
    for (const rel of refs) {
      const bundled = path.join(skillDir, rel);
      assert.ok(existsSync(bundled), `${name} is missing bundled reference ${rel}`);
      assert.equal(
        await readFile(bundled, "utf8"),
        await readFile(path.join(ROOT, rel), "utf8"),
        `${name}/${rel} is out of sync with the repo-root source`
      );
    }
  }
});

test("bundled scripts carry their runtime dependencies", async () => {
  for (const name of await skillNames()) {
    const skillDir = path.join(SKILLS_DIR, name);
    const refs = referencesIn(await readFile(path.join(skillDir, "SKILL.md"), "utf8"));
    for (const rel of refs.filter((r) => r.endsWith(".ts"))) {
      const src = await readFile(path.join(skillDir, rel), "utf8");
      for (const m of src.matchAll(/from\s+["']\.\/([A-Za-z0-9_.-]+)["']/g)) {
        const dep = m[1].endsWith(".ts") ? m[1] : `${m[1]}.ts`;
        const depRel = path.posix.join(path.posix.dirname(rel), dep);
        assert.ok(existsSync(path.join(skillDir, depRel)), `${name}/${rel} import ${depRel} is not bundled`);
      }
      if (/\bschemas\b/.test(src)) {
        const schemaDir = path.join(skillDir, "schemas");
        assert.ok(existsSync(schemaDir), `${name}/${rel} reads schemas but none are bundled`);
        assert.ok((await readdir(schemaDir)).some((f) => f.endsWith(".yaml")), `${name} has no bundled schema yaml`);
      }
    }
  }
});

test("the hand-authored agents/openai.yaml interface file survives sync", async () => {
  for (const name of await skillNames()) {
    assert.ok(
      existsSync(path.join(SKILLS_DIR, name, "agents", "openai.yaml")),
      `${name} lost its agents/openai.yaml interface file`
    );
  }
});

test("sync --check passes, proving committed bundles are not stale", async () => {
  const { code, stderr } = await runScript(["--check"]);
  assert.equal(code, 0, `sync --check failed:\n${stderr}`);
});
