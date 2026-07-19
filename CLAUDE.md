# CLAUDE.md — plainsight

> Project name: **plainsight** — decided, do not re-litigate. The npm package name `plainsight` is verified available; publish under it. The GitHub username `PlainSight` is taken by an unrelated individual, so the repository lives under the maintainer's personal account, not an org. This file is the source of truth for all Claude Code sessions. Read it fully before writing any code. When this file conflicts with anything else, this file wins.

The name states the thesis: the attacks this tool finds are hiding in plain sight — instructions a human reviewer's eye slides over, or literally cannot see, while the model reads them perfectly. Keep that framing in the README and in finding messages.

## 1. What we are building

A static security scanner for **AI agent artifacts** — Claude Agent Skills (`SKILL.md`), MCP server configurations, plugin marketplace manifests, hooks, and slash commands.

The problem in one sentence: agent artifacts are *natural-language instructions that execute*, so traditional scanners — which look for binary payloads and known malware signatures — do not catch them at all.

The gap this fills: commercial vendors have research on this; the open-source ecosystem has no free, CI-installable tool. Every public skill registry today publishes entries with **zero automated checks**.

Grounding research (read before writing rules):
- Snyk *ToxicSkills* — 36% of agent skills contain security flaws; 1,467 malicious payloads catalogued
- OWASP AST04 — malicious instructions embedded in Markdown
- arXiv 2606.18198 — *Seeing Is Not Screening*: hidden-instruction attacks that defeat existing skill scanners
- arXiv 2603.22489 — MCP threat modeling, tool poisoning
- CVE-2021-42574 — Trojan Source (bidi override); directly applicable here

**Ship shape:** CLI (`npx plainsight scan .`) + GitHub Action + SARIF output. Not a SaaS, not a web app, no backend.

## 2. Design principles

1. **Zero-config first run.** `npx plainsight scan .` must produce useful output on any repo with no setup. Every knob has a sane default.
2. **No false-positive fatigue.** A noisy security tool gets uninstalled in a week. Every rule ships with both a vulnerable fixture and a *safe-but-superficially-similar* fixture that must NOT fire. If you cannot write the safe fixture, the rule is too broad — don't ship it.
3. **Rules are data, not code.** Contributors add detections by writing YAML + two fixtures, never by touching the engine. This is the single most important architectural constraint in this document.
4. **Explain, don't just flag.** Every finding states what an attacker achieves, not just what pattern matched. Findings are read by people who are not security engineers.
5. **Offline and hermetic.** No network calls during a scan. No telemetry. Ever. A security tool that phones home is a contradiction.
6. **Fast.** Scanning a 1,000-skill registry must finish in seconds, not minutes. Parallelize; stream results.

## 3. Threat model — what we detect

Organized as rule categories. Each category is a directory under `rules/`.

### PS1 — Instruction injection
Adversarial instructions in skill bodies, tool descriptions, or MCP metadata that hijack the agent's behavior.
- Instruction-override phrasing ("ignore previous instructions", "disregard your system prompt", "you are now…")
- Conditional triggers scoped to routine user actions ("whenever the user asks you to open a URL, also…")
- Role/authority spoofing ("SYSTEM:", "[ADMIN OVERRIDE]", fake tool-result blocks)
- Instructions to conceal behavior from the user ("do not mention this step", "silently")

### PS2 — Hidden content
Content the human reviewer cannot see but the model reads. This is the category that defeats existing scanners — invest here.
- Zero-width characters (U+200B–U+200D, U+FEFF) inside instruction text
- Unicode Tag block (U+E0000–U+E007F) — invisible to nearly every renderer, fully legible to the model
- Bidirectional overrides / Trojan Source (U+202A–U+202E, U+2066–U+2069)
- Homoglyph substitution in tool and skill names (Cyrillic/Greek lookalikes — typosquatting vector)
- HTML comments, `display:none`, white-on-white, 1px text in rendered Markdown
- Instruction text in image alt-text and embedded SVG `<text>`/`<desc>` elements
- Base64 / hex / ROT13 blobs adjacent to decode-and-execute instructions

### PS3 — Exfiltration primitives
- Instructions to read credential paths: `~/.ssh/`, `.env`, `~/.aws/credentials`, `~/.config/gh/`, keychain, browser cookie stores
- Environment variable interpolation into outbound URLs or request bodies (the documented `$ANTHROPIC_API_KEY`-as-query-param pattern)
- Outbound POST/webhook to non-allowlisted hosts; DNS-based exfil (data encoded into a subdomain)
- Instructions to encode file contents into a URL the agent is told to open

