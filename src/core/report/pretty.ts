import type { ScanResult } from "../scan.js";
import type { Rule } from "../rules.js";
import type { Finding, ParseFailure, Severity } from "../types.js";

/**
 * Human-readable terminal output. Grouped by file, one finding at a time:
 * severity and location, then the plain-language explanation, the evidence,
 * and the fix. This is the zero-config default, so it has to read well to a
 * person, not a machine.
 */
export interface PrettyOptions {
  /** ANSI color. The CLI decides this from isTTY and NO_COLOR. */
  color?: boolean;
  toolVersion?: string;
}

const COLORS = {
  reset: "[0m",
  bold: "[1m",
  dim: "[2m",
  red: "[31m",
  yellow: "[33m",
  blue: "[34m",
  magenta: "[35m",
  cyan: "[36m",
} as const;

const SEVERITY_COLOR: Record<Severity, keyof typeof COLORS> = {
  critical: "red",
  high: "magenta",
  medium: "yellow",
  low: "blue",
};

export function toPretty(result: ScanResult, options: PrettyOptions = {}): string {
  const paint = painter(options.color ?? false);
  const rulesById = new Map(result.rules.map((rule) => [rule.id, rule]));

  const byPath = groupByPath(result.findings, result.failures);
  const lines: string[] = [];

  for (const [filePath, group] of byPath) {
    lines.push(paint(filePath, "bold", "cyan"));
    for (const finding of group.findings) {
      lines.push(...findingLines(finding, rulesById.get(finding.ruleId), paint));
    }
    for (const failure of group.failures) {
      lines.push(...failureLines(failure, paint));
    }
    lines.push("");
  }

  lines.push(summaryLine(result, paint));
  return lines.join("\n");
}

type Paint = (text: string, ...styles: (keyof typeof COLORS)[]) => string;

function painter(color: boolean): Paint {
  if (!color) return (text) => text;
  return (text, ...styles) => `${styles.map((s) => COLORS[s]).join("")}${text}${COLORS.reset}`;
}

interface Group {
  findings: Finding[];
  failures: ParseFailure[];
}

function groupByPath(findings: Finding[], failures: ParseFailure[]): Map<string, Group> {
  const map = new Map<string, Group>();
  const get = (p: string): Group => {
    let group = map.get(p);
    if (group === undefined) {
      group = { findings: [], failures: [] };
      map.set(p, group);
    }
    return group;
  };
  for (const finding of findings) get(finding.path).findings.push(finding);
  for (const failure of failures) get(failure.path).failures.push(failure);
  return new Map([...map].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
}

function findingLines(finding: Finding, rule: Rule | undefined, paint: Paint): string[] {
  const sev = paint(finding.severity.padEnd(8), SEVERITY_COLOR[finding.severity], "bold");
  const loc = paint(`${String(finding.range.start.line)}:${String(finding.range.start.column)}`, "dim");
  const head = `  ${sev} ${finding.ruleId}  ${loc}`;

  const out = [head];
  if (rule !== undefined) out.push(`    ${rule.description}`);
  out.push(`    ${paint("evidence:", "dim")} ${finding.detail}`);
  if (rule !== undefined) out.push(`    ${paint("fix:", "dim")} ${rule.remediation}`);
  return out;
}

function failureLines(failure: ParseFailure, paint: Paint): string[] {
  return [
    `  ${paint("warning ".padEnd(8), "yellow", "bold")} could not parse`,
    `    ${failure.reason}`,
    `    ${paint("fix:", "dim")} a file that cannot be parsed cannot be vetted; review it by hand.`,
  ];
}

function summaryLine(result: ScanResult, paint: Paint): string {
  if (result.findings.length === 0 && result.failures.length === 0) {
    return paint(`No findings. Scanned ${String(result.scanned)} ${plural(result.scanned, "file")}.`, "bold");
  }

  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of result.findings) counts[finding.severity] += 1;
  const breakdown = (["critical", "high", "medium", "low"] as const)
    .filter((sev) => counts[sev] > 0)
    .map((sev) => `${String(counts[sev])} ${sev}`)
    .join(", ");

  const parts = [
    `${String(result.findings.length)} ${plural(result.findings.length, "finding")}`,
    breakdown ? `(${breakdown})` : "",
    `across ${String(result.scanned)} ${plural(result.scanned, "file")}`,
  ].filter((p) => p.length > 0);

  let summary = parts.join(" ");
  if (result.failures.length > 0) {
    summary += `. ${String(result.failures.length)} ${plural(result.failures.length, "file")} could not be parsed`;
  }
  return paint(`${summary}.`, "bold");
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}
