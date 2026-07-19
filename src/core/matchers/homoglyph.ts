import type { ParsedSkill } from "../parse/skill.js";
import type { MatcherMatch } from "./types.js";

/**
 * Flags look-alike letters in a name field. A skill named "gіt-helper" with a
 * Cyrillic "і" reads as "git-helper" to a person but is a different string to
 * the machine, which is how a typosquatted skill gets installed in place of
 * the real one.
 *
 * The check is scoped to the identifier on purpose. A description written in
 * Russian or Greek is legitimate and stays quiet; only a confusable letter in
 * the name, where an ASCII slug is expected, is a finding.
 */
export interface HomoglyphConfig {
  type: "homoglyph";
  field: string;
}

const CONFUSABLE_SCRIPTS = [
  { from: 0x0370, to: 0x03ff, script: "Greek" },
  { from: 0x0400, to: 0x04ff, script: "Cyrillic" },
];

export function matchHomoglyph(skill: ParsedSkill, config: HomoglyphConfig): MatcherMatch[] {
  const block = skill.frontmatter;
  if (block === null) return [];

  const value = block.data[config.field];
  if (typeof value !== "string") return [];

  for (const char of value) {
    const codepoint = char.codePointAt(0) ?? 0;
    const script = CONFUSABLE_SCRIPTS.find((range) => codepoint >= range.from && codepoint <= range.to);
    if (script === undefined) continue;

    const start = locateChar(block.raw, block.rawOffset, char, config.field);
    const hex = codepoint.toString(16).toUpperCase().padStart(4, "0");
    return [
      {
        start,
        end: start + char.length,
        detail: `the ${config.field} contains a ${script.script} letter that looks Latin: "${char}" (U+${hex})`,
      },
    ];
  }

  return [];
}

function locateChar(raw: string, rawOffset: number, char: string, field: string): number {
  const inRaw = raw.indexOf(char);
  if (inRaw !== -1) return rawOffset + inRaw;
  // Fallback: the field key, then the block start.
  const keyIndex = raw.indexOf(`${field}:`);
  return rawOffset + (keyIndex === -1 ? 0 : keyIndex);
}
