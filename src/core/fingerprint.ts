import { createHash } from "node:crypto";
import type { Finding, ParseFailure } from "./types.js";

/**
 * One definition of a finding's stable identity, shared by the SARIF emitter
 * and the baseline. Built from the rule, the file, and the match text, never
 * from line numbers, so an edit elsewhere in the file keeps the fingerprint.
 * An occurrence ordinal keeps two identical matches in one file distinct.
 */

export const FINGERPRINT_KEY = "plainsight/v1";

/** Reserved rule id for a file that could not be parsed. */
export const UNPARSEABLE_RULE_ID = "plainsight-unparseable-artifact";

function hash(ruleId: string, filePath: string, text: string, ordinal: number): string {
  return createHash("sha256")
    .update(`${ruleId}\n${filePath}\n${text}\n${String(ordinal)}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Fingerprint every finding and failure in one pass with a shared occurrence
 * counter, so the SARIF emitter and the baseline agree exactly. Returns arrays
 * aligned to the inputs.
 */
export function fingerprintAll(
  findings: readonly Finding[],
  failures: readonly ParseFailure[],
): { findings: string[]; failures: string[] } {
  const seen = new Map<string, number>();
  const next = (ruleId: string, filePath: string, text: string): string => {
    const base = `${ruleId}\n${filePath}\n${text}`;
    const ordinal = seen.get(base) ?? 0;
    seen.set(base, ordinal + 1);
    return hash(ruleId, filePath, text, ordinal);
  };

  return {
    findings: findings.map((f) => next(f.ruleId, f.path, f.detail)),
    failures: failures.map((f) => next(UNPARSEABLE_RULE_ID, f.path, f.reason)),
  };
}
