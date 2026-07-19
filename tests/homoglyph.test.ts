import { describe, expect, it } from "vitest";
import { matchHomoglyph, type HomoglyphConfig } from "../src/core/matchers/homoglyph.js";
import { parseSkill } from "../src/core/parse/skill.js";
import type { ArtifactRef } from "../src/core/types.js";

const ref: ArtifactRef = { type: "skill", path: "/tmp/SKILL.md", relPath: "SKILL.md" };
const config: HomoglyphConfig = { type: "homoglyph", field: "name" };

function skillOf(source: string) {
  const result = parseSkill(ref, source);
  if (!result.ok) throw new Error(`did not parse: ${result.failure.reason}`);
  return result.skill;
}

describe("homoglyph matcher", () => {
  it("flags a Cyrillic look-alike in the name and points at it", () => {
    // "gіt" with a Cyrillic small letter i (U+0456).
    const skill = skillOf("---\nname: gіt-helper\ndescription: d\n---\nbody\n");
    const matches = matchHomoglyph(skill, config);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.detail).toContain("Cyrillic");
    expect(matches[0]?.detail).toContain("U+0456");
    expect(skill.source.slice(matches[0]?.start, matches[0]?.end)).toBe("і");
  });

  it("flags a Greek look-alike", () => {
    // Greek small omicron (U+03BF) resembling Latin o.
    const skill = skillOf("---\nname: gοogle-helper\ndescription: d\n---\nbody\n");
    expect(matchHomoglyph(skill, config)).toHaveLength(1);
  });

  it("stays quiet on a plain ASCII name", () => {
    const skill = skillOf("---\nname: git-helper\ndescription: d\n---\nbody\n");
    expect(matchHomoglyph(skill, config)).toEqual([]);
  });

  it("does not flag non-Latin text outside the name", () => {
    const skill = skillOf("---\nname: russian-tutor\ndescription: Привет\n---\nbody\n");
    expect(matchHomoglyph(skill, config)).toEqual([]);
  });

  it("stays quiet when there is no frontmatter", () => {
    expect(matchHomoglyph(skillOf("# body only\n"), config)).toEqual([]);
  });
});
