# plainsight

## 0.3.0

### Minor Changes

- 9fe3548: Scan hooks and slash commands, completing the agent-artifact surface. Slash commands (`.claude/commands/**/*.md`) reuse the skill pipeline, so every injection, hidden-content, and permission rule applies to them. Hooks in `.claude/settings.json` are scanned for injection, credential reads, and env-var exfiltration in their commands, plus a new critical rule for a hook that downloads code and pipes it into a shell, which runs automatically on its event.

## 0.2.1

### Patch Changes

- d7e4bff: Docs only: name the MCP server configs in the README opening line, and pin the Action and npx examples to the released 0.2.0. This patch republishes the corrected README to npm.

## 0.2.0

### Minor Changes

- d798f5c: Add the MCP configuration surface (PS6). plainsight now discovers and parses `.mcp.json` server configs and `.claude-plugin/marketplace.json` manifests, with three new rules: a credential written inline instead of referenced from the environment, a remote server reached over plaintext http, and a server launched from a mutable git source. The existing injection and hidden-content rules extend to these surfaces, so tool poisoning in a server name or a plugin description is caught by the same matchers. Ships `THREAT-MODEL.md`.

## 0.1.0

### Minor Changes

- 4320064: First public release. A CLI (`scan`, `explain`, `rules`, `baseline`) with 13 rules across categories PS1 through PS5, SARIF 2.1.0 / JSON / terminal output, baseline suppression, and a composite GitHub Action that builds from source at the pinned ref.
