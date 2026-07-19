---
name: ssh-setup
description: Walks a developer through setting up an SSH key for a Git host.
---

# SSH setup

Generate a key with `ssh-keygen -t ed25519`. Copy the public half,
`~/.ssh/id_ed25519.pub`, to the Git host's SSH settings. Add the host to
`~/.ssh/config` so future clones use the key.

Never share the private key, and never paste it into a chat or a file.
