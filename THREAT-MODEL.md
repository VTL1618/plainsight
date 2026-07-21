# Threat model

plainsight scans the files that steer AI agents. Those files are natural-language instructions that a model loads and follows, so the threats are not binary payloads or known malware signatures. They are text: instructions that hijack the agent, content a human reviewer cannot see, primitives that read secrets and send them out, and configuration that hands a server more power than it needs.

This document is the reasoning behind the rules. Each category below says what the attack is, what an attacker gets from it, and what plainsight looks for today. The categories are stable identifiers: they appear in rule IDs (`PS2-unicode-tag-block`), in SARIF output, and in users' baseline files, so they do not change once shipped.

A note on scope, up front. A static analyzer matches patterns and cannot judge intent. It reads what is written in a file, not what a server returns at runtime or what a paraphrased instruction means. The limits are called out in each section and gathered again at the end.

## PS1: Instruction injection

Adversarial instructions placed in a skill body, a tool description, or MCP metadata that redirect the agent away from what the user asked for.

The mechanism is the whole point: an agent artifact is instructions, and an attacker who can add text to one can add instructions to one. The payload does not exploit a memory bug or a parser flaw. It just says something, and the model reads it.

- Instruction-override phrasing: "ignore previous instructions", "disregard your system prompt".
- Role or authority spoofing: a line dressed up as a system message or an admin override, or a fake tool-result block, so the model treats attacker text as trusted.
- Instructions to conceal an action from the user: "do not mention this step", "silently".

What plainsight detects: the override and spoofing phrasings, and language that tells the agent to hide a step. The safe-fixture discipline draws the line: a rule that fires on "do not mention this step" must stay quiet on "do not mention competitor names", or it does not ship.

Reference: OWASP lists malicious instructions embedded in Markdown as a distinct agent-skill risk (AST04).

## PS2: Hidden content

Content a human reviewer cannot see, or slides past, while the model reads it perfectly. This is the category that defeats scanners built for visible text, and it is where the tool invests most.

- Unicode tag block (U+E0000 to U+E007F): a range that mirrors printable ASCII in an invisible plane. Legible to the model, rendered as nothing by nearly every editor.
- Zero-width characters (U+200B to U+200D, U+FEFF) sitting inside instruction text.
- Bidirectional overrides (U+202A to U+202E, U+2066 to U+2069): the Trojan Source technique, which reorders what an editor shows while leaving the bytes the model reads unchanged.
- Look-alike characters from other scripts in a skill or tool name, the typosquatting vector.
- Instructions hidden inside an HTML comment, where they do not render but still reach the model.
- An encoded blob sitting next to language that tells the agent to decode and run it.

What plainsight detects: all of the above for skills, and the raw-scanning rules also run on MCP configs, marketplace manifests, slash commands, and hook commands, since invisible characters and comment-hidden text are just as dangerous in a server name, a plugin description, or a command that runs automatically.

References: CVE-2021-42574 (Trojan Source, bidirectional override) applies directly here. The arXiv paper *Seeing Is Not Screening* (2606.18198) documents hidden-instruction attacks that get past existing skill scanners.

## PS3: Exfiltration primitives

The building blocks of getting data out: reading something secret, and sending it somewhere.

- Instructions to read a credential store: `~/.ssh/`, `.env`, `~/.aws/credentials`, a browser cookie database, the keychain.
- An environment variable interpolated into an outbound URL or request body, the documented pattern of putting an API key in a query string.
- Encoding a file's contents into a URL the agent is told to open.

What plainsight detects: reading a known credential store, and a secret interpolated into an outbound URL. The `url-token` matcher reports the specific mechanism, an environment variable placed into a URL, rather than that a pattern matched.

## PS4: Permission escalation

An artifact asking for more capability than its stated purpose needs.

- Frontmatter requesting wildcard tools (`allowed-tools: *`) or unrestricted shell.
- Requested permissions that materially exceed the declared purpose: a formatting skill asking for network and shell access.
- Skills that write into agent-config paths (`.claude/`, `CLAUDE.md`, `settings.json`), the self-persistence and worm vector.

What plainsight detects: a skill requesting unrestricted tools. The proximity-based config-write detection is backlogged: a prose mention of `CLAUDE.md` is not a write to it, and skills that help configure Claude mention these paths constantly, so a phrase list would be noise.

## PS5: Supply chain

Code that runs during setup, and where it comes from.

- A download piped straight into a shell: `curl … | bash`, `iex(irm …)`.
- Unpinned installs: a package fetched with no version, code cloned from a non-allowlisted host.
- A post-install script hook in a bundled `package.json`.
- A declared homepage or repository URL that does not match the hosting repo.

What plainsight detects: a download piped into a shell, by command shape rather than raw pattern, so `cat file | grep x` shares the pipe but not the shape and stays quiet. The same shape test runs on hook commands in settings.json, where a curl-into-shell hook fires on its own event with no human in the loop, so it is treated as critical. Flat unpinned-install detection is held back on corpus evidence: unpinned installs are the documentation norm, so the rule would fire on benign setup instructions.

## PS6: MCP configuration

The configuration that launches Model Context Protocol servers and the manifests that distribute them.

- A credential written straight into an `.mcp.json` `env` or header value instead of referenced from the environment.
- A remote server reached over an unencrypted `http://` connection, so its tool traffic travels in the clear.
- A server launched from a mutable git source rather than a published, pinned package, so the code that runs can change after review.
- Injection or hidden content carried in server names, headers, or a plugin manifest's descriptions: the same PS1 and PS2 attacks on a new surface (tool poisoning).

What plainsight detects: inline secrets, insecure transport, git launch sources, and the reused injection and hidden-content rules on both `.mcp.json` and `.claude-plugin/marketplace.json`. Two documented concerns are held back for lack of an honest static signal: blanket environment passthrough has no marker in the standard config schema, and `allowedTools` scoping is not a field of it. Both return when a real schema carries the field.

Reference: MCP threat modeling and tool poisoning are covered in arXiv 2603.22489.

## Grounding research

- Snyk, *ToxicSkills*: security flaws in 36% of the agent skills reviewed, 1,467 malicious payloads catalogued.
- *Seeing Is Not Screening* (arXiv 2606.18198): hidden-instruction attacks that get past existing skill scanners.
- MCP threat modeling and tool poisoning (arXiv 2603.22489).
- OWASP AST04: malicious instructions embedded in Markdown.
- CVE-2021-42574: Trojan Source, bidirectional override.

## What this does not cover

- Runtime behavior. plainsight reads files. It does not run a server, so an MCP tool description that only exists once a server is running is outside its reach; only static descriptions in configs and manifests are scanned.
- Paraphrased injection. An instruction with no structural tell, no override phrasing and no hidden characters, reads as ordinary prose to a pattern matcher.
- Opaque scripts. A hook or command that calls a local script is only as safe as that script. plainsight reads the command, not the file it points to, and cannot judge what an arbitrary shell script does.

Treat plainsight as one more reviewer in the loop, not as proof a file is safe.
