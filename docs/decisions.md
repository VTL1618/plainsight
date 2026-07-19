# Decision log

Append-only. One entry per notable decision, newest last. Keep each entry short: what we decided and the one reason that carried it.

## 2026-07-19: Rule ID scheme

Rule IDs are `<category>-<slug>`, for example `PS2-unicode-tag-block`. No sequential numbering inside a category. Sequential numbers force contributors to claim the next free number, which collides across parallel PRs; slugs don't. The ID must match the rule's directory name, and the engine enforces that. IDs are a permanent public contract: they appear in SARIF output and in users' baseline files, so they never change once shipped.

## 2026-07-19: Single package, no monorepo

One npm package. The GitHub Action wrapper will live in `action/` inside the same package. A split adds release coordination cost and buys nothing at this size.

## 2026-07-19: Matchers are code, rules are parameters

`rule.yaml` names a matcher implemented in `src/core/matchers/` and passes it declarative parameters (codepoint ranges, target artifact types, allowlists). YAML never expresses conditions or control flow. The moment a rule format grows branching, it becomes a bad programming language with no tooling, so the line is drawn at named-matcher-plus-parameters.

## 2026-07-19: CLI argument parsing via node:util parseArgs

No CLI framework. `parseArgs` from the standard library covers `scan`, `explain`, `rules`, and `baseline` with zero dependencies. Revisit only if subcommand help text becomes unmanageable by hand.

## 2026-07-19: No confidence score on findings

Findings carry severity only. Adding a confidence field later is backward compatible; removing one is not. If the false-positive corpus ever shows a rule that is valuable but uncertain, that is the trigger to revisit.

## 2026-07-19: Frontmatter parsed with the yaml package, not gray-matter

Not a dependency-count decision. We are a scanner: any gap between how we parse frontmatter and how the agent runtime parses it is a ready-made bypass. An attacker crafts frontmatter that we read one way and the runtime reads another, and the malicious field never reaches analysis. That is a classic parser differential. gray-matter wraps js-yaml (YAML 1.1); the `yaml` package implements YAML 1.2, and the two disagree on real inputs: `no`/`yes` as booleans, octal literals, duplicate-key handling. Owning the extraction step and the parser choice keeps that surface under our control and testable.

Two consequences. First, frontmatter extraction is written defensively in-house and covered by edge-case tests (BOM, CRLF, unclosed delimiter, duplicate keys, delimiter offsets). Second, a file whose frontmatter fails to parse is never silently skipped: an artifact we could not parse is an artifact we cannot call safe, so parse failures are a first-class result type that reaches the report.

Note the limit of this decision: choosing YAML 1.2 for ourselves does not close the differential, because runtimes built on js-yaml still read 1.1. That is what the backlogged detection rule below is for.

## Backlog: rule candidates

- **PS2, YAML version differential in frontmatter** (target: Phase 3). Frontmatter that parses to different values under YAML 1.1 and YAML 1.2 (`no` vs `"no"`, `0o17` vs `017`, duplicate keys) is hidden content in the literal sense: the reviewer's tooling and the agent runtime see different documents. Flag any frontmatter where the two parses disagree.

## 2026-07-19: Discovery defaults

Discovery skips `.git` and `node_modules`, never follows symlinks, and bounds recursion depth and file size. A symlinked artifact inside the scan root is still found at its real path; a symlink pointing outside the root must never be followed (CLAUDE.md §9). Scanning `node_modules` is a possible later opt-in, but the default optimizes for signal and speed on committed repo content.
