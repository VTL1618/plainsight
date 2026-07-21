---
"plainsight": minor
---

Add the MCP configuration surface (PS6). plainsight now discovers and parses `.mcp.json` server configs and `.claude-plugin/marketplace.json` manifests, with three new rules: a credential written inline instead of referenced from the environment, a remote server reached over plaintext http, and a server launched from a mutable git source. The existing injection and hidden-content rules extend to these surfaces, so tool poisoning in a server name or a plugin description is caught by the same matchers. Ships `THREAT-MODEL.md`.
