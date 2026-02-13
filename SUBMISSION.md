---
title: "Specter: Give Your Codebase a Voice"
published: false
description: "A CLI that builds a knowledge graph and lets your codebase speak in first person. 66 commands, 14 MCP tools, and a ghost."
tags: githubcopilotcli, devchallenge, cli, typescript
---

This is a submission for the [GitHub Copilot CLI Challenge](https://dev.to/challenges/github-2026-01-21)

## What I Built

**Specter** is a code analysis CLI that speaks *as* your codebase in first person. It builds a knowledge graph from your source code and git history, then uses that graph to power 66 commands across analysis, fun/shareable, daily workflow, and AI-powered categories.

The twist: Specter has personality. Your codebase literally talks about itself.

```
"I'm feeling pretty good about myself. My complexity hotspots are
 under control, though src/legacy/parser.ts keeps me up at night..."
```

### Why I Built It

Developer tools are powerful but dry. Nobody shares a SonarQube report on Twitter. I wanted to build something that gives developers the insights they need (health scores, complexity hotspots, DORA metrics) while also being genuinely fun to use and share.

The result: a tool where `specter roast` tears your code apart with animated glitch effects, `specter tinder` creates a dating profile for your codebase, and `specter anthem` generates a theme song in 8 genres based on your actual metrics.

### Key Features

**Serious Analysis (that actually helps)**
- `specter health` — Health report with complexity distribution and animated score reveal
- `specter hotspots` — Complexity x churn scatter plot with quadrant analysis
- `specter dora` — DORA metrics for delivery performance
- `specter bus-factor` — Knowledge concentration risks
- `specter coupling` — Hidden couplings between files
- `specter cycles` — Circular dependency detection
- `specter cost` — Tech debt estimated in dollars

**Fun & Shareable (that make people install it)**
- `specter roast` — Comedic codebase roast with animated glitch intro
- `specter tinder` — Dating profile for your code with green/red flags
- `specter wrapped` — Spotify Wrapped-style year in review
- `specter anthem` — Stats-driven theme song (8 genres)
- `specter fame` — Compare your codebase to famous open-source projects
- `specter horoscope` — Daily code horoscope based on commit patterns
- `specter obituary <file>` — Memorial for a file about to be deleted
- `specter seance` — Summon spirits of deleted code from git history

**Daily Workflow**
- `specter morning` — Daily standup briefing
- `specter precommit` — Risk check before committing
- `specter predict` — PR impact prediction
- `specter fix` — Actionable fix suggestions with interactive mode
- `specter tour` — Guided walkthrough for new developers

**12 Personality Modes** — Add `--personality <mode>` to any command: default, mentor, critic, historian, cheerleader, minimalist, noir, therapist, roast, dramatic, ghost, and more.

**CI/CD Ready** — Every analysis command supports `--json` for machine-readable output and `--exit-code` for quality gates.

### MCP Server: 14 Tools for GitHub Copilot CLI

Specter's MCP integration is the core of this submission. One command adds it to Copilot CLI:

```bash
copilot mcp add specter -- npx @purplegumdropz/specter-mcp
```

Then use natural language:

```bash
copilot -p "Use specter to find complexity hotspots in my codebase"
copilot -p "Use specter to show team expertise for src/api/"
copilot -p "Use specter to analyze the impact of changing config.ts"
```

**14 MCP tools:** file relationships, complexity hotspots, codebase summary, dead code detection, symbol search, call chains, architecture diagrams, change coupling, impact analysis, bus factor, code archaeology, health trends, risk scoring, and knowledge map.

**6 MCP prompt templates:** `specter:introduce`, `specter:review`, `specter:onboard`, `specter:refactor-plan`, `specter:standup-summary`, `specter:health-check`

**4 MCP resources:** `specter://summary`, `specter://health`, `specter://hotspots`, `specter://architecture`

This means Copilot CLI can understand your entire codebase through Specter's knowledge graph — not just the files you have open, but the relationships between them, the complexity patterns, the team expertise distribution, and the historical evolution.

## Demo

### Install & Try

```bash
# Install globally
npm install -g @purplegumdropz/specter

# Or try without installing
npx @purplegumdropz/specter-roast
```

### Repository

{% github forbiddenlink/specter %}

<!-- VIDEO: Replace this comment with your video embed -->
<!-- {% embed https://your-video-url %} -->

### Screenshots

<!--
SCREENSHOT IDEAS (capture these from your terminal):

1. `specter health` — The gradient health report with score bar and complexity distribution
2. `specter roast` — The animated glitch intro and roast output
3. `specter tinder` — Dating profile with green/red flags
4. `specter anthem` — Theme song generation
5. `specter wrapped` — Spotify Wrapped-style year in review
6. `specter morning` — Daily standup briefing
7. MCP integration — Copilot CLI using specter tools with natural language

Capture with: cmd+shift+4 on Mac, or use a tool like carbon.now.sh for code blocks
-->

## My Experience with GitHub Copilot CLI

Building Specter's MCP integration was the most technically interesting part of this project. The MCP protocol gives Copilot CLI structured access to tools, and designing the right tool surface area was a real design challenge.

### What Worked Well

**Copilot CLI as a natural language interface to analysis tools.** Instead of remembering flag combinations like `specter hotspots --top 10 --sort churn --format table`, users can just say "show me the files that change the most and are most complex." Copilot CLI maps that to the right MCP tool call with the right parameters. This is a genuinely better UX for exploratory analysis.

**MCP prompt templates for common workflows.** The `specter:onboard` template gives Copilot CLI a structured way to introduce new developers to a codebase. The `specter:review` template combines file relationships, complexity data, and change coupling to give context-aware code review suggestions. These aren't just wrappers — they compose multiple tools in ways that would be tedious to do manually.

**MCP resources for ambient context.** Having `specter://summary` and `specter://health` available as resources means Copilot CLI can reference your codebase state without an explicit tool call. When you ask "should I refactor this?", it already knows your health score and hotspot distribution.

### What I Learned

**Design tools for AI, not just humans.** MCP tools need to return structured data that an LLM can reason about. I spent time making sure tool outputs include both raw numbers and contextual descriptions — so Copilot CLI can say "this file has a bus factor of 1, meaning only one person has ever touched it" rather than just returning `{"busFactor": 1}`.

**The personality system works surprisingly well with LLMs.** When Copilot CLI pipes Specter's personality-enhanced output into its responses, the result feels conversational rather than robotic. The ghost metaphor ("I am the ghost in your git history") gives the tool a memorable identity that makes the AI interaction feel more natural.

### Tech Stack

- **TypeScript** with ts-morph for AST analysis
- **Commander.js** for CLI framework
- **MCP SDK** (`@modelcontextprotocol/sdk`) for the MCP server
- **chalk**, **gradient-string**, **cfonts** for terminal UI
- **vitest** for testing (313 tests across 13 files)
- **Biome** for linting and formatting

---

Built by [Liz Stein](https://github.com/elizabethsiegle) — *"I am the ghost in your git history."*
