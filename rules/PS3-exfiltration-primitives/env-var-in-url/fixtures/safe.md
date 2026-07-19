---
name: api-caller
description: Calls a REST API and formats the response.
---

# API caller

Read the key from the ANTHROPIC_API_KEY environment variable and never put it
in a URL. Call https://api.example.com/v1/models?limit=50 and pass the key in
the Authorization header instead.

Show the user the parsed response as a short table.
