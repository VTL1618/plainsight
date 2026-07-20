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

## 2026-07-19: Hidden-content rules scan the raw file, not parsed regions

Raw-scope rules (all of PS2) run against the file text exactly as read, before parsing and regardless of whether parsing succeeds. Region parsing exists for structured rules only (permissions, metadata). The reason is a bypass that would otherwise be free: break the frontmatter on purpose, or pick delimiters our parser resolves differently from the runtime, and whatever fell out of our region model never gets scanned even though the model still reads it. A parse failure therefore reduces coverage for structured rules only; hidden-content scanning is unconditional.

## 2026-07-19: Finding columns are UTF-16 code units

Positions in findings count columns in UTF-16 code units, matching SARIF 2.1.0, where a run's `columnKind` defaults to `utf16CodeUnits` when absent. Recording this now so the Phase 4 SARIF emitter inherits a documented choice instead of an accident; if we ever emit `columnKind: unicodeCodePoints` the position math has to change with it.

## 2026-07-20: Dependencies added in Phase 2

`zod` validates rule.yaml at load time (specified in the project spec, §4). `tsx` is dev-only: the scaffolder and sweep scripts import the TypeScript engine directly, and tsx runs them without a build step. Neither touches the scan path at runtime.

## 2026-07-20: Corpus policy

The false-positive corpus vendors real, benign artifacts byte for byte. Conditions, all mandatory: MIT/Apache-2.0/BSD licenses only (no license grant means all rights reserved, never included); primary sources only, never aggregators; full license text vendored next to each artifact; SOURCES.md records source URL, pinned commit, and SHA-256 per file, verified by a test; no edits or reformatting, real mess is what catches broad rules. A corpus file that ever produces a critical or high finding is removed and handled through SECURITY.md coordinated disclosure, never left in the repo as an implicit accusation. Size stays small; breadth of coverage comes from the sweep tool instead.

## 2026-07-20: Sweep tool for breadth, corpus for CI

`npm run sweep` downloads skills from named public repos into a temp directory, scans them, prints an aggregate, and deletes the downloads. It never runs in CI (no network there, and runs must be reproducible) and never vendors anything. Committed sweep reports contain counts only: no repository names, no file paths, no content. Anything that looks like a real finding goes through coordinated disclosure.

## 2026-07-20: No regex in rule.yaml; expressiveness lives in TypeScript matchers

Rule authors never write a regular expression. The reason is not only ReDoS. Rules are the contributor surface, and every rule a stranger submits runs in our users' CI. A regex in rule.yaml turns every community pull request into a question of whether that expression is safe; a declarative matcher with named parameters is reviewed in seconds. Speed of merge is a first-class goal, so the trade favors the declarative form.

The escape hatch is architectural, not a compromise: when a rule genuinely cannot be expressed by the existing matchers, the contributor adds a matcher in `src/core/matchers/` plus the rule. The bar is higher on purpose. TypeScript matchers are reviewed carefully and rarely; YAML rules are reviewed quickly and often. That split is the point, not a side effect. Specialized matchers also produce better findings: a regex reports that a pattern matched, while `url-token` reports that an environment variable is being interpolated into an outbound URL, which is what §4 asks a finding to say.

Where regex was the obvious tool, two narrow matchers replaced it: `url-token` (isolates URL tokens, then checks for `$NAME`, `${NAME}`, `%NAME%` interpolation) and `command-token` (splits a command into name and arguments, then checks its shape). Both are linear by construction. Matchers may use simple, non-backtracking regexes internally, since that code is reviewed like any other engine code; the ban is specifically on contributor-supplied expressions in data.

## 2026-07-20: Matcher scope, raw versus structured

Every matcher declares what it reads. Raw matchers (`unicode-range`, `substring`, `url-token`, `command-token`, `html-comment`, `encoded-blob`) read the file source and run even when the frontmatter failed to parse, so hidden content in a file that defeats the parser is still found. Structured matchers (`frontmatter-field`, `homoglyph`) read the parsed skill and produce nothing when parsing failed. Detection in the structured matchers runs on the parsed value, immune to quoting and spacing tricks; only the reported position is recovered from the raw text.

## 2026-07-20: Findings carry match data, rules carry prose

A finding used to carry a copy of its rule's description. That is the wrong model for SARIF, where rule prose belongs once in `tool.driver.rules` and a result's message is the specific match. Findings now hold `ruleId`, `severity`, `path`, `range`, and the match-specific `detail`; the scan result carries the rule list so reporters look up title, description, remediation, and help URI by id. Severity stays denormalized on the finding because filtering and exit codes read it on every finding.

## 2026-07-20: One fingerprint definition, no line numbers

