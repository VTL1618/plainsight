import { describe, expect, it } from "vitest";
import { matchMcpServerSource, type McpServerSourceConfig } from "../src/core/matchers/mcp-server-source.js";
import { parseMcp } from "../src/core/parse/mcp.js";
import type { ArtifactRef } from "../src/core/types.js";

const ref: ArtifactRef = { type: "mcp-config", path: "/tmp/.mcp.json", relPath: ".mcp.json" };

function run(config: unknown, detect: McpServerSourceConfig["detect"]) {
  const parsed = parseMcp(ref, JSON.stringify(config, null, 2));
  if (!parsed.ok) throw new Error(parsed.failure.reason);
  return matchMcpServerSource(parsed.mcp, { type: "mcp-server-source", detect });
}

describe("matchMcpServerSource (insecure-transport)", () => {
  it("flags a remote http:// server", () => {
    const hits = run({ mcpServers: { s: { type: "sse", url: "http://mcp.example.com/sse" } } }, "insecure-transport");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.detail).toContain("http://");
  });

  it("stays quiet on https and on http loopback", () => {
    expect(
      run(
        {
          mcpServers: {
            secure: { type: "sse", url: "https://mcp.example.com/sse" },
            local: { type: "http", url: "http://localhost:8787/mcp" },
            loop: { type: "http", url: "http://127.0.0.1:9000" },
          },
        },
        "insecure-transport",
      ),
    ).toEqual([]);
  });
});

describe("matchMcpServerSource (git-source)", () => {
  it("flags git references but not npm packages", () => {
    for (const arg of ["github:u/r", "git+https://example.com/r.git", "https://example.com/r.git", "git@github.com:u/r.git"]) {
      expect(run({ mcpServers: { s: { command: "npx", args: ["-y", arg] } } }, "git-source"), arg).toHaveLength(1);
    }
  });

  it("stays quiet on published packages, bare or pinned", () => {
    expect(
      run(
        {
          mcpServers: {
            bare: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/data"] },
            pinned: { command: "npx", args: ["-y", "@scope/mcp-server@1.4.2"] },
          },
        },
        "git-source",
      ),
    ).toEqual([]);
  });
});
