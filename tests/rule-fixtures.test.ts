import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadRules, type Rule } from "../src/core/rules.js";
import { scanArtifact } from "../src/core/scan.js";
import type { ArtifactRef } from "../src/core/types.js";

/**
 * Auto-discovering fixture harness. Every rule ships with a vulnerable
 * fixture that must fire and a safe fixture that must not; adding a rule
 * requires zero changes here.
 */

const rulesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../rules");
const rules = await loadRules(rulesDir);

function fixtureDir(rule: Rule): string {
  const prefix = rule.category.split("-")[0] ?? "";
  const slug = rule.id.slice(prefix.length + 1);
  return path.join(rulesDir, rule.category, slug, "fixtures");
}

function scanFixture(rule: Rule, name: "vulnerable.md" | "safe.md") {
  const file = path.join(fixtureDir(rule), name);
  const ref: ArtifactRef = { type: "skill", path: file, relPath: name };
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
      expect(existsSync(path.join(fixtureDir(rule), "vulnerable.md"))).toBe(true);
      expect(existsSync(path.join(fixtureDir(rule), "safe.md"))).toBe(true);
    });

    it("flags the vulnerable fixture", () => {
      expect(scanFixture(rule, "vulnerable.md").length).toBeGreaterThan(0);
    });

    it("stays quiet on the safe fixture", () => {
      expect(scanFixture(rule, "safe.md")).toEqual([]);
    });
  });
}
