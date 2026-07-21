import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadRules, type Rule } from "../src/core/rules.js";
import { scanArtifact } from "../src/core/scan.js";
import type { ArtifactRef, ArtifactType } from "../src/core/types.js";

/**
 * Auto-discovering fixture harness. Every rule ships with a vulnerable
 * fixture that must fire and a safe fixture that must not; adding a rule
 * requires zero changes here. A rule's first target picks the fixture kind:
 * skill rules use .md fixtures, MCP rules use .json.
 */

const rulesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../rules");
const rules = await loadRules(rulesDir);

const FIXTURE_EXT: Record<ArtifactType, string> = {
  skill: "md",
  "mcp-config": "json",
  "marketplace-manifest": "json",
};

function fixtureType(rule: Rule): ArtifactType {
  return rule.targets[0] ?? "skill";
}

function fixtureDir(rule: Rule): string {
  const prefix = rule.category.split("-")[0] ?? "";
  const slug = rule.id.slice(prefix.length + 1);
  return path.join(rulesDir, rule.category, slug, "fixtures");
}

function fixtureName(rule: Rule, kind: "vulnerable" | "safe"): string {
  return `${kind}.${FIXTURE_EXT[fixtureType(rule)]}`;
}

function scanFixture(rule: Rule, kind: "vulnerable" | "safe") {
  const name = fixtureName(rule, kind);
  const file = path.join(fixtureDir(rule), name);
  const ref: ArtifactRef = { type: fixtureType(rule), path: file, relPath: name };
  const result = scanArtifact(ref, readFileSync(file, "utf8"), [rule]);
  expect(result.failure, `${rule.id}: fixture ${name} must parse`).toBeUndefined();
  return result.findings.filter((f) => f.ruleId === rule.id);
}

it("discovers at least one rule", () => {
  expect(rules.length).toBeGreaterThan(0);
});

for (const rule of rules) {
  describe(rule.id, () => {
    it("ships both fixtures", () => {
      expect(existsSync(path.join(fixtureDir(rule), fixtureName(rule, "vulnerable")))).toBe(true);
      expect(existsSync(path.join(fixtureDir(rule), fixtureName(rule, "safe")))).toBe(true);
    });

    it("flags the vulnerable fixture", () => {
      expect(scanFixture(rule, "vulnerable").length).toBeGreaterThan(0);
    });

    it("stays quiet on the safe fixture", () => {
      expect(scanFixture(rule, "safe")).toEqual([]);
    });
  });
}