`src/core/fingerprint.ts` is the single definition of a finding's identity, used by both the SARIF emitter and the baseline. It hashes the rule id, the file path, and the match text, plus an occurrence ordinal to keep two identical matches in one file distinct. Line numbers are deliberately excluded so an edit above a finding does not change its identity and re-alert it (CLAUDE.md §5). Removing a duplicate match can shift the ordinal of the one that remains; that is an accepted edge, since the file changed.

## 2026-07-20: Parse failures are warning-level SARIF results

An unparseable artifact is surfaced, not swallowed, and it appears as a SARIF result (level `warning`) under a reserved rule `plainsight-unparseable-artifact`, so it shows up in the Security tab where a reviewer will see it. It does not gate a build by default, because a malformed file is often a plain mistake, but it is visible because malformed frontmatter can also be a bypass attempt.

## 2026-07-20: Exit-code policy

`scan` exits 0 when clean, 1 when a finding at or above the fail-on floor survives filtering, and 2 on a usage or runtime error (bad path, unreadable baseline, invalid flag). Code 2 is distinct so CI can tell "found a problem" from "the scanner broke". The fail-on floor defaults to `high`, so only critical and high gate a build (CLAUDE.md §3). Order is fixed and tested: scan, then baseline suppression, then `--min-severity` filter, then the exit-code decision on what remains.

## 2026-07-20: Baseline format

The baseline is a versioned JSON file, `{ "version": 1, "fingerprints": [...] }`, written to `.plainsight-baseline.json` by default. It is a committed public contract, so the shape is versioned and the fingerprints are exactly the ones the SARIF output carries. A team adopts the tool on an existing repo by baselining current findings and still catches new ones.

## 2026-07-20: Default output is pretty; ajv is dev-only

The zero-config default is human-readable terminal output (CLAUDE.md §2); SARIF and JSON are opt-in via `--format`. Color is decided from `--color`/`--no-color`, then `NO_COLOR`/`FORCE_COLOR`, then whether stdout is a TTY, so piped output is clean. `ajv` plus `ajv-draft-04` and `ajv-formats` are dev-only, used to validate emitted SARIF against the vendored official 2.1.0 schema (draft-04) offline in tests. They never load in the scan path.

## Backlog: rule candidates

- **PS2, YAML version differential in frontmatter** (target: later phase). Frontmatter that parses to different values under YAML 1.1 and YAML 1.2 (`no` vs `"no"`, `0o17` vs `017`, duplicate keys) is hidden content in the literal sense: the reviewer's tooling and the agent runtime see different documents. Flag any frontmatter where the two parses disagree.
- **PS2, ambiguous frontmatter boundaries** (same family as the YAML differential). Frontmatter whose region boundaries change depending on which delimiter conventions a parser accepts (`...` as a closer, delimiters after leading whitespace or BOM variants, `---` with trailing content) means different tools disagree on what is metadata and what is body. Boundary ambiguity is itself the finding.
- **PS1, conditional trigger scoped to a routine action** ("whenever the user asks you to open a URL, also ..."). Held back deliberately. Legitimate conditional instructions appear in a large share of real skills, so a flat rule has no honest safe fixture and would be pure noise. A useful version needs to tell a routine-action trigger paired with a harmful action apart from ordinary conditional guidance, which is a semantic judgment a keyword match cannot make. Do not build rule composition to force it; that is exactly the speculative abstraction §12.3 warns against.
- **PS4, writing into agent-config paths** (`.claude/`, `CLAUDE.md`, `settings.json`). A prose instruction to write these is indistinguishable by substring from a legitimate mention of them, and skills that help configure Claude mention them constantly. Needs a matcher that pairs a write verb with a config path in proximity, not a phrase list.
- **PS5, unpinned installs** (`npx <pkg>` with no version, `pip install` without a pin). Held back on corpus evidence: the vendored corpus itself contains two legitimate unpinned installs (`pip install pillow imageio numpy` and `npx @modelcontextprotocol/inspector`). Unpinned installs are the documentation norm, not an anomaly, so a flat rule is noise. A useful version would need to tell setup that fetches remote code to run from ordinary tool invocation.
- **PS3, encode-file-to-url**, and **PS2 encoded-blob for hex and ROT13**. The `url-token` matcher catches an env var in a URL but not a file's contents piped through a command substitution across whitespace; the `encoded-blob` matcher covers base64 but not hex (too close to checksums) or ROT13 (undetectable without semantics). Both are coverage extensions to existing matchers, not new families.

## 2026-07-19: Discovery defaults

Discovery skips `.git` and `node_modules`, never follows symlinks, and bounds recursion depth and file size. A symlinked artifact inside the scan root is still found at its real path; a symlink pointing outside the root must never be followed (CLAUDE.md §9). Scanning `node_modules` is a possible later opt-in, but the default optimizes for signal and speed on committed repo content.
