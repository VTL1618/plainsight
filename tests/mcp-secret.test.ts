import { describe, expect, it } from "vitest";
import { matchMcpSecret } from "../src/core/matchers/mcp-secret.js";
import { parseMcp } from "../src/core/parse/mcp.js";
import type { ArtifactRef } from "../src/core/types.js";

const ref: ArtifactRef = { type: "mcp-config", path: "/tmp/.mcp.json", relPath: ".mcp.json" };

function run(config: unknown) {
  const parsed = parseMcp(ref, JSON.stringify(config, null, 2));
  if (!parsed.ok) throw new Error(parsed.failure.reason);
  return matchMcpSecret(parsed.mcp);
}

describe("matchMcpSecret", () => {
  it("flags known token prefixes in env", () => {
    const cases = [
      { KEY: "ghp_wJ8kLmN0pQrStUvWxYz1234567890abcdef" },
      { KEY: "sk-ant-api03-abcdefghijklmnopqrstuvwx" },
      { KEY: "xoxb-not-a-real-token" },
      { KEY: "AKIAIOSFODNN7EXAMPLE" },
      { KEY: "AIzaSyD-1234567890abcdefghijklmnopqrst" },
    ];
    for (const env of cases) {
      expect(run({ mcpServers: { s: { env } } }), JSON.stringify(env)).toHaveLength(1);
    }
  });

  it("flags a JWT and a literal Bearer token in headers", () => {
    const jwt = run({
      mcpServers: { s: { env: { KEY: "eyJhbGci.eyJzdWIiOiIxMjM.SflKxwRJSMeKKF2QT4" } } },
    });
    expect(jwt).toHaveLength(1);

    const bearer = run({
      mcpServers: { s: { type: "http", url: "https://x", headers: { Authorization: "Bearer abcdef0123456789abcdef" } } },
    });
    expect(bearer).toHaveLength(1);
  });

  it("masks the secret instead of echoing it", () => {
    const [match] = run({ mcpServers: { s: { env: { GITHUB_TOKEN: "ghp_wJ8kLmN0pQrStUvWxYz1234567890abcdef" } } } });
    expect(match?.detail).toContain("GITHUB_TOKEN");
    expect(match?.detail).toContain("ghp_wJ…");
    expect(match?.detail).not.toContain("1234567890abcdef");
  });

  it("stays quiet on environment references and ordinary config", () => {
    expect(
      run({
        mcpServers: {
          s: {
            env: {
              GITHUB_TOKEN: "${GITHUB_TOKEN}",
              WIN_TOKEN: "%API_KEY%",
              SHELL_TOKEN: "$API_KEY",
              LOG_LEVEL: "info",
              PORT: "3000",
              CACHE_DIR: "/Users/dev/Library/Caches/some-long-path-here",
            },
            headers: { Authorization: "Bearer ${MCP_TOKEN}" },
          },
        },
      }),
    ).toEqual([]);
  });
});
