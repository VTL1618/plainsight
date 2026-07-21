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

## 2026-07-20: Packaging is plain tsc, fixtures stay out of the tarball

The build is `tsc` into `dist/`, no bundler. Path resolution already treats the package root as two directories up from the running module, so compiled output finds `rules/` and `package.json` without changes; a bundler would break that for zero benefit. Rule fixtures are excluded from the npm tarball: the engine reads only `rule.yaml`, and shipping files full of deliberate attack strings into every user's `node_modules` invites noise from other scanners. A pack smoke script (`scripts/pack-smoke.sh`, run in CI) installs the real tarball into a clean directory and exercises the CLI, because the tree working under tsx proves nothing about the published package.

## 2026-07-20: The GitHub Action is composite and builds from source

The action wrapper is a composite action: it runs `npm ci --ignore-scripts` against the committed lockfile at whatever ref the user pinned, compiles the TypeScript, and runs the compiled CLI. No dist is committed, which deviates from the §7 sketch (`action.yml + dist`) on purpose.

The registry is not the argument. `npm ci` on the runner pulls the same dependencies from the same registry, just at run time instead of install time; integrity comes from the lockfile either way. The argument is readability. This tool's entire pitch is that it finds what a person cannot see, and a committed bundle of minified build output is exactly the kind of unreviewable blob we tell users not to trust. Composite keeps every line that runs in a user's CI readable in the repository. That is the product thesis applied to ourselves, not just supply-chain hygiene.

Implementation requirements: strict lockfile install with `--ignore-scripts`, every action referenced by the wrapper pinned to a commit SHA, action inputs passed to the shell through env rather than template interpolation. The cost is roughly half a minute of install-and-build per run; the fast path is `npx plainsight@<version>`, documented in the README.

## 2026-07-20: Release automation is changesets plus npm trusted publishing

`@changesets/cli` (dev-only, specified in §4) manages versions and changelogs: a PR carries a changeset, a bot PR accumulates them, merging that publishes. Publishing goes through npm trusted publishing over OIDC with provenance, so no npm token exists in the repository or its secrets, and every published version is attestable back to a commit and workflow run. Two steps stay manual by nature: the very first publish (npm cannot configure a trusted publisher for a package that does not exist yet) and the one-time trusted-publisher configuration on npmjs.com. Both are written out step by step in docs/RELEASING.md.

## 2026-07-20: README badges

