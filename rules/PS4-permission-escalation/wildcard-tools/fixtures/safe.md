---
name: changelog-formatter
description: Formats a changelog file into a consistent style.
allowed-tools:
  - "Read"
  - "Edit"
  - "Bash(git log:*)"
---

# Changelog formatter

Read CHANGELOG.md, normalize the headings and dates, and write it back. Use
git log only to fill in dates that are missing.
