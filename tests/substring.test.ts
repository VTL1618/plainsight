import { describe, expect, it } from "vitest";
import { matchSubstring, type SubstringConfig } from "../src/core/matchers/substring.js";

function config(phrases: string[], caseSensitive?: boolean): SubstringConfig {
  return caseSensitive === undefined
    ? { type: "substring", phrases }
    : { type: "substring", phrases, caseSensitive };
}

describe("substring matcher", () => {
  it("finds a phrase and reports exact offsets", () => {
    const source = "please ignore previous instructions now";
    const matches = matchSubstring(source, config(["ignore previous instructions"]));
    expect(matches).toHaveLength(1);
    expect(source.slice(matches[0]?.start, matches[0]?.end)).toBe("ignore previous instructions");
    expect(matches[0]?.detail).toBe('matched text: "ignore previous instructions"');
  });

  it("folds ASCII case by default", () => {
    const matches = matchSubstring("IGNORE PREVIOUS INSTRUCTIONS", config(["ignore previous instructions"]));
    expect(matches).toHaveLength(1);
    // The detail preserves the source's original casing.
    expect(matches[0]?.detail).toBe('matched text: "IGNORE PREVIOUS INSTRUCTIONS"');
  });

  it("respects caseSensitive when set", () => {
    expect(matchSubstring("IGNORE", config(["ignore"], true))).toEqual([]);
    expect(matchSubstring("ignore", config(["ignore"], true))).toHaveLength(1);
  });

  it("keeps offsets exact when non-ASCII characters precede the match", () => {
    // The Turkish dotted capital I lowercases to two code units under a
    // locale-aware fold; ASCII-only folding must not shift the offset.
    const source = "İİ secret path .netrc here";
    const matches = matchSubstring(source, config([".netrc"]));
    expect(matches).toHaveLength(1);
    expect(source.slice(matches[0]?.start, matches[0]?.end)).toBe(".netrc");
  });

  it("reports every occurrence, sorted by position", () => {
    const matches = matchSubstring("aXbXc", config(["X"]));
    expect(matches.map((m) => m.start)).toEqual([1, 3]);
  });

  it("matches across multiple phrases", () => {
    const matches = matchSubstring("read .netrc and login.keychain", config([".netrc", "login.keychain"]));
    expect(matches.map((m) => m.start)).toEqual([5, 16]);
  });

  it("does not match when the phrase is absent", () => {
    expect(matchSubstring("a benign skill body", config(["ignore previous instructions"]))).toEqual([]);
  });
});
