import { createHash } from "node:crypto";
import type { Rule } from "../rules.js";
import type { ScanResult } from "../scan.js";
import { toSarifLevel, type SarifLevel } from "../severity.js";
import type { Finding, ParseFailure, Severity } from "../types.js";

/**
 * SARIF 2.1.0 emitter. This is the format GitHub ingests into the Security
 * tab, so it is the primary output. Rule prose lives once in
 * tool.driver.rules; each result references a rule by index and carries only
 * the match-specific message. Fingerprints deliberately exclude line numbers
 * so an edit above a finding does not re-alert it (CLAUDE.md §5).
 */

const SCHEMA_URI =
  "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json";
const DEFAULT_INFO_URI = "https://github.com/VTL1618/plainsight";
const FINGERPRINT_KEY = "plainsight/v1";

/** Reserved rule for files that could not be parsed; not a PS-category rule. */
const UNPARSEABLE_RULE_ID = "plainsight-unparseable-artifact";

/** GitHub reads this numeric property to rank severity in the Security tab. */
const SECURITY_SEVERITY: Record<Severity, string> = {
  critical: "9.0",
  high: "7.0",
  medium: "4.0",
  low: "1.0",
};

export interface SarifOptions {
  toolVersion?: string;
  informationUri?: string;
}

interface SarifMessage {
  text: string;
}

interface SarifReportingDescriptor {
  id: string;
  name: string;
  shortDescription: SarifMessage;
  fullDescription: SarifMessage;
  help: SarifMessage;
  helpUri?: string;
  defaultConfiguration: { level: SarifLevel };
  properties: { tags: string[]; "security-severity"?: string };
}

interface SarifResult {
  ruleId: string;
  ruleIndex: number;
  level: SarifLevel;
  message: SarifMessage;
  locations: {
    physicalLocation: {
      artifactLocation: { uri: string };
      region?: { startLine: number; startColumn: number; endLine: number; endColumn: number };
    };
  }[];
  partialFingerprints: Record<string, string>;
}

interface SarifLog {
  $schema: string;
  version: "2.1.0";
  runs: {
    tool: { driver: { name: string; informationUri: string; version: string; rules: SarifReportingDescriptor[] } };
    results: SarifResult[];
  }[];
}

export function toSarif(result: ScanResult, options: SarifOptions = {}): SarifLog {
  const version = options.toolVersion ?? "0.0.0";
  const informationUri = options.informationUri ?? DEFAULT_INFO_URI;

  const rules = [...result.rules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const descriptors = rules.map(toDescriptor);
  const ruleIndex = new Map(rules.map((rule, index) => [rule.id, index]));

  let unparseableIndex = -1;
  if (result.failures.length > 0) {
    unparseableIndex = descriptors.length;
    descriptors.push(unparseableDescriptor());
  }

  const seen = new Map<string, number>();
  const results: SarifResult[] = [];

  for (const finding of result.findings) {
    const index = ruleIndex.get(finding.ruleId);
    if (index === undefined) continue; // a finding must reference a loaded rule
    results.push(findingResult(finding, index, seen));
  }
  for (const failure of result.failures) {
    results.push(failureResult(failure, unparseableIndex, seen));
  }

  return {
    $schema: SCHEMA_URI,
    version: "2.1.0",
    runs: [{ tool: { driver: { name: "plainsight", informationUri, version, rules: descriptors } }, results }],
  };
}

function toDescriptor(rule: Rule): SarifReportingDescriptor {
  const descriptor: SarifReportingDescriptor = {
    id: rule.id,
    name: rule.title,
    shortDescription: { text: rule.title },
    fullDescription: { text: rule.description },
    help: { text: rule.remediation },
    defaultConfiguration: { level: toSarifLevel(rule.severity) },
    properties: { tags: ["security", rule.category], "security-severity": SECURITY_SEVERITY[rule.severity] },
  };
  const helpUri = rule.references[0];
  if (helpUri !== undefined) descriptor.helpUri = helpUri;
  return descriptor;
}

function unparseableDescriptor(): SarifReportingDescriptor {
  return {
    id: UNPARSEABLE_RULE_ID,
    name: "Unparseable artifact",
    shortDescription: { text: "An artifact could not be parsed" },
    fullDescription: {
      text: "plainsight could not parse this file, so it could not be checked. A file that cannot be parsed cannot be called safe, and malformed frontmatter can be a deliberate attempt to slip past analysis.",
    },
    help: { text: "Fix the file so it parses, then scan again. If it is not yours, treat the parse failure as a reason to review it by hand." },
    defaultConfiguration: { level: "warning" },
    properties: { tags: ["plainsight", "coverage"] },
  };
}

function findingResult(finding: Finding, index: number, seen: Map<string, number>): SarifResult {
  return {
    ruleId: finding.ruleId,
    ruleIndex: index,
    level: toSarifLevel(finding.severity),
    message: { text: finding.detail },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: finding.path },
          region: {
            startLine: finding.range.start.line,
            startColumn: finding.range.start.column,
            endLine: finding.range.end.line,
            endColumn: finding.range.end.column,
          },
        },
      },
    ],
    partialFingerprints: { [FINGERPRINT_KEY]: fingerprint(finding.ruleId, finding.path, finding.detail, seen) },
  };
}

function failureResult(failure: ParseFailure, index: number, seen: Map<string, number>): SarifResult {
  return {
    ruleId: UNPARSEABLE_RULE_ID,
    ruleIndex: index,
    level: "warning",
    message: { text: failure.reason },
    locations: [{ physicalLocation: { artifactLocation: { uri: failure.path } } }],
    partialFingerprints: { [FINGERPRINT_KEY]: fingerprint(UNPARSEABLE_RULE_ID, failure.path, failure.reason, seen) },
  };
}

/**
 * Stable identity for an alert. Built from the rule, the file, and the match
 * text, never from line numbers, so editing elsewhere in the file keeps the
 * same fingerprint. An occurrence ordinal keeps two identical matches in one
 * file distinct instead of collapsing them.
 */
function fingerprint(ruleId: string, path: string, detail: string, seen: Map<string, number>): string {
  const base = `${ruleId}\n${path}\n${detail}`;
  const ordinal = seen.get(base) ?? 0;
  seen.set(base, ordinal + 1);
  return createHash("sha256").update(`${base}\n${String(ordinal)}`).digest("hex").slice(0, 16);
}
