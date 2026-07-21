import type { MatcherConfig } from "../../schema/rule.js";
import { matchCommandToken } from "./command-token.js";
import { matchEncodedBlob } from "./encoded-blob.js";
import { matchFrontmatterField } from "./frontmatter-field.js";
import { matchHomoglyph } from "./homoglyph.js";
import { matchHtmlComment } from "./html-comment.js";
import { matchMcpSecret } from "./mcp-secret.js";
import { matchMcpServerSource } from "./mcp-server-source.js";
import type { ParsedMcp } from "../parse/mcp.js";
import type { ParsedSkill } from "../parse/skill.js";
import { matchSubstring } from "./substring.js";
import type { MatcherMatch } from "./types.js";
import { matchUnicodeRanges } from "./unicode-range.js";
import { matchUrlToken } from "./url-token.js";

/**
 * The matcher registry. rule.yaml names a matcher; this dispatch supplies the
 * implementation. It deliberately exposes exactly what shipped rules use,
 * nothing speculative: rule.yaml grows by adding matchers here in TypeScript,
 * never by growing the YAML into a programming language (docs/decisions.md).
 *
 * Every matcher receives the same context and returns matches as offsets into
 * the raw source, so findings map back to file positions uniformly.
 * - Raw matchers read `source`, which is present even when parsing failed, so
 *   hidden-content detection runs on a file that defeats the parser.
 * - Structured matchers read the parsed artifact (`skill` or `mcp`), which is
 *   null when parsing failed or the artifact is a different kind, and they
 *   simply produce nothing in that case.
 */
export interface MatcherContext {
  source: string;
  skill: ParsedSkill | null;
  mcp: ParsedMcp | null;
}

export function runMatcher(context: MatcherContext, config: MatcherConfig): MatcherMatch[] {
  switch (config.type) {
    case "unicode-range":
      return matchUnicodeRanges(context.source, config);
    case "substring":
      return matchSubstring(context.source, config);
    case "url-token":
      return matchUrlToken(context.source);
    case "command-token":
      return matchCommandToken(context.source, config);
    case "frontmatter-field":
      return context.skill === null ? [] : matchFrontmatterField(context.skill, config);
    case "html-comment":
      return matchHtmlComment(context.source, config);
    case "homoglyph":
      return context.skill === null ? [] : matchHomoglyph(context.skill, config);
    case "encoded-blob":
      return matchEncodedBlob(context.source, config);
    case "mcp-secret":
      return context.mcp === null ? [] : matchMcpSecret(context.mcp);
    case "mcp-server-source":
      return context.mcp === null ? [] : matchMcpServerSource(context.mcp, config);
  }
}
