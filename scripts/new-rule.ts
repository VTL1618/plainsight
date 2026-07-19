/**
 * Scaffold a new rule: directory, rule.yaml template, both fixture stubs.
 *
 *   npm run new-rule -- PS2-hidden-content/my-rule-slug
 *
 * The scaffold is schema-valid on purpose, so the fixture tests pick the new
 * rule up immediately and stay red until the rule actually detects something.
 * That failing test is the to-do list.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const spec = process.argv[2];
const usage = "usage: npm run new-rule -- <category>/<slug>   e.g. PS2-hidden-content/my-rule";

if (spec === undefined || !/^PS[1-6]-[a-z]+(-[a-z]+)*\/[a-z0-9]+(-[a-z0-9]+)*$/.test(spec)) {
  console.error(usage);
  process.exit(1);
}

const [category, slug] = spec.split("/") as [string, string];
const prefix = category.split("-")[0] ?? "";
const id = `${prefix}-${slug}`;
const rulesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../rules");
const ruleDir = path.join(rulesDir, category, slug);

if (existsSync(ruleDir)) {
  console.error(`${ruleDir} already exists`);
  process.exit(1);
}

const ruleYaml = `id: ${id}
category: ${category}
severity: medium
title: One line naming what this rule finds
description: >-
  One or two plain sentences. What is this pattern, and what does an attacker
  get from it? Written for a reader who is not a security engineer.
rationale: >-
  Why this pattern matters and where the line sits between malicious and
  legitimate use. This is what "explain" shows when someone asks about a
  finding.
remediation: >-
  What the author of a flagged file should actually do about it.
references:
  - https://example.com/replace-with-a-real-reference
targets:
  - skill
matcher:
  type: unicode-range
  ranges:
    - from: U+0000
      to: U+0000
`;

const vulnerable = `---
name: replace-me
description: A realistic skill that carries the pattern this rule detects.
---

# Replace this fixture

Make this look like a real skill a person might approve, with the malicious
pattern embedded the way an attacker would embed it. The test suite requires
this file to produce a finding.
`;

const safe = `---
name: replace-me-safe
description: A realistic, benign skill that superficially resembles the attack.
---

# Replace this fixture

Make this the closest legitimate cousin of the vulnerable fixture. The test
suite requires this file to produce no finding; if you cannot write it, the
rule is too broad to ship.
`;

await mkdir(path.join(ruleDir, "fixtures"), { recursive: true });
await writeFile(path.join(ruleDir, "rule.yaml"), ruleYaml);
await writeFile(path.join(ruleDir, "fixtures", "vulnerable.md"), vulnerable);
await writeFile(path.join(ruleDir, "fixtures", "safe.md"), safe);

console.log(`scaffolded ${path.relative(process.cwd(), ruleDir)}`);
console.log(`rule id: ${id}`);
console.log("next: fill in rule.yaml and both fixtures, then run npm test.");
console.log("the fixture tests fail until the rule detects the vulnerable fixture.");
