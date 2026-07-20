import { fingerprintAll } from "./fingerprint.js";
import type { ScanResult } from "./scan.js";

/**
 * A baseline is a set of accepted-finding fingerprints. Findings whose
 * fingerprint is in the baseline are suppressed, so a team can adopt the tool
 * on an existing repo without drowning in known issues, and still catch new
 * ones. The file is a public contract that gets committed, so its shape is
 * versioned and the fingerprints are the same ones the SARIF output carries.
 */

export const BASELINE_VERSION = 1;
export const DEFAULT_BASELINE_FILE = ".plainsight-baseline.json";

export interface BaselineFile {
  version: number;
  fingerprints: string[];
}

/** Parse baseline text into a fingerprint set. Throws on a shape it does not recognize. */
export function parseBaseline(text: string): Set<string> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`baseline is not valid JSON: ${message}`);
  }
  if (typeof data !== "object" || data === null) {
    throw new Error("baseline must be a JSON object");
  }
  const record = data as Record<string, unknown>;
  if (record.version !== BASELINE_VERSION) {
    throw new Error(`unsupported baseline version ${JSON.stringify(record.version)}`);
  }
  const list = record.fingerprints;
  if (!Array.isArray(list) || !list.every((v): v is string => typeof v === "string")) {
    throw new Error("baseline.fingerprints must be a list of strings");
  }
  return new Set(list);
}

/** Serialize the current scan's fingerprints into baseline file text. */
export function serializeBaseline(result: ScanResult): string {
  const { findings, failures } = fingerprintAll(result.findings, result.failures);
  const fingerprints = [...findings, ...failures].sort();
  const file: BaselineFile = { version: BASELINE_VERSION, fingerprints };
  return `${JSON.stringify(file, null, 2)}\n`;
}

/**
 * Drop findings and failures whose fingerprint is in the baseline. Returns a
 * new result; the rules and scanned count are unchanged.
 */
export function applyBaseline(result: ScanResult, baseline: Set<string>): ScanResult {
  const { findings, failures } = fingerprintAll(result.findings, result.failures);
  return {
    findings: result.findings.filter((_, i) => !baseline.has(findings[i] ?? "")),
    failures: result.failures.filter((_, i) => !baseline.has(failures[i] ?? "")),
    rules: result.rules,
    scanned: result.scanned,
  };
}
