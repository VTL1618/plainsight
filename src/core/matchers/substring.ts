import { asciiFold } from "./case-fold.js";
import type { MatcherMatch } from "./types.js";

/**
 * Literal phrase search. Contributors list the exact strings that matter; the
 * matcher reports every occurrence. No regular expressions: a phrase list is
 * reviewed in seconds and cannot backtrack, where a contributor-supplied
 * regex is neither (see docs/decisions.md).
 */
export interface SubstringConfig {
  type: "substring";
  phrases: string[];
  /** Default false: matching folds ASCII case so "IGNORE" matches "ignore". */
  caseSensitive?: boolean | undefined;
}

const MAX_DETAIL_CHARS = 100;

export function matchSubstring(source: string, config: SubstringConfig): MatcherMatch[] {
  const caseSensitive = config.caseSensitive ?? false;
  // ASCII-only case folding keeps the string length identical, so every offset
  // still points at the same character in the original source. Locale-aware
  // lowercasing can change length (for example the Turkish dotted I) and would
  // corrupt the positions, so it is not used here.
  const haystack = caseSensitive ? source : asciiFold(source);

  const matches: MatcherMatch[] = [];
  for (const phrase of config.phrases) {
    if (phrase.length === 0) continue;
    const needle = caseSensitive ? phrase : asciiFold(phrase);
    let from = 0;
    for (;;) {
      const index = haystack.indexOf(needle, from);
      if (index === -1) break;
      const end = index + needle.length;
      matches.push({ start: index, end, detail: renderDetail(source.slice(index, end)) });
      from = end;
    }
  }
  matches.sort((a, b) => a.start - b.start);
  return matches;
}

function renderDetail(matched: string): string {
  const clipped =
    matched.length > MAX_DETAIL_CHARS ? `${matched.slice(0, MAX_DETAIL_CHARS)}...` : matched;
  return `matched text: "${clipped}"`;
}
