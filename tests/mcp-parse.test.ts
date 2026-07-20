import { describe, expect, it } from "vitest";
import { parseMcp } from "../src/core/parse/mcp.js";
import type { ArtifactRef } from "../src/core/types.js";

const ref: ArtifactRef = { type: "mcp-config", path: "/tmp/x/.mcp.json", relPath: "x/.mcp.json" };

function parse(source: string) {
  return parseMcp(ref, source);
}

describe("parseMcp", () => {
  it("normalizes stdio and remote servers", () => {
    const result = parse(
      JSON.stringify({
        mcpServers: {
          local: { command: "node", args: ["server.js"], env: { LOG_LEVEL: "info", PORT: 3000 } },
          remote: { type: "sse", url: "https://mcp.example.com", headers: { Authorization: "Bearer x" } },
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [local, remote] = result.mcp.servers;
    expect(local).toEqual({
      name: "local",
      command: "node",
      args: ["server.js"],
      env: { LOG_LEVEL: "info", PORT: "3000" },
      transport: null,
      url: null,
      headers: {},
    });
    expect(remote).toMatchObject({ name: "remote", transport: "sse", url: "https://mcp.example.com" });
    expect(remote?.headers).toEqual({ Authorization: "Bearer x" });
  });

  it("treats a config without mcpServers as valid but empty", () => {
    const result = parse(JSON.stringify({ someOtherKey: true }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mcp.servers).toEqual([]);
  });

  it("strips a leading BOM before parsing", () => {
    const bom = String.fromCodePoint(0xfeff);
    const result = parse(`${bom}{"mcpServers":{"a":{"command":"node"}}}`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mcp.servers[0]?.name).toBe("a");
  });

  it("fails on invalid JSON, surfacing it rather than skipping", () => {
    const result = parse("{ not: valid json }");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.path).toBe("x/.mcp.json");
    expect(result.failure.reason).toContain("not valid JSON");
  });

  it("fails on JSON with comments, the JSONC parser differential", () => {
    const result = parse('{\n  // a comment the runtime might tolerate\n  "mcpServers": {}\n}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toContain("not valid JSON");
  });

  it("fails when the top level is not an object", () => {
    const result = parse("[1, 2, 3]");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toBe("top level is not a JSON object");
  });

  it("ignores malformed server entries without throwing", () => {
    const result = parse(JSON.stringify({ mcpServers: { good: { command: "node" }, bad: "nope" } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mcp.servers.map((s) => s.name)).toEqual(["good"]);
  });
});
