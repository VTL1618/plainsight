import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { ruleSchema, type RuleDefinition } from "../schema/rule.js";

/**
 * Rule files are trusted repo content (they ship with the package), unlike
 * scanned artifacts, so a malformed rule throws with a message aimed at the
 * rule's author.
 */

export type Rule = RuleDefinition;

export async function loadRules(rulesDir: string): Promise<Rule[]> {
  const rules: Rule[] = [];
  for (const categoryDir of await listDirs(rulesDir)) {
    for (const ruleDir of await listDirs(path.join(rulesDir, categoryDir))) {
      rules.push(await loadRule(rulesDir, categoryDir, ruleDir));
    }
  }
  rules.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return rules;
}

async function loadRule(rulesDir: string, categoryDir: string, ruleDir: string): Promise<Rule> {
  const rulePath = path.join(rulesDir, categoryDir, ruleDir, "rule.yaml");

  let data: unknown;
  try {
    data = YAML.parse(await readFile(rulePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    throw new Error(`${rulePath}: not valid YAML: ${message ?? "unknown error"}`);
  }

  const parsed = ruleSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(top level)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`${rulePath}: invalid rule\n${issues}`);
  }
  const rule = parsed.data;

  // The ID is a permanent public contract (SARIF, baseline files), so drift
  // between a rule's location and its ID is an error, not a warning.
  const prefix = categoryDir.split("-")[0] ?? categoryDir;
  const expectedId = `${prefix}-${ruleDir}`;
  if (rule.id !== expectedId) {
    throw new Error(`${rulePath}: id "${rule.id}" must match its directory ("${expectedId}")`);
  }
  if (rule.category !== categoryDir) {
    throw new Error(
      `${rulePath}: category "${rule.category}" must match its directory ("${categoryDir}")`,
    );
  }

  return rule;
}

async function listDirs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}
