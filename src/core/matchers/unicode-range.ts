/**
 * Finds runs of characters that fall inside configured Unicode codepoint
 * ranges. Runs entirely on codepoint arithmetic: linear time, no regex, no
 * backtracking to worry about on hostile input.
 */

export interface CodepointRange {
  /** Inclusive first codepoint. */
  from: number;
  /** Inclusive last codepoint. */
  to: number;
}

export interface UnicodeRangeConfig {
  type: "unicode-range";
  ranges: CodepointRange[];
  /** Named allowlist applied to matched runs. */
  allow?: "rgi-emoji-tag-sequences";
}

export interface MatcherMatch {
  /** UTF-16 offset of the first matched character. */
  start: number;
  /** UTF-16 offset just past the last matched character. */
  end: number;
  /** Printable rendering of the matched run, bounded in length. */
  detail: string;
}

const BLACK_FLAG = 0x1f3f4;
const TAG_SPACE = 0xe0020;
const TAG_TILDE = 0xe007e;
const TAG_CANCEL = 0xe007f;

/**
 * The three tag sequences in the RGI emoji set (UTS #51): the flags of
 * England, Scotland, and Wales. Structural validity is deliberately not
 * enough for the allowlist: a made-up sequence like black flag + hidden text
 * + cancel tag is structurally a tag sequence, renders as a plain black flag,
 * and still smuggles the text. Only these exact sequences are exempt.
 */
const RGI_TAG_SEQUENCES = ["gbeng", "gbsct", "gbwls"].map(
  (spec) =>
    [...spec].map((ch) => (ch.codePointAt(0) ?? 0) + 0xe0000).join(",") + `,${String(TAG_CANCEL)}`,
);

const MAX_DETAIL_CHARS = 120;

export function matchUnicodeRanges(source: string, config: UnicodeRangeConfig): MatcherMatch[] {
  const matches: MatcherMatch[] = [];

  let run: number[] = [];
  let runStart = 0;
  let precedingCodepoint = -1;
  let index = 0;

  const flush = (end: number): void => {
    if (run.length === 0) return;
    if (!isAllowed(run, precedingCodepoint, config)) {
      matches.push({ start: runStart, end, detail: renderDetail(run) });
    }
    run = [];
  };

  for (const char of source) {
    const cp = char.codePointAt(0) ?? 0;
    if (config.ranges.some((r) => cp >= r.from && cp <= r.to)) {
      if (run.length === 0) runStart = index;
      run.push(cp);
    } else {
      flush(index);
      precedingCodepoint = cp;
    }
    index += char.length;
  }
  flush(index);

  return matches;
}

function isAllowed(run: number[], precedingCodepoint: number, config: UnicodeRangeConfig): boolean {
  if (config.allow !== "rgi-emoji-tag-sequences") return false;
  if (precedingCodepoint !== BLACK_FLAG) return false;
  return RGI_TAG_SEQUENCES.includes(run.join(","));
}

/**
 * Decode a run of tag characters into something a human can read in a
 * finding. Tag characters mirror printable ASCII shifted by 0xE0000, so the
 * hidden text decodes losslessly; anything else is shown as a codepoint
 * escape. Output is printable ASCII only and bounded in length, which keeps
 * attacker-controlled content safe to print in a terminal or a report.
 */
function renderDetail(run: number[]): string {
  let decoded = "";
  for (const cp of run) {
    if (decoded.length >= MAX_DETAIL_CHARS) return `${decoded}...`;
    if (cp >= TAG_SPACE && cp <= TAG_TILDE) {
      decoded += String.fromCodePoint(cp - 0xe0000);
    } else {
      decoded += `<U+${cp.toString(16).toUpperCase().padStart(4, "0")}>`;
    }
  }
  return decoded;
}
