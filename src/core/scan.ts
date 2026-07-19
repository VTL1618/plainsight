import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverArtifacts } from "./discover.js";
import { matcherRegistry } from "./matchers/index.js";
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

  return { findings, failures };
}

/**
 * Scan one artifact. Raw-content rules run against the file text exactly as
 * read, before and regardless of parsing: a file whose frontmatter refuses to
 * parse still has every byte of it searched for hidden content. Otherwise a
 * deliberately broken frontmatter block would exempt the rest of the file
 * from scanning, which is exactly the kind of parser-differential bypass this
 * tool exists to catch. Structured rules (permissions, metadata) get the
 * parsed artifact, starting in Phase 2.
 */
export function scanArtifact(ref: ArtifactRef, source: string, rules: Rule[]): ArtifactScanResult {
  const findings = scanRawSource(ref, source, rules);

  const parsed = parseSkill(ref, source);
  if (!parsed.ok) {
    return { findings, failure: parsed.failure };
  }

  // Structured rules will run here on parsed.skill once they exist.
  return { findings };
}

/** Run every raw-scope rule over the unparsed file text. */
function scanRawSource(ref: ArtifactRef, source: string, rules: Rule[]): Finding[] {
  const findings: Finding[] = [];
  const lineIndex = buildLineIndex(source);

  for (const rule of rules) {
    if (!rule.targets.includes(ref.type)) continue;
    const matcher = matcherRegistry[rule.matcher.type];
    if (matcher.scope !== "raw") continue;
    for (const match of matcher.run(source, rule.matcher)) {
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: rule.description,
        path: ref.relPath,
        range: {
          start: positionAt(lineIndex, match.start),
          end: positionAt(lineIndex, match.end),
        },
        detail: match.detail,
      });
    }
  }

  return findings;
}

function defaultRulesDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../rules");
}
