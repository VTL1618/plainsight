/** Artifact kinds the scanner understands. Grows in later phases (hooks, slash-commands, ...). */
export type ArtifactType = "skill" | "mcp-config" | "marketplace-manifest";

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

/**
 * One match. A finding carries only what is specific to this hit; the rule's
 * prose (title, description, remediation, help URI) lives once in the rule and
 * is looked up by ruleId when reporting. Severity is resolved from the rule
 * and kept here because filtering and exit codes read it constantly.
 */
export interface Finding {
  ruleId: string;
  severity: Severity;
  /** Path relative to the scan root. */
  path: string;
  range: Range;
  /** Printable, bounded evidence for this hit. Invisible content is decoded or escaped here. */
  detail: string;
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
