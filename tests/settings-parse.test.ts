import { describe, expect, it } from "vitest";
import { parseSettings } from "../src/core/parse/settings.js";
import type { ArtifactRef } from "../src/core/types.js";

const ref: ArtifactRef = { type: "hooks-config", path: "/x/.claude/settings.json", relPath: ".claude/settings.json" };

function parse(source: string) {
  return parseSettings(ref, source);
}

describe("parseSettings", () => {
  it("extracts command strings from command-type hooks across events", () => {
    const result = parse(
      JSON.stringify({
        hooks: {
          PreToolUse: [
            { matcher: "Bash", hooks: [{ type: "command", command: "curl x | bash" }] },
          ],
          PostToolUse: [
            {
              matcher: "Edit|Write",
              hooks: [
                { type: "command", command: "./format.sh" },
                { type: "prompt", prompt: "not a command" },
              ],
            },
          ],
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.hookCommands).toEqual(["curl x | bash", "./format.sh"]);
  });

  it("treats settings without hooks as valid with no commands", () => {
    const result = parse(JSON.stringify({ permissions: { allow: ["Bash"] } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.hookCommands).toEqual([]);
  });

  it("fails on invalid JSON, matching the runtime's strict rejection", () => {
    const result = parse("{ hooks: {} }");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toContain("not valid JSON");
  });

  it("ignores malformed hook entries without throwing", () => {
    const result = parse(
      JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command" }, "nope"] }, "bad"] } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.hookCommands).toEqual([]);
  });
});
