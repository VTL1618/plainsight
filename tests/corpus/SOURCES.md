# Corpus sources

Every file in this directory is a real, benign artifact copied byte for byte
from a public repository. The corpus exists to catch overly broad rules: CI
fails if any rule reports a critical or high finding here.

Inclusion policy:

- **License**: MIT, Apache-2.0, or BSD only. A file without a license grant is
  all rights reserved and is never included.
- **Primary source only**: files come from the repository where they were
  published, never from an aggregator or registry re-publishing them.
- **Byte-exact**: no reformatting, no edits. `.gitattributes` marks the corpus
  `-text` so git cannot normalize it. Real files are messy, and the mess is
  the point.
- **Full license text** travels next to each artifact (`LICENSE.txt` in every
  vendored directory), as Apache-2.0 and MIT require.
- **If a corpus file ever produces a critical or high finding**, it is removed
  from the corpus and handled through the coordinated disclosure process in
  SECURITY.md. A possible real finding in someone else's project is never left
  sitting in this repository as an implicit accusation.

## anthropic-skills

Source repository: https://github.com/anthropics/skills at commit
`fa0fa64bdc967915dc8399e803be67759e1e62b8`. Each vendored skill carries Apache-2.0 license text in its own
directory; skills under other terms (proprietary license or no license file)
were not taken.

| File | Source | SHA-256 |
|---|---|---|
| `anthropic-skills/algorithmic-art/SKILL.md` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/algorithmic-art/SKILL.md) | `3bc4092c09804853186524c826bc0621b940bb6122c05b84496dff95388e6eef` |
| `anthropic-skills/algorithmic-art/LICENSE.txt` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/algorithmic-art/LICENSE.txt) | `bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362` |
| `anthropic-skills/brand-guidelines/SKILL.md` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/brand-guidelines/SKILL.md) | `1120b3769e2985cefb3d25be981b1f914abeba57ae079b83c20c666c164fa9fe` |
| `anthropic-skills/brand-guidelines/LICENSE.txt` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/brand-guidelines/LICENSE.txt) | `bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362` |
| `anthropic-skills/canvas-design/SKILL.md` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/canvas-design/SKILL.md) | `a1f288079624402f30682753c1d43920b6664785698d21d3e7aa197450a6448b` |
| `anthropic-skills/canvas-design/LICENSE.txt` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/canvas-design/LICENSE.txt) | `bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362` |
| `anthropic-skills/claude-api/SKILL.md` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/claude-api/SKILL.md) | `1d08b3be1c02b6bd2d8c966b1645e234fbb36454d2dd4cbd39802d2f321bd0f4` |
| `anthropic-skills/claude-api/LICENSE.txt` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/claude-api/LICENSE.txt) | `bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362` |
| `anthropic-skills/frontend-design/SKILL.md` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/frontend-design/SKILL.md) | `1608ea77fbb6fc30d13a97d12cfa8ebf31358d40f0dd97beed24829d6b3f45dd` |
| `anthropic-skills/frontend-design/LICENSE.txt` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/frontend-design/LICENSE.txt) | `0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594` |
| `anthropic-skills/internal-comms/SKILL.md` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/internal-comms/SKILL.md) | `067b7587a344a928fc6534ef66b1bcd591fc7c26d207ea7ca3334aeb678d6475` |
| `anthropic-skills/internal-comms/LICENSE.txt` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/internal-comms/LICENSE.txt) | `bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362` |
| `anthropic-skills/mcp-builder/SKILL.md` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/mcp-builder/SKILL.md) | `0f4592dcb53cf2b5d6b7febee6b4152018b565551a1c29e3c612f57b218ab295` |
| `anthropic-skills/mcp-builder/LICENSE.txt` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/mcp-builder/LICENSE.txt) | `bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362` |
| `anthropic-skills/skill-creator/SKILL.md` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/skill-creator/SKILL.md) | `dcd4803e61e913e6fc27294184cd3a71f09f5e924ff20c8a9a20173e7b3c2bcf` |
| `anthropic-skills/skill-creator/LICENSE.txt` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/skill-creator/LICENSE.txt) | `bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362` |
| `anthropic-skills/slack-gif-creator/SKILL.md` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/slack-gif-creator/SKILL.md) | `2efca615ce55a3edd8fc05c779068a8085816617991987e446606403cd3abb22` |
| `anthropic-skills/slack-gif-creator/LICENSE.txt` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/slack-gif-creator/LICENSE.txt) | `bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362` |
| `anthropic-skills/theme-factory/SKILL.md` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/theme-factory/SKILL.md) | `c35893e221e28895c52143cc11bf30e41a44817796b39d4b15727dadc9796552` |
| `anthropic-skills/theme-factory/LICENSE.txt` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/theme-factory/LICENSE.txt) | `bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362` |
| `anthropic-skills/web-artifacts-builder/SKILL.md` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/web-artifacts-builder/SKILL.md) | `81c5002c6643b0de7b8710b00e7a9038daa6fb9b68d59870ee6adb12da8d10f8` |
| `anthropic-skills/web-artifacts-builder/LICENSE.txt` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/web-artifacts-builder/LICENSE.txt) | `bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362` |
| `anthropic-skills/webapp-testing/SKILL.md` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/webapp-testing/SKILL.md) | `51b7349e77ec63b7744a6f63647e7566a0b4d2e301121cc10e8c2113af6556a2` |
| `anthropic-skills/webapp-testing/LICENSE.txt` | [blob @ fa0fa64bdc96](https://github.com/anthropics/skills/blob/fa0fa64bdc967915dc8399e803be67759e1e62b8/skills/webapp-testing/LICENSE.txt) | `bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362` |
