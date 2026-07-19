import { describe, expect, it } from "vitest";
import { extractDocument } from "../src/core/parse/frontmatter.js";

describe("extractDocument", () => {
  it("extracts a plain frontmatter block", () => {
    const doc = extractDocument("---\nname: demo\ndescription: d\n---\n# Body\n");
    expect(doc.frontmatter).toMatchObject({
      kind: "ok",
      block: { data: { name: "demo", description: "d" }, startLine: 1, endLine: 4 },
    });
    expect(doc.body).toBe("# Body\n");
    expect(doc.bodyStartLine).toBe(5);
    expect(doc.hasBom).toBe(false);
  });

  it("reports the body offset into the original source", () => {
    const source = "---\na: 1\n---\nbody";
    const doc = extractDocument(source);
    expect(source.slice(doc.bodyOffset)).toBe("body");
  });

  it("returns the whole source as body when there is no frontmatter", () => {
    const doc = extractDocument("# Just markdown\n");
    expect(doc.frontmatter.kind).toBe("none");
    expect(doc.body).toBe("# Just markdown\n");
    expect(doc.bodyStartLine).toBe(1);
  });

  it("does not treat a delimiter after the first byte as frontmatter", () => {
    const source = "\n---\na: 1\n---\n";
    const doc = extractDocument(source);
    expect(doc.frontmatter.kind).toBe("none");
    expect(doc.body).toBe(source);
  });

  it("handles a UTF-8 BOM before the opening delimiter", () => {
    const doc = extractDocument("\uFEFF---\na: 1\n---\nbody\n");
    expect(doc.hasBom).toBe(true);
    expect(doc.frontmatter).toMatchObject({ kind: "ok", block: { data: { a: 1 } } });
    expect(doc.body).toBe("body\n");
  });

  it("handles CRLF line endings", () => {
    const doc = extractDocument("---\r\nname: demo\r\n---\r\nbody\r\n");
    expect(doc.frontmatter).toMatchObject({ kind: "ok", block: { data: { name: "demo" } } });
    expect(doc.body).toBe("body\r\n");
    expect(doc.bodyStartLine).toBe(4);
  });

  it("tolerates trailing spaces and tabs on the delimiters", () => {
    const doc = extractDocument("---  \na: 1\n--- \t\nbody\n");
    expect(doc.frontmatter).toMatchObject({ kind: "ok", block: { data: { a: 1 } } });
    expect(doc.body).toBe("body\n");
  });

  it("treats an empty frontmatter block as an empty map", () => {
    const doc = extractDocument("---\n---\nbody\n");
    expect(doc.frontmatter).toMatchObject({ kind: "ok", block: { data: {} } });
    expect(doc.body).toBe("body\n");
  });

  it("reports an unclosed delimiter as an error, not as a skip", () => {
    const doc = extractDocument("---\nname: demo\n# never closed\n");
    expect(doc.frontmatter).toMatchObject({
      kind: "error",
      reason: expect.stringContaining("never closed") as string,
    });
  });

  it("reports duplicate keys as an error", () => {
    // Duplicate keys are a parser-differential vector: YAML 1.1 and 1.2
    // runtimes disagree on which value wins, so we refuse to guess.
    const doc = extractDocument("---\nname: a\nname: b\n---\nbody\n");
    expect(doc.frontmatter).toMatchObject({
      kind: "error",
      reason: expect.stringContaining("not valid YAML") as string,
    });
  });

  it("reports invalid YAML as an error", () => {
    const doc = extractDocument("---\nname: [unclosed\n---\nbody\n");
    expect(doc.frontmatter.kind).toBe("error");
  });

  it("keeps YAML 1.2 scalar semantics: no stays a string", () => {
    const doc = extractDocument("---\nenabled: no\n---\n");
    expect(doc.frontmatter).toMatchObject({ kind: "ok", block: { data: { enabled: "no" } } });
  });

  it("handles a file that ends immediately after the opening delimiter", () => {
    const doc = extractDocument("---\n");
    expect(doc.frontmatter.kind).toBe("error");
  });

  it("handles a closing delimiter with no trailing newline", () => {
    const doc = extractDocument("---\na: 1\n---");
    expect(doc.frontmatter).toMatchObject({ kind: "ok", block: { data: { a: 1 } } });
    expect(doc.body).toBe("");
  });
});
