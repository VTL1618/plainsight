import { describe, expect, it } from "vitest";
import { parseSkill } from "../src/core/parse/skill.js";
import type { ArtifactRef } from "../src/core/types.js";

const ref: ArtifactRef = { type: "skill", path: "/tmp/x/SKILL.md", relPath: "x/SKILL.md" };

describe("parseSkill", () => {
  it("parses frontmatter and produces a Markdown AST for the body", () => {
    const result = parseSkill(ref, "---\nname: demo\ndescription: d\n---\n# Title\n\nSome text.\n");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.skill.frontmatter?.data).toEqual({ name: "demo", description: "d" });
    expect(result.skill.body.startLine).toBe(5);
    expect(result.skill.body.ast.type).toBe("root");
    expect(result.skill.body.ast.children[0]).toMatchObject({ type: "heading", depth: 1 });
  });

  it("accepts a file without frontmatter", () => {
    const result = parseSkill(ref, "# Bare skill\n");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skill.frontmatter).toBeNull();
    expect(result.skill.body.text).toBe("# Bare skill\n");
  });

  it("fails when frontmatter is not a YAML map", () => {
    const result = parseSkill(ref, "---\njust a string\n---\nbody\n");
    expect(result).toEqual({
      ok: false,
      failure: { path: "x/SKILL.md", reason: "frontmatter is not a YAML map" },
    });
  });

  it("carries frontmatter errors through as parse failures", () => {
    const result = parseSkill(ref, "---\nname: a\nname: b\n---\nbody\n");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.path).toBe("x/SKILL.md");
    expect(result.failure.reason).toContain("not valid YAML");
  });
});
