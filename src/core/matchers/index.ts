import type { MatcherConfig } from "../../schema/rule.js";
import { matchUnicodeRanges, type MatcherMatch } from "./unicode-range.js";

/**
 * Matcher registry: rule.yaml names a matcher, this table supplies the
 * implementation. The registry deliberately exposes exactly what shipped
 * rules use, nothing speculative; growing rule.yaml toward a programming
 * language is the failure mode to avoid (docs/decisions.md).
 *
 * Scope decides what a matcher sees:
 * - "raw": the file text exactly as read, before and regardless of parsing.
 *   All hidden-content detection lives here, so a file that defeats the
 *   parser still gets searched.
 * - "structured": the parsed artifact. For rules about permissions and
 *   metadata. No structured matcher exists yet.
 */
export type MatcherScope = "raw" | "structured";

export interface Matcher {
  scope: MatcherScope;
  run: (source: string, config: MatcherConfig) => MatcherMatch[];
}

export const matcherRegistry: Record<MatcherConfig["type"], Matcher> = {
  "unicode-range": { scope: "raw", run: matchUnicodeRanges },
};
