/** Artifact kinds the scanner understands. Grows in later phases (mcp-config, hooks, ...). */
export type ArtifactType = "skill";

/** A scannable file found by discovery. */
export interface ArtifactRef {
  type: ArtifactType;
  /** Absolute path on disk. */
  path: string;
  /** Path relative to the scan root, always with forward slashes. */
  relPath: string;
}

export type Severity = "critical" | "high" | "medium" | "low";

/** 1-based line, 1-based column in UTF-16 code units (matches SARIF's default columnKind). */
export interface Position {
  line: number;
  column: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  /** What the pattern means and what an attacker gets from it. Plain language. */
  message: string;
  /** Path relative to the scan root. */
  path: string;
  range: Range;
  /** Per-match context, always printable. Invisible content appears here decoded or escaped. */
  detail?: string;
}

/**
 * An artifact the scanner could not parse. Never silently dropped: a file we
 * cannot parse is a file we cannot call safe, so failures travel with the
 * scan result all the way to the report.
 */
export interface ParseFailure {
  path: string;
  reason: string;
}
