/**
 * Repin the README's version-pinned examples to the version in package.json.
 *
 * This runs as part of `changeset version`, so a release can never ship a
 * README whose examples point at an older version than the package carrying
 * them. That drift is not cosmetic: a minor release adds capability, and an
 * example pinned to the previous minor tells the reader to install a version
 * that cannot do what the surrounding prose describes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { version: string };
const readmePath = path.join(root, "README.md");

const before = readFileSync(readmePath, "utf8");
const after = before
  .replace(/(VTL1618\/plainsight\/action@v)\d+\.\d+\.\d+/g, `$1${pkg.version}`)
  .replace(/(npx plainsight@)\d+\.\d+\.\d+/g, `$1${pkg.version}`);

if (after === before) {
  console.log(`README examples already pinned to ${pkg.version}`);
} else {
  writeFileSync(readmePath, after);
  console.log(`README examples repinned to ${pkg.version}`);
}
