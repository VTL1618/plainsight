/**
 * Wide-scan research tool. NOT part of CI and never vendors anything: it
 * downloads SKILL.md files from public repositories into a temp directory,
 * scans them, prints an aggregate report, and deletes the downloads. Only
 * counts are ever written to disk; no repository names, no file paths, no
 * content. Findings that look real go through SECURITY.md coordinated
 * disclosure, never into a committed report.
 *
 *   npm run sweep -- owner/repo [owner/repo@ref ...] [--report]
 *
 * --report appends the aggregate to docs/sweeps/<date>.md.
 * Set GITHUB_TOKEN to raise the API rate limit; anonymous works for a few repos.
 */
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scan } from "../src/core/scan.js";
import type { Severity } from "../src/core/types.js";

const MAX_ARTIFACTS_PER_REPO = 500;

interface RepoSpec {
  owner: string;
  repo: string;
  ref?: string | undefined;
}

function parseArgs(argv: string[]): { repos: RepoSpec[]; report: boolean } {
  const repos: RepoSpec[] = [];
  let report = false;
  for (const arg of argv) {
    if (arg === "--report") {
      report = true;
      continue;
    }
    const match = /^([\w.-]+)\/([\w.-]+)(?:@([\w./-]+))?$/.exec(arg);
    if (!match) {
      console.error(`cannot parse "${arg}"; expected owner/repo or owner/repo@ref`);
      process.exit(1);
    }
    repos.push({ owner: match[1] ?? "", repo: match[2] ?? "", ref: match[3] });
  }
  if (repos.length === 0) {
    console.error("usage: npm run sweep -- owner/repo [owner/repo@ref ...] [--report]");
    process.exit(1);
  }
  return { repos, report };
}

async function github(url: string): Promise<unknown> {
  const headers: Record<string, string> = { accept: "application/vnd.github+json" };
  const token = process.env.GITHUB_TOKEN;
  if (token !== undefined && token !== "") headers.authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url}: HTTP ${String(response.status)}`);
  return response.json();
}

/** Repo-relative paths only; anything that could escape the temp dir is dropped. */
function isSafeRelPath(p: string): boolean {
  return !path.isAbsolute(p) && !p.split("/").includes("..") && !p.includes("\0");
}

async function fetchRepoSkills(spec: RepoSpec, destRoot: string): Promise<number> {
  const refPart = spec.ref ?? "HEAD";
  const commit = (await github(
    `https://api.github.com/repos/${spec.owner}/${spec.repo}/commits/${refPart}`,
  )) as { sha: string };
  const tree = (await github(
    `https://api.github.com/repos/${spec.owner}/${spec.repo}/git/trees/${commit.sha}?recursive=1`,
  )) as { tree: { path: string; type: string }[]; truncated: boolean };

  const skillPaths = tree.tree
    .filter((e) => e.type === "blob" && path.posix.basename(e.path) === "SKILL.md")
    .map((e) => e.path)
    .filter(isSafeRelPath)
    .slice(0, MAX_ARTIFACTS_PER_REPO);

  let downloaded = 0;
  for (const relPath of skillPaths) {
    const raw = `https://raw.githubusercontent.com/${spec.owner}/${spec.repo}/${commit.sha}/${relPath}`;
    const response = await fetch(raw);
    if (!response.ok) continue;
    const dest = path.join(destRoot, `${spec.owner}__${spec.repo}`, relPath);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, Buffer.from(await response.arrayBuffer()));
    downloaded += 1;
  }
  return downloaded;
}

const { repos, report } = parseArgs(process.argv.slice(2));
const workDir = await mkdtemp(path.join(tmpdir(), "plainsight-sweep-"));

try {
  let artifacts = 0;
  for (const spec of repos) {
    artifacts += await fetchRepoSkills(spec, workDir);
  }
  console.log(`downloaded ${String(artifacts)} artifacts from ${String(repos.length)} repositories`);

  const result = await scan(workDir);

  const bySeverity = new Map<Severity, number>();
  const byRule = new Map<string, number>();
  for (const finding of result.findings) {
    bySeverity.set(finding.severity, (bySeverity.get(finding.severity) ?? 0) + 1);
    byRule.set(finding.ruleId, (byRule.get(finding.ruleId) ?? 0) + 1);
  }

  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `## Sweep ${date}`,
    "",
    `- repositories: ${String(repos.length)}`,
    `- artifacts scanned: ${String(artifacts)}`,
    `- findings: ${String(result.findings.length)}`,
    ...[...byRule.entries()].map(([id, n]) => `  - ${id}: ${String(n)}`),
    ...[...bySeverity.entries()].map(([sev, n]) => `  - severity ${sev}: ${String(n)}`),
    `- parse failures: ${String(result.failures.length)}`,
    "",
  ];
  console.log(lines.join("\n"));

  if (report) {
    const sweepsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../docs/sweeps");
    await mkdir(sweepsDir, { recursive: true });
    const file = path.join(sweepsDir, `${date}.md`);
    await writeFile(file, `${lines.join("\n")}\n`, { flag: "a" });
    console.log(`appended to ${path.relative(process.cwd(), file)}`);
  }
} finally {
  await rm(workDir, { recursive: true, force: true });
}
