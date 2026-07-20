import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverArtifacts } from "./discover.js";
import { runMatcher, type MatcherContext } from "./matchers/index.js";
import { parseSkill } from "./parse/skill.js";
import { loadRules, type Rule } from "./rules.js";
import { buildLineIndex, positionAt } from "./text.js";
import type { ArtifactRef, Finding, ParseFailure } from "./types.js";

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
  /** The rules the scan ran, so reporters can look up prose and help URIs by ruleId. */
  rules: Rule[];
  /** Number of artifacts discovered and scanned, for the report summary. */
  scanned: number;
}

export interface ArtifactScanResult {
  findings: Finding[];
  failure?: ParseFailure;
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

    const result = scanArtifact(ref, await readFile(ref.path, "utf8"), rules);
    findings.push(...result.findings);
    if (result.failure) failures.push(result.failure);
  }

  return { findings, failures, rules, scanned: refs.length };
}

/**
 * Scan one artifact. Parsing always runs and its outcome always travels back
 * in the result, but matchers do not wait on it: raw matchers read the file
 * source directly, so a file whose frontmatter refuses to parse still has
 * every byte searched for hidden content. A deliberately broken frontmatter
 * block must never exempt the rest of the file from scanning, which is the
 * parser-differential bypass this tool exists to catch. Structured matchers
 * read the parsed skill and produce nothing when parsing failed.
 */
export function scanArtifact(ref: ArtifactRef, source: string, rules: Rule[]): ArtifactScanResult {
  const parsed = parseSkill(ref, source);
  const context: MatcherContext = { source, skill: parsed.ok ? parsed.skill : null };
  const lineIndex = buildLineIndex(source);

  const findings: Finding[] = [];
  for (const rule of rules) {
    if (!rule.targets.includes(ref.type)) continue;
    for (const match of runMatcher(context, rule.matcher)) {
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        path: ref.relPath,
        range: {
          start: positionAt(lineIndex, match.start),
          end: positionAt(lineIndex, match.end),
        },
        detail: match.detail,
      });
    }
  }

  if (!parsed.ok) return { findings, failure: parsed.failure };
  return { findings };
}

function defaultRulesDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../rules");
}
