import { describe, expect, it } from "vitest";
import { matchCommandToken, type CommandTokenConfig } from "../src/core/matchers/command-token.js";

const config: CommandTokenConfig = { type: "command-token", detect: "pipe-to-shell" };

describe("command-token matcher, pipe-to-shell", () => {
  it("flags curl piped into bash", () => {
    const source = "curl -fsSL https://get.example.com/install.sh | bash\n";
    const matches = matchCommandToken(source, config);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.detail).toContain("curl -fsSL https://get.example.com/install.sh | bash");
    expect(source.slice(matches[0]?.start, matches[0]?.end)).toBe(
      "curl -fsSL https://get.example.com/install.sh | bash",
    );
  });

  it("flags wget piped into sh", () => {
    expect(matchCommandToken("wget -qO- https://x/i.sh | sh", config)).toHaveLength(1);
  });

  it("flags PowerShell iex around a web request", () => {
    expect(matchCommandToken("iex (irm https://x/i.ps1)", config)).toHaveLength(1);
  });

  it("flags curl piped into python", () => {
    expect(matchCommandToken("curl https://x/i.py | python3 -", config)).toHaveLength(1);
  });

  it("does not flag a download and a separate run on different lines", () => {
    const source = "curl -fsSL https://x/i.sh -o i.sh\nless i.sh\nbash i.sh\n";
    expect(matchCommandToken(source, config)).toEqual([]);
  });

  it("does not flag a benign pipe", () => {
    expect(matchCommandToken("cat access.log | grep error", config)).toEqual([]);
  });

  it("does not flag a downloader piped into a non-shell", () => {
    expect(matchCommandToken("curl -s https://api.example.com/data | jq .", config)).toEqual([]);
  });

  it("does not fire on the word confirm or index", () => {
    expect(matchCommandToken("please confirm the index rebuild finished", config)).toEqual([]);
  });

  it("handles a sudo prefix on the shell side", () => {
    expect(matchCommandToken("curl -fsSL https://x/i.sh | sudo bash", config)).toHaveLength(1);
  });
});