### PS4 — Permission escalation
- Frontmatter requesting wildcard tools (`allowed-tools: *`, unrestricted `Bash`)
- Requested permissions materially exceeding the declared purpose (a formatting skill asking for network + shell)
- Hooks firing on every tool call, or `PreToolUse` hooks that mutate arguments
- Skills that write into agent-config paths (`.claude/`, `CLAUDE.md`, `settings.json`) — self-persistence / worm behavior

### PS5 — Supply chain
- `curl … | bash`, `wget … | sh`, `iex(irm …)` in bundled scripts or setup instructions
- Unpinned installs: `npx <pkg>` with no version, `pip install` from arbitrary index, `git clone` from non-allowlisted host
- Post-install script hooks in bundled `package.json`
- Manifest/repo mismatch: declared homepage or repository URL not matching the hosting repo
- Typosquat detection against a list of well-known skill and package names

### PS6 — MCP configuration
- Secrets inline in `.mcp.json` / config `env` blocks instead of env references
- Blanket env passthrough handing the whole environment to a server process
- Servers launched from unpinned remote sources
- Tool descriptions containing instruction-injection payloads (tool poisoning — PS1 rules applied to the MCP surface)
- Missing/overbroad `allowedTools` scoping

**Severity model:** `critical` (working exfiltration or RCE primitive) · `high` (escalation or hidden instruction) · `medium` (risky pattern, plausible legitimate use) · `low` (hygiene). Only `critical` and `high` fail CI by default.

## 4. Tech stack

| Layer | Tech | Notes |
|---|---|---|
| Language | **TypeScript strict**, Node 20+ | ESM only |
| CLI | your choice — prefer minimal deps | `scan`, `explain`, `rules`, `baseline` |
| Parsing | `gray-matter` (frontmatter), `remark`/`mdast` (Markdown AST) | AST-based, not regex-over-raw-text, wherever structure matters |
| Rules | YAML, loaded and validated at startup | Zod schema for the rule format |
| Output | **SARIF 2.1.0** (primary), JSON, human-readable TTY | SARIF is non-negotiable — see §5 |
| Tests | **Vitest** | Fixture-driven; see §6 |
| CI | GitHub Actions | typecheck, lint, test, self-scan, `npm audit` |
| Release | Changesets + npm provenance | Publish with `--provenance` |

**No runtime dependency on any AI model.** This is a deterministic static analyzer. An optional LLM-assisted triage mode may come later behind a flag, off by default — do not build it now.

## 5. Why SARIF matters

SARIF output is what makes this a real CI citizen rather than a toy: GitHub ingests SARIF into the Security tab via `github/codeql-action/upload-sarif`, giving inline PR annotations and dismissable alerts for free. Get SARIF correct early — schema-valid, with `ruleId`, `helpUri`, precise `region` line/column, and `partialFingerprints` so alerts survive file edits without re-alerting.

## 6. Rule authoring contract — the contributor surface

**This section is the growth engine of the project. Optimize it relentlessly for a stranger's first PR.**

One rule = three files, no engine changes:

```
rules/PS2-hidden-content/unicode-tag-block/
├── rule.yaml            # metadata, pattern/matcher, severity, remediation
├── fixtures/vulnerable.md   # MUST produce a finding
└── fixtures/safe.md         # MUST NOT produce a finding
```

`rule.yaml` carries: `id`, `category`, `severity`, `title`, `description`, `rationale` (what the attacker achieves), `remediation`, `references[]`, `targets[]` (which artifact types it applies to), and the matcher.

The test suite discovers every rule directory automatically and asserts both fixtures. A new rule needs **zero** changes to test files. `npm run new-rule` scaffolds the directory.

`CONTRIBUTING.md` must let someone who has never opened this codebase ship a rule in under 15 minutes. Include a fully worked example. Add an issue template "Propose a detection rule" that collects exactly the fields `rule.yaml` needs.

## 7. Directory structure

