import type { Severity } from "./types.js";

/** SARIF result levels. */
export type SarifLevel = "error" | "warning" | "note";

const SARIF_LEVEL: Record<Severity, SarifLevel> = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "note",
};

/** Ascending rank; higher number is more severe. Single source for ordering. */
const RANK: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export const SEVERITIES: readonly Severity[] = ["critical", "high", "medium", "low"];

export function toSarifLevel(severity: Severity): SarifLevel {
  return SARIF_LEVEL[severity];
}

export function severityRank(severity: Severity): number {
  return RANK[severity];
}

/** Whether `severity` is at least as severe as `floor`. */
export function meetsThreshold(severity: Severity, floor: Severity): boolean {
  return RANK[severity] >= RANK[floor];
}

/**
 * The default CI-failing floor. Only critical and high fail a build by
 * default (CLAUDE.md §3); medium and low are reported but do not gate.
 */
export const DEFAULT_FAIL_ON: Severity = "high";
