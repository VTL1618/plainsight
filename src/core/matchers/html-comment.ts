import { asciiFold } from "./case-fold.js";
import type { MatcherMatch } from "./types.js";

/**
 * Finds instructions hidden inside HTML comments. A comment renders as nothing
 * in a Markdown preview, so a reviewer skimming the rendered skill never sees
 * it, but the model reads the comment as plain text along with everything else.
 *
 * The matcher only fires when a comment carries one of the listed injection
 * phrases, which is what keeps it quiet on the ordinary comments a file has:
 * tooling directives and editorial notes are left alone.
 */
export interface HtmlCommentConfig {
  type: "html-comment";
  phrases: string[];
}

const OPEN = "<!--";
const CLOSE = "-->";

export function matchHtmlComment(source: string, config: HtmlCommentConfig): MatcherMatch[] {
  const folded = asciiFold(source);
  const foldedPhrases = config.phrases.map((phrase) => asciiFold(phrase));

  const matches: MatcherMatch[] = [];
  let cursor = 0;
  for (;;) {
    const open = source.indexOf(OPEN, cursor);
    if (open === -1) break;
    const innerStart = open + OPEN.length;
    const close = source.indexOf(CLOSE, innerStart);
    const innerEnd = close === -1 ? source.length : close;

    for (const needle of foldedPhrases) {
      if (needle.length === 0) continue;
      const at = folded.indexOf(needle, innerStart);
      if (at !== -1 && at + needle.length <= innerEnd) {
        const end = at + needle.length;
        matches.push({
          start: at,
          end,
          detail: `instruction hidden in an HTML comment: "${source.slice(at, end)}"`,
        });
        break; // one finding per comment is enough
      }
    }

    cursor = close === -1 ? source.length : close + CLOSE.length;
  }

  return matches;
}