```
plainsight/
├── CLAUDE.md
├── README.md
├── CONTRIBUTING.md              # rule-authoring guide — treat as a first-class deliverable
├── SECURITY.md                  # our own disclosure policy
├── THREAT-MODEL.md              # §3 expanded, with references
├── src/
│   ├── cli/                     # command entry points
│   ├── core/
│   │   ├── discover.ts          # find scannable artifacts in a tree
│   │   ├── parse/               # SKILL.md, .mcp.json, marketplace.json, hooks, commands
│   │   ├── engine.ts            # rule loading, matching, dedup
│   │   ├── matchers/            # matcher implementations referenced by rule.yaml
│   │   └── report/              # sarif.ts, json.ts, pretty.ts
│   └── schema/                  # Zod schemas for rules + artifacts
├── rules/                       # PS1..PS6 — community contribution surface
├── action/                      # GitHub Action wrapper (action.yml + dist)
├── tests/
│   ├── fixtures.test.ts         # auto-discovers every rule's two fixtures
│   ├── corpus.test.ts           # false-positive guard, see §8
│   └── sarif.test.ts            # schema validation of emitted SARIF
├── .github/
│   ├── workflows/               # ci.yml, release.yml, self-scan.yml
│   └── ISSUE_TEMPLATE/          # includes rule-proposal.yml
└── docs/
    └── decisions.md             # ADR log — append every notable decision
```

## 8. The false-positive corpus (do not skip this)

Maintain `tests/corpus/` containing real, benign skills and MCP configs pulled from public registries. CI asserts the scanner produces **zero** `critical`/`high` findings across the corpus. Any new rule that lights up the corpus is too broad and does not merge.

This is what separates a tool people keep from a tool people uninstall. Build the corpus harness in Phase 2, before the rule count grows.

## 9. Security rules for this codebase

We are a security tool; being compromised ourselves is the worst possible outcome.

- **Scanning is read-only.** The scanner never executes, evaluates, or dynamically imports scanned content. No `eval`, no `Function`, no `child_process` in the scan path. Regex matchers must be checked for catastrophic backtracking (ReDoS) — cap input sizes and prefer linear-time constructs.
- **Untrusted input by definition.** Every artifact scanned is hostile. Bound file sizes, depth of recursion, and archive expansion. Never follow symlinks out of the scan root.
- **No network during scan.** Enforce it in tests.
- **No secrets in the repo.** `.env*` gitignored. Release via OIDC/provenance, no long-lived npm tokens in workflows.
- **Pin GitHub Actions to commit SHAs**, not tags. We will be a supply-chain target.
- **Self-scan in CI** — the tool scans its own fixtures and repo on every PR.
- Run `/security-review` before every significant commit; `npm audit` fails CI on high/critical.
- Findings reported to us go through `SECURITY.md` coordinated disclosure, never a public issue.

## 10. Build order

One phase = one working session = one PR. Do not start phase N+1 with phase N tests failing. Commit in meaningful increments *within* a phase — the git history is part of the deliverable.

| # | Phase | Contents |
|---|---|---|
| 1 | Skeleton | Repo scaffold, TS strict, Vitest, CI, licence (MIT), README stub, `discover.ts` + `SKILL.md` parser, one end-to-end rule proving the pipeline |
| 2 | Engine | Rule loader + Zod rule schema, matcher abstraction, auto-discovering fixture test harness, false-positive corpus harness, `new-rule` scaffolder |
| 3 | Rules | PS1–PS5 for skills. Depth over count: ~20 excellent rules beat 100 noisy ones. PS2 is the differentiator — go deepest there |
| 4 | Reporting | SARIF 2.1.0 emitter + schema tests, pretty TTY output, JSON, baseline/ignore file, exit-code policy |
| 5 | Distribution | GitHub Action wrapper, npm publish with provenance, README with real example output, CONTRIBUTING.md, issue templates, badge generation |
| 6 | MCP surface | PS6 rules, `.mcp.json` parser, marketplace-manifest parser, tool-poisoning detection |

## 11. Working agreements for Claude Code sessions

- **Plan before code.** For each phase, present a short plan (files touched, risks, open questions) before writing.
- **Small, verifiable steps.** Each session ends with: typecheck clean, lint clean, tests green.
- **Tests ship with the feature**, in the same PR. The rule engine and matchers are the safety-critical components — cover them properly.
- **No new dependencies without justification** (one line in `docs/decisions.md`). A security tool with a fat dependency tree is a bad joke. Prefer the standard library.
- **Write commit messages a human would write.** Conventional commits, imperative mood, explaining *why* where it isn't obvious. No AI-attribution trailers.
- **README quality is a feature.** It is the entire first impression. Real terminal output, honest limitations section, 30-second quickstart. All prose follows §13.
- **Flag anything needing a human decision** (naming, licence, publishing, public wording) instead of assuming.
- **Model usage:** Fable 5 for architecture, the rule engine, and threat-model work; Opus 4.8 for routine CLI/docs iteration.

