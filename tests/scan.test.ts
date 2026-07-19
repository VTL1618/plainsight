import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { scan } from "../src/core/scan.js";

const fixtures = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../rules/PS2-hidden-content/unicode-tag-block/fixtures",
);

let dirs: string[] = [];

function tempTree(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "plainsight-scan-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe("scan", () => {
  it("finds hidden tag characters in a discovered skill, end to end", async () => {
    const root = tempTree();
    mkdirSync(path.join(root, "skills/changelog"), { recursive: true });
    copyFileSync(
      path.join(fixtures, "vulnerable.md"),
      path.join(root, "skills/changelog/SKILL.md"),
    );

    const result = await scan(root);
    expect(result.failures).toEqual([]);
    expect(result.findings).toHaveLength(1);

    const finding = result.findings[0];
    expect(finding).toMatchObject({
      ruleId: "PS2-unicode-tag-block",
      severity: "high",
      path: "skills/changelog/SKILL.md",
    });
    expect(finding?.detail).toContain("~/.ssh/id_ed25519");
    // The hidden run sits at the end of the "group in one sentence." line.
    expect(finding?.range.start.line).toBe(9);
    expect(finding?.range.start.column).toBe("group in one sentence.".length + 1);
  });

  it("stays quiet on a skill whose only tag characters are real flag emoji", async () => {
    const root = tempTree();
    mkdirSync(path.join(root, "skills/holidays"), { recursive: true });
    copyFileSync(path.join(fixtures, "safe.md"), path.join(root, "skills/holidays/SKILL.md"));

    const result = await scan(root);
    expect(result.findings).toEqual([]);
    expect(result.failures).toEqual([]);
  });

  it("surfaces unparseable skills as failures without dropping other findings", async () => {
    const root = tempTree();
    mkdirSync(path.join(root, "broken"));
    mkdirSync(path.join(root, "bad"));
    writeFileSync(path.join(root, "broken/SKILL.md"), "---\nname: a\nname: b\n---\nbody\n");
    copyFileSync(path.join(fixtures, "vulnerable.md"), path.join(root, "bad/SKILL.md"));

    const result = await scan(root);
    expect(result.findings).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ path: "broken/SKILL.md" });
    expect(result.failures[0]?.reason).toContain("not valid YAML");
  });

  it("refuses oversized artifacts instead of scanning them", async () => {
    const root = tempTree();
    mkdirSync(path.join(root, "big"));
    writeFileSync(path.join(root, "big/SKILL.md"), "x".repeat(2 * 1024 * 1024 + 1));

    const result = await scan(root);
    expect(result.findings).toEqual([]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.reason).toContain("scan limit");
  });
});
