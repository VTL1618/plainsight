import { opendir } from "node:fs/promises";
import path from "node:path";
import type { ArtifactRef, ArtifactType } from "./types.js";

export interface DiscoverOptions {
  /** Directory names never descended into. */
  excludeDirs?: readonly string[];
  /** Recursion depth bound; scanned trees are untrusted input. */
  maxDepth?: number;
}

const DEFAULT_EXCLUDE_DIRS = [".git", "node_modules"] as const;
const DEFAULT_MAX_DEPTH = 32;

/**
 * Walk a directory tree and collect scannable artifacts.
 *
 * Symlinks are never followed, whether they point inside or outside the scan
 * root. A symlinked artifact inside the root is still found at its real path;
 * one pointing outside the root must not be reachable at all.
 */
export async function discoverArtifacts(
  root: string,
  options: DiscoverOptions = {},
): Promise<ArtifactRef[]> {
  const excludeDirs = new Set(options.excludeDirs ?? DEFAULT_EXCLUDE_DIRS);
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const rootAbs = path.resolve(root);

  const found: ArtifactRef[] = [];
  await walk(rootAbs, rootAbs, 0, excludeDirs, maxDepth, found);
  found.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
  return found;
}

async function walk(
  dir: string,
  root: string,
  depth: number,
  excludeDirs: ReadonlySet<string>,
  maxDepth: number,
  out: ArtifactRef[],
): Promise<void> {
  if (depth > maxDepth) return;

  const handle = await opendir(dir);
  for await (const entry of handle) {
    if (entry.isSymbolicLink()) continue;

    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) continue;
      await walk(abs, root, depth + 1, excludeDirs, maxDepth, out);
    } else if (entry.isFile()) {
      const relPath = path.relative(root, abs).split(path.sep).join("/");
      const type = classify(entry.name, relPath);
      if (type !== null) out.push({ type, path: abs, relPath });
    }
  }
}

/** Maps a filename and its repo-relative path to the artifact kind, or null when not scannable. */
function classify(name: string, relPath: string): ArtifactType | null {
  if (name === "SKILL.md") return "skill";
  if (name === ".mcp.json") return "mcp-config";
  // The plugin marketplace manifest lives at the known path .claude-plugin/marketplace.json,
  // so scope to that parent to avoid claiming unrelated files named marketplace.json.
  if (name === "marketplace.json" && parentDir(relPath) === ".claude-plugin") return "marketplace-manifest";
  // Slash commands are any Markdown file under a .claude/commands/ tree, nesting allowed.
  if (name.endsWith(".md") && underDir(relPath, ".claude/commands")) return "slash-command";
  return null;
}

/** The immediate parent directory name of a forward-slashed relative path. */
function parentDir(relPath: string): string {
  const parts = relPath.split("/");
  return parts.length >= 2 ? (parts[parts.length - 2] ?? "") : "";
}

/** Whether the path lies under the given directory segment sequence, at any depth. */
function underDir(relPath: string, segment: string): boolean {
  return relPath.startsWith(`${segment}/`) || relPath.includes(`/${segment}/`);
}
