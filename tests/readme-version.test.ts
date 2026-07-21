import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The README pins a version in its Action and npx examples. If that pin falls
 * behind package.json, the docs tell a reader to install a version older than
 * the one whose features the surrounding prose describes. scripts/sync-readme-
 * version.ts keeps them together during `changeset version`; this test is the
 * guard that catches any drift the script did not.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { version: string };
const readme = readFileSync(path.join(root, "README.md"), "utf8");

describe("README version pins", () => {
  it("pins every example to the package version", () => {
    const pins = [
      ...readme.matchAll(/(?:VTL1618\/plainsight\/action@v|npx plainsight@)(\d+\.\d+\.\d+)/g),
    ].map((match) => match[1]);

    expect(pins.length, "the README should carry version-pinned examples").toBeGreaterThan(0);
    for (const pin of pins) expect(pin).toBe(pkg.version);
  });
});