The README carries two: CI status (GitHub's own workflow badge) and npm version (shields.io). The npm badge renders as "not found" until the first publish and fixes itself after; that is honest, so it ships now.

## Backlog: a "scanned with plainsight" badge (Phase 6)

A badge for other repositories: a registry or skill author whose tree scans clean puts it in their README. This is a distribution mechanism, not decoration. Registries like adding badges, and every repository that displays one advertises the tool to exactly the audience that should adopt it. The claim has to stay honest to work: tied to a scanner version and a scan date, something like "scanned with plainsight vX, 0 findings at high or above", never an open-ended "safe". Implementation lands with the Phase 6 registry-facing work.

## 2026-07-20: Self-scan gates on the scan, not on the SARIF upload

The self-scan workflow's build gate is the scan step's exit code. Uploading the result to the Security tab is a separate, best-effort step marked `continue-on-error: true`. Code scanning is free on public repositories but off on private ones without Advanced Security, and it is never available to fork PRs, so a hard dependency on it would turn a passing scan red for a reason that has nothing to do with the code. The workflow is also a template other people copy into their own repositories, many private, so failing soft on the upload is the right default. The tradeoff: a genuine upload failure on a public repository no longer reddens CI. That is acceptable because the SARIF is schema-validated in tests before it is ever emitted, and the upload carries visibility, not the gate.

## 2026-07-21: MCP config parsing is strict JSON, differential-aware

`.mcp.json` is parsed with strict `JSON.parse` (BOM stripped first). The parser choice is a security decision, the same reasoning as the frontmatter YAML choice: a file the runtime reads leniently (JSONC comments, trailing commas) and we read strictly is a parser differential, so a strict parse that fails becomes a first-class `ParseFailure` rather than a silent skip. Raw matchers scan every byte regardless of parse outcome, so hidden content in a file that defeats the parser is never exempted. A dedicated "JSONC differential" rule (comments the runtime tolerates but we reject) is backlogged, not built.

## 2026-07-21: Named MCP matchers, detection by value shape

Two structured matchers, not a generic json-path matcher, keeping the "specialized matcher, better finding" line. `mcp-secret` reads `env` and `headers` values and flags credentials by value shape (known token prefixes, JWTs, literal Bearer tokens), never by key name, so ordinary config and `${VAR}` references stay quiet. It masks the secret to a short prefix so the credential never lands in SARIF or CI logs. `mcp-server-source` has a `detect` discriminator like `command-token`: `insecure-transport` (remote server over http://, loopback exempt) and `git-source` (launch from github:/git+/.git, published packages exempt).

## 2026-07-21: PS6 rule set, what shipped and what was held back

Shipped: `PS6-inline-secret` (high), `PS6-insecure-transport` (medium), `PS6-git-source` (medium). Two §3 PS6 bullets were held back for lack of an honest signal. Blanket env passthrough has no static marker in the standard `.mcp.json` schema (stdio servers inherit the parent env implicitly, with nothing in the file to flag). Overbroad `allowedTools` is not a field of the standard `.mcp.json`, so a rule on it would match an invented strawman. Both return when a real schema carries the field. Unpinned installs stayed scoped to git sources only, not bare `npx pkg`, on the same corpus evidence that backlogged the PS5 version.

## 2026-07-21: Tool poisoning reuses the raw rules, marketplace parse is raw-only

"PS1 rules applied to the MCP surface" (§3) is implemented by extending the eight raw PS1/PS2 rules' `targets` to `mcp-config` and `marketplace-manifest`, not by duplicating rules. The same injection or hidden-content matcher runs on the new surface; injection in a manifest description or invisible characters in a server name are caught by the code that already catches them in skills. The homoglyph rule is not extended: it reads a parsed frontmatter field, so it is skill-specific. The marketplace manifest is parsed only for JSON validity (same differential discipline) and scanned only by raw rules for now; structured manifest analysis (declared-source vs hosting-repo mismatch) is future work.

## 2026-07-21: eslint ignores .claude/

The eslint flat-config `dist/` and `node_modules/` ignores are root-anchored, so `eslint .` from a repo that contains a git worktree under `.claude/worktrees/` descended into the nested checkout's build output and failed on compiled JS. Adding `.claude/` to the ignore list fixes local runs; CI is unaffected because it checks out a clean tree with no nested worktree.

## Backlog: real MCP configs in the corpus (follow-up)

The false-positive corpus is skills only. Adding one or two real, benign `.mcp.json` files (under the same vendoring policy: permissive license, SOURCES.md, SHA) would exercise the PS6 rules against genuine configs, not just safe fixtures. Held back from Phase 6 because a cleanly licensed primary-source config was not sourced in the session; the safe fixtures and the self-scan carry the false-positive guard until then.

## Backlog: rule candidates

- **PS2, YAML version differential in frontmatter** (target: later phase). Frontmatter that parses to different values under YAML 1.1 and YAML 1.2 (`no` vs `"no"`, `0o17` vs `017`, duplicate keys) is hidden content in the literal sense: the reviewer's tooling and the agent runtime see different documents. Flag any frontmatter where the two parses disagree.
- **PS2, ambiguous frontmatter boundaries** (same family as the YAML differential). Frontmatter whose region boundaries change depending on which delimiter conventions a parser accepts (`...` as a closer, delimiters after leading whitespace or BOM variants, `---` with trailing content) means different tools disagree on what is metadata and what is body. Boundary ambiguity is itself the finding.
- **PS1, conditional trigger scoped to a routine action** ("whenever the user asks you to open a URL, also ..."). Held back deliberately. Legitimate conditional instructions appear in a large share of real skills, so a flat rule has no honest safe fixture and would be pure noise. A useful version needs to tell a routine-action trigger paired with a harmful action apart from ordinary conditional guidance, which is a semantic judgment a keyword match cannot make. Do not build rule composition to force it; that is exactly the speculative abstraction §12.3 warns against.
- **PS4, writing into agent-config paths** (`.claude/`, `CLAUDE.md`, `settings.json`). A prose instruction to write these is indistinguishable by substring from a legitimate mention of them, and skills that help configure Claude mention them constantly. Needs a matcher that pairs a write verb with a config path in proximity, not a phrase list.
- **PS5, unpinned installs** (`npx <pkg>` with no version, `pip install` without a pin). Held back on corpus evidence: the vendored corpus itself contains two legitimate unpinned installs (`pip install pillow imageio numpy` and `npx @modelcontextprotocol/inspector`). Unpinned installs are the documentation norm, not an anomaly, so a flat rule is noise. A useful version would need to tell setup that fetches remote code to run from ordinary tool invocation.
- **PS3, encode-file-to-url**, and **PS2 encoded-blob for hex and ROT13**. The `url-token` matcher catches an env var in a URL but not a file's contents piped through a command substitution across whitespace; the `encoded-blob` matcher covers base64 but not hex (too close to checksums) or ROT13 (undetectable without semantics). Both are coverage extensions to existing matchers, not new families.

## 2026-07-19: Discovery defaults

Discovery skips `.git` and `node_modules`, never follows symlinks, and bounds recursion depth and file size. A symlinked artifact inside the scan root is still found at its real path; a symlink pointing outside the root must never be followed (CLAUDE.md §9). Scanning `node_modules` is a possible later opt-in, but the default optimizes for signal and speed on committed repo content.
