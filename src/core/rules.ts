import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { CodepointRange, UnicodeRangeConfig } from "./matchers/unicode-range.js";
import type { ArtifactType, Severity } from "./types.js";

/**
 * Minimal rule loading for Phase 1: enough validation to fail loudly on a
 * malformed rule. Phase 2 replaces the hand checks with a Zod schema and a
 * generalized matcher registry. Rule files are trusted repo content (they
 * ship with the package), unlike scanned artifacts, so throwing here is fine.
 */

export interface Rule {
  id: string;
  category: string;
  severity: Severity;
  title: string;
  description: string;
  rationale: string;
  remediation: string;
  references: string[];
  targets: ArtifactType[];
  matcher: UnicodeRangeConfig;
}

const SEVERITIES: readonly Severity[] = ["critical", "high", "medium", "low"];
const ARTIFACT_TYPES: readonly ArtifactType[] = ["skill"];

export async function loadRules(rulesDir: string): Promise<Rule[]> {
  const rules: Rule[] = [];
  for (const categoryDir of await listDirs(rulesDir)) {
    for (const ruleDir of await listDirs(path.join(rulesDir, categoryDir))) {
      const rulePath = path.join(rulesDir, categoryDir, ruleDir, "rule.yaml");
      const raw = await readFile(rulePath, "utf8");
      rules.push(parseRule(YAML.parse(raw), categoryDir, ruleDir, rulePath));
    }
  }
  rules.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return rules;
}

async function listDirs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function parseRule(data: unknown, categoryDir: string, ruleDir: string, rulePath: string): Rule {
  if (typeof data !== "object" || data === null) {
    throw new Error(`${rulePath}: rule.yaml must be a YAML map`);
  }
  const record = data as Record<string, unknown>;

  const id = requireString(record, "id", rulePath);
  // Rule IDs are `<category prefix>-<directory slug>` and must match the
  // rule's location. The ID is a permanent public contract (SARIF, baseline
  // files), so drift between path and ID is an error, not a warning.
  const prefix = categoryDir.split("-")[0] ?? categoryDir;
  const expectedId = `${prefix}-${ruleDir}`;
  if (id !== expectedId) {
    throw new Error(`${rulePath}: id "${id}" must match its directory ("${expectedId}")`);
  }

  const category = requireString(record, "category", rulePath);
  if (category !== categoryDir) {
    throw new Error(`${rulePath}: category "${category}" must match its directory ("${categoryDir}")`);
  }

  const severity = requireString(record, "severity", rulePath);
  if (!SEVERITIES.includes(severity as Severity)) {
    throw new Error(`${rulePath}: severity must be one of ${SEVERITIES.join(", ")}`);
  }

  const targets = requireStringArray(record, "targets", rulePath);
  for (const target of targets) {
    if (!ARTIFACT_TYPES.includes(target as ArtifactType)) {
      throw new Error(`${rulePath}: unknown target "${target}"`);
    }
  }

  return {
    id,
    category,
    severity: severity as Severity,
    title: requireString(record, "title", rulePath),
    description: requireString(record, "description", rulePath).trim(),
    rationale: requireString(record, "rationale", rulePath).trim(),
    remediation: requireString(record, "remediation", rulePath).trim(),
    references: requireStringArray(record, "references", rulePath),
    targets: targets as ArtifactType[],
    matcher: parseMatcher(record.matcher, rulePath),
  };
}

function parseMatcher(data: unknown, rulePath: string): UnicodeRangeConfig {
  if (typeof data !== "object" || data === null) {
    throw new Error(`${rulePath}: matcher must be a map`);
  }
  const record = data as Record<string, unknown>;
  if (record.type !== "unicode-range") {
    throw new Error(`${rulePath}: unknown matcher type ${JSON.stringify(record.type)}`);
  }
  const rawRanges = record.ranges;
  if (!Array.isArray(rawRanges) || rawRanges.length === 0) {
    throw new Error(`${rulePath}: matcher.ranges must be a non-empty list`);
  }
  const ranges: CodepointRange[] = rawRanges.map((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`${rulePath}: each range needs from and to`);
    }
    const range = entry as Record<string, unknown>;
    const from = parseCodepoint(range.from, rulePath);
    const to = parseCodepoint(range.to, rulePath);
    if (from > to) throw new Error(`${rulePath}: range from exceeds to`);
    return { from, to };
  });

  const allow = record.allow;
  if (allow !== undefined && allow !== "rgi-emoji-tag-sequences") {
    throw new Error(`${rulePath}: unknown allow list ${JSON.stringify(allow)}`);
  }

  return {
    type: "unicode-range",
    ranges,
    ...(allow !== undefined ? { allow: "rgi-emoji-tag-sequences" as const } : {}),
  };
}

function parseCodepoint(value: unknown, rulePath: string): number {
  if (typeof value !== "string" || !/^U\+[0-9A-Fa-f]{4,6}$/.test(value)) {
    throw new Error(`${rulePath}: codepoints use the form U+E0000, got ${JSON.stringify(value)}`);
  }
  return Number.parseInt(value.slice(2), 16);
}

function requireString(record: Record<string, unknown>, key: string, rulePath: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${rulePath}: "${key}" must be a non-empty string`);
  }
  return value;
}

function requireStringArray(record: Record<string, unknown>, key: string, rulePath: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || !value.every((v): v is string => typeof v === "string")) {
    throw new Error(`${rulePath}: "${key}" must be a list of strings`);
  }
  return value;
}
