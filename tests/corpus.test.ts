import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scan } from "../src/core/scan.js";

/**
 * The false-positive guard. Everything under tests/corpus/ is a real, benign
 * artifact (provenance in tests/corpus/SOURCES.md). A rule that lights up
 * here is too broad and does not merge. If a corpus file ever produces a
 * genuine critical or high finding, it leaves the corpus and goes through
 * SECURITY.md coordinated disclosure instead; see SOURCES.md.
 */

const corpusDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "corpus");

describe("false-positive corpus", () => {
  it("produces zero critical or high findings", async () => {
    const result = await scan(corpusDir);
    const blocking = result.findings.filter(
      (f) => f.severity === "critical" || f.severity === "high",
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  it("parses every corpus artifact", async () => {
    const result = await scan(corpusDir);
    expect(result.failures, JSON.stringify(result.failures, null, 2)).toEqual([]);
  });

  it("matches the byte-exact hashes recorded in SOURCES.md", () => {
    const sources = readFileSync(path.join(corpusDir, "SOURCES.md"), "utf8");
    const rows = [...sources.matchAll(/\| `([^`]+)` \| \[[^\]]+\]\([^)]+\) \| `([0-9a-f]{64})` \|/g)];
    expect(rows.length).toBeGreaterThan(0);
    for (const [, relPath, expected] of rows) {
      const data = readFileSync(path.join(corpusDir, relPath ?? ""));
      const actual = createHash("sha256").update(data).digest("hex");
      expect(`${relPath ?? ""}: ${actual}`).toBe(`${relPath ?? ""}: ${expected ?? ""}`);
    }
  });
});
