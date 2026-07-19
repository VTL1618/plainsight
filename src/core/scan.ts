import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverArtifacts } from "./discover.js";
import { matchUnicodeRanges } from "./matchers/unicode-range.js";
import { parseSkill, type ParsedSkill } from "./parse/skill.js";
import { loadRules, type Rule } from "./rules.js";
import { buildLineIndex, positionAt } from "./text.js";
import type { Finding, ParseFailure } from "./types.js";

export interface ScanOptions {
  /** Defaults to the rules/ directory shipped with the package. */
  rulesDir?: string;
}

export interface ScanResult {
  findings: Finding[];
  /**
   * Artifacts that could not be parsed. These are part of the result, not a
   * log line: a file the scanner cannot parse is a file nobody has vetted.
   */
  failures: ParseFailure[];
}

/** Upper bound on artifact size. Scanned input is untrusted; a SKILL.md this large is itself suspect. */
export const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;

export async function scan(root: string, options: ScanOptions = {}): Promise<ScanResult> {
  const rules = await loadRules(options.rulesDir ?? defaultRulesDir());
  const refs = await discoverArtifacts(root);

  const findings: Finding[] = [];
  const failures: ParseFailure[] = [];

  for (const ref of refs) {
    const size = (await stat(ref.path)).size;
    if (size > MAX_ARTIFACT_BYTES) {
      failures.push({
        path: ref.relPath,
        reason: `file is ${String(size)} bytes, over the ${String(MAX_ARTIFACT_BYTES)} byte scan limit`,
      });
      continue;
    }

    const result = parseSkill(ref, await readFile(ref.path, "utf8"));
    if (!result.ok) {
      failures.push(result.failure);
      continue;
    }
    findings.push(...scanParsedSkill(result.skill, rules));
  }

  return { findings, failures };
}

/** Run every applicable rule against one parsed skill. Exported for the fixture tests. */
export function scanParsedSkill(skill: ParsedSkill, rules: Rule[]): Finding[] {
  const findings: Finding[] = [];
  const lineIndex = buildLineIndex(skill.source);

  for (const rule of rules) {
    if (!rule.targets.includes("skill")) continue;
    // Matchers scan the raw source, frontmatter included. Hidden characters
    // in a description field reach the model the same way body text does.
    for (const match of matchUnicodeRanges(skill.source, rule.matcher)) {
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: rule.description,
        path: skill.ref.relPath,
        range: {
          start: positionAt(lineIndex, match.start),
          end: positionAt(lineIndex, match.end),
        },
        detail: `hidden text decodes to: ${match.detail}`,
      });
    }
  }

  return findings;
}

function defaultRulesDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../rules");
}
