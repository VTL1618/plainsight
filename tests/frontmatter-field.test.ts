import { describe, expect, it } from "vitest";
import {
  matchFrontmatterField,
  type FrontmatterFieldConfig,
} from "../src/core/matchers/frontmatter-field.js";
import { parseSkill } from "../src/core/parse/skill.js";
import type { ArtifactRef } from "../src/core/types.js";

const ref: ArtifactRef = { type: "skill", path: "/tmp/SKILL.md", relPath: "SKILL.md" };

const config: FrontmatterFieldConfig = {
  type: "frontmatter-field",
  field: "allowed-tools",
  equalsAny: ["*", "Bash"],
};

function skillOf(source: string) {
  const result = parseSkill(ref, source);
  if (!result.ok) throw new Error(`fixture did not parse: ${result.failure.reason}`);
  return result.skill;
}

describe("frontmatter-field matcher", () => {
  it("flags a wildcard entry in a list", () => {
    const skill = skillOf('---\nname: x\nallowed-tools:\n  - "*"\n---\nbody\n');
    const matches = matchFrontmatterField(skill, config);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.detail).toBe('allowed-tools grants "*"');
    // Position points at the allowed-tools key line.
    expect(skill.source.slice(matches[0]?.start, matches[0]?.end)).toBe("allowed-tools");
  });

  it("flags a bare Bash entry", () => {
    const skill = skillOf("---\nname: x\nallowed-tools:\n  - Read\n  - Bash\n---\nbody\n");
    expect(matchFrontmatterField(skill, config)).toHaveLength(1);
  });

  it("flags a comma-separated string form", () => {
    const skill = skillOf('---\nname: x\nallowed-tools: "Read, *"\n---\nbody\n');
    expect(matchFrontmatterField(skill, config)).toHaveLength(1);
  });

  it("stays quiet on scoped Bash and named tools", () => {
    const skill = skillOf('---\nname: x\nallowed-tools:\n  - Read\n  - "Bash(git log:*)"\n---\nbody\n');
    expect(matchFrontmatterField(skill, config)).toEqual([]);
  });

  it("stays quiet when the field is absent", () => {
    const skill = skillOf("---\nname: x\ndescription: y\n---\nbody\n");
    expect(matchFrontmatterField(skill, config)).toEqual([]);
  });

  it("stays quiet when there is no frontmatter", () => {
    const skill = skillOf("# just a body\n");
    expect(matchFrontmatterField(skill, config)).toEqual([]);
  });
});
