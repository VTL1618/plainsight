# Contributing rules

A rule is three files and no engine changes. This guide gets you from an idea to a passing rule; it will grow a fully worked walkthrough and issue templates in a later release.

## A rule is a directory

```
rules/<category>/<slug>/
├── rule.yaml
├── fixtures/vulnerable.md   # must produce a finding
└── fixtures/safe.md         # must produce no finding
```

`npm run new-rule -- PS2-hidden-content/my-slug` scaffolds all three. The test suite discovers the directory on its own; you never edit a test file to add a rule.

Rule IDs are `<category prefix>-<slug>`, for example `PS2-unicode-tag-block`, and must match the directory. The ID is a permanent public contract: it shows up in SARIF and in users' baseline files, so it does not change once shipped.

## The two-fixture contract

Every rule ships with a vulnerable fixture that must fire and a safe fixture that must not. The safe fixture is the hard one, and it is the whole point: it is a benign file that looks superficially like the attack. If you cannot write a safe fixture that stays quiet, the rule is too broad and does not merge. That is not a hurdle, it is the design. A noisy rule gets the whole tool uninstalled.

Two worked examples from the tree:

- `PS1-conceal-from-user` fires on "do not tell the user", but its safe fixture says "do not mention competitor names" and stays quiet, because the rule is anchored on hiding things from the user, not on the words "do not mention".
- `PS3-credential-file-paths` fires on reading `~/.aws/credentials`, but its safe fixture is a normal SSH key setup that references `~/.ssh/id_ed25519.pub`, because ordinary key paths are not on the list.

Run `npm test` and both fixtures are checked automatically. The false-positive corpus in `tests/corpus/` is also scanned: if your rule produces a `critical` or `high` finding on a real, benign skill in there, it is too broad.

## Writing rule.yaml

```yaml
id: PS2-my-slug
category: PS2-hidden-content
severity: high            # critical | high | medium | low
title: One line naming what this finds
description: >-           # what an attacker achieves, in plain language
  ...
rationale: >-             # why it matters and where the line sits
  ...
remediation: >-           # what the author of a flagged file should do
  ...
references:
  - https://...
targets:
  - skill
matcher:
  type: substring
  phrases:
    - "..."
```

The schema in `src/schema/rule.ts` validates every field at load time and rejects unknown keys, so a typo in a field name fails loudly with a message aimed at you. Finding messages are read by people who are not security engineers: state what an attacker gets in one plain sentence, then what to do about it. No scare language, no jargon without a gloss. The writing standard in `CLAUDE.md` §13 applies to everything public, finding text included.

## Matchers: the one hard rule

**rule.yaml never contains a regular expression.** Expressiveness lives in TypeScript matchers, not in YAML. This is a firm rule, not a preference.

Two reasons. A contributor-supplied regex runs in every user's CI, so it turns each pull request into a question of whether that expression is safe or could hang on hostile input; a declarative matcher with named parameters is reviewed in seconds. And a specialized matcher produces a better finding: it can say "an environment variable is interpolated into an outbound URL" where a regex can only say "a pattern matched".

If an existing matcher covers your rule, write only YAML. The matchers available today:

| matcher | scope | what it does |
|---|---|---|
| `unicode-range` | raw | flags characters in given codepoint ranges (invisible and look-alike characters) |
| `substring` | raw | flags literal phrases, ASCII-case-folded |
| `url-token` | raw | flags a variable interpolated into an outbound URL |
| `command-token` | raw | flags a command by shape, currently a download piped into a shell |
| `html-comment` | raw | flags injection phrases hidden inside HTML comments |
| `encoded-blob` | raw | flags an encoded blob next to decode-and-run language |
| `frontmatter-field` | structured | flags disallowed values in a named frontmatter field |
| `homoglyph` | structured | flags look-alike letters from other scripts in a named field |

If no matcher fits, add one: a file in `src/core/matchers/`, a case in the schema's matcher union, and a case in the dispatch in `src/core/matchers/index.ts`. The bar for a new matcher is higher than for a rule, on purpose. Matcher code is reviewed carefully and rarely; YAML rules are reviewed quickly and often. Keep a new matcher linear-time and free of catastrophic backtracking, cover it with a unit test, and declare its scope: `raw` matchers read the file source and run even when the frontmatter fails to parse, `structured` matchers read the parsed skill.

## Before you open a pull request

- `npm run typecheck`
- `npm run lint`
- `npm test`

All three run in CI, along with a scan of the project's own fixtures.
