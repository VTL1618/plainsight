import type { ParsedSkill } from "../parse/skill.js";
import type { MatcherMatch } from "./types.js";

/**
 * Checks a named frontmatter field against a set of disallowed values. This is
 * the first structured matcher: it reads the parsed frontmatter, not the raw
 * text, because the meaning of a permission field is what matters and that is
 * exactly what the runtime acts on.
 *
 * Detection runs on the parsed value, so it is immune to quoting and spacing
 * tricks. Only the position reported in the finding is recovered from the raw
 * text, and if that lookup ever fails it falls back to the frontmatter block.
 */
export interface FrontmatterFieldConfig {
  type: "frontmatter-field";
  field: string;
  /** Flag when any entry of the field exactly equals one of these values. */
  equalsAny: string[];
}

export function matchFrontmatterField(
  skill: ParsedSkill,
  config: FrontmatterFieldConfig,
): MatcherMatch[] {
  const block = skill.frontmatter;
  if (block === null) return [];

  const value = block.data[config.field];
  if (value === undefined) return [];

  const disallowed = new Set(config.equalsAny);
  const hits = normalizeToList(value).filter((entry) => disallowed.has(entry));
  if (hits.length === 0) return [];

  const range = locateFieldKey(skill.source, block.raw, block.rawOffset, config.field);
  const listed = hits.map((hit) => `"${hit}"`).join(", ");
  return [{ start: range.start, end: range.end, detail: `${config.field} grants ${listed}` }];
}

/** Tool lists appear as a YAML list, a comma-separated string, or a bare scalar. */
function normalizeToList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim());
  }
  if (typeof value === "string") {
    return value.split(",").map((entry) => entry.trim());
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  return [];
}

interface Range {
  start: number;
  end: number;
}

function locateFieldKey(source: string, raw: string, rawOffset: number, field: string): Range {
  // Find the top-level key line inside the frontmatter (no leading indentation).
  const prefix = `${field}:`;
  for (const line of iterateLines(raw)) {
    if (line.text.startsWith(prefix)) {
      return { start: rawOffset + line.start, end: rawOffset + line.start + field.length };
    }
  }
  // Fallback: point at the start of the frontmatter block.
  return { start: rawOffset, end: Math.min(rawOffset + field.length, source.length) };
}

interface RawLine {
  text: string;
  start: number;
}

function iterateLines(raw: string): RawLine[] {
  const lines: RawLine[] = [];
  let start = 0;
  for (let i = 0; i <= raw.length; i++) {
    if (i === raw.length || raw.charCodeAt(i) === 10) {
      lines.push({ text: raw.slice(start, i), start });
      start = i + 1;
    }
  }
  return lines;
}
