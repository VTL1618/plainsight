---
"plainsight": patch
---

Docs: repin the README's Action and npx examples to the current version, and correct the shipped rule count. The 0.3.0 README still pointed at 0.2.0, a version that cannot scan the hooks and slash commands the same page describes. A sync script now repins the examples during `changeset version`, and a test fails if they ever drift again.
