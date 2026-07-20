import type { Rule } from "../rules.js";
import type { ScanResult } from "../scan.js";
import type { Finding, ParseFailure, Severity } from "../types.js";

/**
 * The machine-readable JSON report. This is plainsight's own format, distinct
 * from SARIF, meant for scripts and dashboards. It is a public contract, so it
 * carries a schemaVersion and each finding is self-contained: the rule's title,
 * remediation, and help URI are inlined so a consumer never has to join back
 * to a rule table.
 */
export interface JsonReport {
  schemaVersion: 1;
  tool: { name: "plainsight"; version: string };
  summary: {
    findings: number;
    failures: number;
    bySeverity: Record<Severity, number>;
  };
  findings: JsonFinding[];
  failures: ParseFailure[];
}

export interface JsonFinding {
  ruleId: string;
  severity: Severity;
  title: string;
  path: string;
  region: { startLine: number; startColumn: number; endLine: number; endColumn: number };
  detail: string;
  remediation: string;
  helpUri?: string;
}

export interface JsonOptions {
  toolVersion?: string;
}

export function toJson(result: ScanResult, options: JsonOptions = {}): JsonReport {
  const rulesById = new Map(result.rules.map((rule) => [rule.id, rule]));

  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const findings: JsonFinding[] = [];

  for (const finding of result.findings) {
    bySeverity[finding.severity] += 1;
    const rule = rulesById.get(finding.ruleId);
    findings.push(toJsonFinding(finding, rule));
  }

  return {
    schemaVersion: 1,
    tool: { name: "plainsight", version: options.toolVersion ?? "0.0.0" },
    summary: {
      findings: result.findings.length,
      failures: result.failures.length,
      bySeverity,
    },
    findings,
    failures: result.failures,
  };
}

function toJsonFinding(finding: Finding, rule: Rule | undefined): JsonFinding {
  const record: JsonFinding = {
    ruleId: finding.ruleId,
    severity: finding.severity,
    title: rule?.title ?? finding.ruleId,
    path: finding.path,
    region: {
      startLine: finding.range.start.line,
      startColumn: finding.range.start.column,
      endLine: finding.range.end.line,
      endColumn: finding.range.end.column,
    },
    detail: finding.detail,
    remediation: rule?.remediation ?? "",
  };
  const helpUri = rule?.references[0];
  if (helpUri !== undefined) record.helpUri = helpUri;
  return record;
}
