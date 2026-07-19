import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadRules } from "../src/core/rules.js";

let dirs: string[] = [];

function tempRules(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "plainsight-rules-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

const validRule = `id: PS2-demo-rule
category: PS2-hidden-content
severity: high
title: Demo
description: Demo description.
rationale: Demo rationale.
remediation: Demo remediation.
references:
  - https://example.com/reference
targets:
  - skill
matcher:
  type: unicode-range
  ranges:
    - from: U+E0000
      to: U+E007F
`;

function writeRule(root: string, category: string, slug: string, yaml: string): void {
  const dir = path.join(root, category, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "rule.yaml"), yaml);
}

describe("loadRules", () => {
  it("loads a valid rule and resolves codepoints", async () => {
    const root = tempRules();
    writeRule(root, "PS2-hidden-content", "demo-rule", validRule);

    const rules = await loadRules(root);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      id: "PS2-demo-rule",
      severity: "high",
      matcher: { type: "unicode-range", ranges: [{ from: 0xe0000, to: 0xe007f }] },
    });
  });

  it("rejects a rule whose id does not match its directory", async () => {
    const root = tempRules();
    writeRule(root, "PS2-hidden-content", "other-slug", validRule);

    await expect(loadRules(root)).rejects.toThrow('must match its directory ("PS2-other-slug")');
  });

  it("rejects unknown fields with a message naming the field", async () => {
    const root = tempRules();
    writeRule(root, "PS2-hidden-content", "demo-rule", `${validRule}sevrity: high\n`);

    await expect(loadRules(root)).rejects.toThrow(/sevrity/);
  });

  it("rejects a missing required field with a readable message", async () => {
    const root = tempRules();
    writeRule(
      root,
      "PS2-hidden-content",
      "demo-rule",
      validRule.replace("remediation: Demo remediation.\n", ""),
    );

    await expect(loadRules(root)).rejects.toThrow(/remediation/);
  });

  it("rejects a malformed codepoint", async () => {
    const root = tempRules();
    writeRule(
      root,
      "PS2-hidden-content",
      "demo-rule",
      validRule.replace("from: U+E0000", "from: E0000"),
    );

    await expect(loadRules(root)).rejects.toThrow(/U\+E0000/);
  });

  it("rejects an inverted range", async () => {
    const root = tempRules();
    writeRule(
      root,
      "PS2-hidden-content",
      "demo-rule",
      validRule.replace("from: U+E0000", "from: U+F0000"),
    );

    await expect(loadRules(root)).rejects.toThrow(/range start exceeds its end/);
  });

  it("rejects invalid YAML with the file path in the message", async () => {
    const root = tempRules();
    writeRule(root, "PS2-hidden-content", "demo-rule", "id: [unclosed\n");

    await expect(loadRules(root)).rejects.toThrow(/rule\.yaml: not valid YAML/);
  });
});
