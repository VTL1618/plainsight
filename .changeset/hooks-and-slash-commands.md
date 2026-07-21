---
"plainsight": minor
---

Scan hooks and slash commands, completing the agent-artifact surface. Slash commands (`.claude/commands/**/*.md`) reuse the skill pipeline, so every injection, hidden-content, and permission rule applies to them. Hooks in `.claude/settings.json` are scanned for injection, credential reads, and env-var exfiltration in their commands, plus a new critical rule for a hook that downloads code and pipes it into a shell, which runs automatically on its event.
