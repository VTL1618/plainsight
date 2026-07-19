import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverArtifacts } from "../src/core/discover.js";

let dirs: string[] = [];

function tempTree(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "plainsight-discover-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe("discoverArtifacts", () => {
  it("finds SKILL.md files at any depth and reports relative paths", async () => {
    const root = tempTree();
    mkdirSync(path.join(root, "skills/changelog"), { recursive: true });
    mkdirSync(path.join(root, "deep/a/b"), { recursive: true });
    writeFileSync(path.join(root, "skills/changelog/SKILL.md"), "# x\n");
    writeFileSync(path.join(root, "deep/a/b/SKILL.md"), "# y\n");
    writeFileSync(path.join(root, "README.md"), "# not a skill\n");

    const refs = await discoverArtifacts(root);
    expect(refs.map((r) => r.relPath)).toEqual([
      "deep/a/b/SKILL.md",
      "skills/changelog/SKILL.md",
    ]);
    expect(refs.every((r) => r.type === "skill")).toBe(true);
    expect(refs.every((r) => path.isAbsolute(r.path))).toBe(true);
  });

  it("requires the exact name SKILL.md", async () => {
    const root = tempTree();
    mkdirSync(path.join(root, "s"));
    writeFileSync(path.join(root, "s/skill.md"), "# x\n");
    writeFileSync(path.join(root, "s/SKILL.markdown"), "# x\n");

    // On case-insensitive filesystems (macOS default) skill.md and SKILL.md
    // collide, so only assert that no extra names slip through.
    const refs = await discoverArtifacts(root);
    for (const ref of refs) expect(ref.relPath.endsWith("/SKILL.md")).toBe(true);
    expect(refs.length).toBeLessThanOrEqual(1);
  });

  it("skips .git and node_modules", async () => {
    const root = tempTree();
    mkdirSync(path.join(root, ".git/hooks"), { recursive: true });
    mkdirSync(path.join(root, "node_modules/evil"), { recursive: true });
    writeFileSync(path.join(root, ".git/hooks/SKILL.md"), "# x\n");
    writeFileSync(path.join(root, "node_modules/evil/SKILL.md"), "# x\n");

    expect(await discoverArtifacts(root)).toEqual([]);
  });

  it("never follows symlinks", async () => {
    const root = tempTree();
    const outside = tempTree();
    mkdirSync(path.join(outside, "trap"));
    writeFileSync(path.join(outside, "trap/SKILL.md"), "# outside\n");
    writeFileSync(path.join(outside, "SKILL.md"), "# outside file\n");
    symlinkSync(path.join(outside, "trap"), path.join(root, "linked-dir"));
    symlinkSync(path.join(outside, "SKILL.md"), path.join(root, "SKILL.md"));

    expect(await discoverArtifacts(root)).toEqual([]);
  });

  it("stops at the depth bound", async () => {
    const root = tempTree();
    let dir = root;
    for (let i = 0; i < 5; i++) {
      dir = path.join(dir, `d${String(i)}`);
      mkdirSync(dir);
    }
    writeFileSync(path.join(dir, "SKILL.md"), "# deep\n");

    expect(await discoverArtifacts(root, { maxDepth: 3 })).toEqual([]);
    expect(await discoverArtifacts(root, { maxDepth: 10 })).toHaveLength(1);
  });
});