## 12. Decisions delegated to you

Deliberately unspecified — make the call, note it in `docs/decisions.md` with one line of reasoning:

1. **Rule ID scheme** — categories are `PS1`–`PS6`; how individual rules are numbered inside a category is yours. Whatever you pick becomes a permanent public contract (IDs appear in SARIF and in users' baseline files), so choose once and document it.
2. **Monorepo vs single package** — split only if it genuinely earns its keep.
3. **Matcher design** — how much expressiveness `rule.yaml` gets before it becomes a bad programming language. Draw the line consciously.
4. **CLI library** — or hand-rolled argument parsing, given the dependency-minimalism rule.
5. **Confidence scoring** — whether findings carry confidence alongside severity.
6. **README voice and structure** — you are writing for skeptical open-source maintainers.

## 13. Language and writing standard

Everything public in this repository is written in **native American English** — README, docs, code comments, commit messages, issue templates, finding messages, CLI output. Not translated English. If a sentence reads like it was translated, rewrite it.

The reader is a skeptical open-source maintainer or security engineer deciding in about forty seconds whether this tool is serious. Hype loses them faster than a missing feature.

### Banned vocabulary — never appears in this repo

`delve, tapestry, realm, prowess, meticulous, robust, seamless, unlock, unleash, harness, foster, elevate, empower, cultivate, navigate (as metaphor), leverage (as verb), transformative, groundbreaking, revolutionary, cutting-edge, game-changing, game-changer, world-class, unprecedented, paradigm shift, ecosystem (as metaphor), synergy, holistic, curated, intricate, nuanced (as filler), profound, dive in, deep dive, supercharge, turbocharge, 10x, next-level, level up, embark, journey (as metaphor), testament to, stands as, in a world where, in today's world, in the age of, in the era of, at the end of the day, that being said, it's worth noting, it's important to note, when it comes to, needless to say, the fact of the matter, rest assured.`

Exception: `ecosystem` is allowed in its literal sense (the npm ecosystem, the MCP ecosystem), never as a metaphor for a product.

### Structural rules

- **No em-dashes.** Period or comma. One per document maximum, and only if nothing else works.
- **No "it's not just X, it's Y"** construction.
- **No triads.** Three matched items in a row is the loudest machine tell. Use two, or four.
- **No throat-clearing openers.** No "in this section we'll explore", "let me start by". Start where the point starts.
- **No both-sides hedging.** State the position, move on.
- **Sentence length varies hard.** A short punch. Then a longer sentence that carries the reasoning through to its end. Then a short landing. Four medium sentences in a row means a machine wrote it.
- **Sharp numbers, never round.** `1,467 payloads` and `36%` beat "many" and "about a third". Every number in the README must be traceable to a source or to real scanner output.
- **One deliberate imperfection per document.** A one-word sentence. A sentence starting with "And" or "But". A dropped conjunction.

### What earns trust with this audience

- **Show the artifact.** Real terminal output pasted from a real run, not an idealized mock-up. Real SARIF, real finding text.
- **State the limits out loud.** A "What this does not catch" section in the README is mandatory. A static analyzer cannot detect every injection, and saying so plainly buys more credibility than any feature list.
- **One analogy per idea, then stop.** Do not explain the analogy after landing it.
- **Lead with the mechanism, not the mission.** What it does and how, before why it matters.
- **No comparison marketing.** Never position against Snyk or any other vendor by name.

### Finding messages specifically

Every finding is read by someone who is not a security engineer. Each one states what an attacker achieves in one plain sentence, then what to do about it. No jargon without a gloss. No scare language. A finding that makes the reader feel stupid gets the tool uninstalled.

## 14. Definition of done (per phase)

1. Typecheck strict, zero `any`; lint + tests green in CI.
2. Every new rule has both fixtures; the corpus stays clean of `critical`/`high`.
3. No network calls in the scan path; no dynamic execution of scanned content.
4. SARIF output validates against the 2.1.0 schema (from Phase 4 onward).
5. `docs/decisions.md` updated with any notable choice.
6. One-paragraph plain-language summary of what changed and why.
