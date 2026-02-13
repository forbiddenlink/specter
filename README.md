# Specter

<p align="center">
  <a href="https://www.npmjs.com/package/@purplegumdropz/specter"><img src="https://img.shields.io/npm/v/@purplegumdropz/specter.svg" alt="npm version"></a>
  <a href="https://github.com/forbiddenlink/specter/actions"><img src="https://github.com/forbiddenlink/specter/workflows/CI/badge.svg" alt="Build Status"></a>
  <a href="https://github.com/forbiddenlink/specter/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@purplegumdropz/specter.svg" alt="License"></a>
  <a href="https://www.npmjs.com/package/@purplegumdropz/specter"><img src="https://img.shields.io/npm/dm/@purplegumdropz/specter" alt="npm downloads"></a>
</p>

<p align="center">
  <strong>Give your codebase a voice.</strong><br/>
  A code analysis CLI that speaks <em>as</em> your codebase in first person.<br/>
  65 commands. 14 MCP tools. 12 personality modes. One ghost.
</p>

---

## Quick Start

```bash
# Install
npm install -g @purplegumdropz/specter

# Scan your codebase
specter scan

# See your health report
specter health

# Get roasted
specter roast
```

**Zero-install roast:**

```bash
npx @purplegumdropz/specter-roast
```

---

## GitHub Copilot CLI Integration

Specter works as an MCP server for GitHub Copilot CLI and any MCP-compatible tool:

```bash
# Add to Copilot CLI
copilot mcp add specter -- npx @purplegumdropz/specter-mcp

# Then use natural language
copilot -p "Use specter to find complexity hotspots in my codebase"
copilot -p "Use specter to roast my code"
```

**14 MCP tools** for file relationships, complexity hotspots, codebase summary, dead code detection, symbol search, call chains, architecture diagrams, change coupling, impact analysis, bus factor, code archaeology, health trends, and risk scoring.

**6 MCP prompt templates**: `specter:introduce`, `specter:review`, `specter:onboard`, `specter:refactor-plan`, `specter:standup-summary`, `specter:health-check`

**4 MCP resources**: `specter://summary`, `specter://health`, `specter://hotspots`, `specter://architecture`

See the [MCP Integration Guide](docs/MCP_INTEGRATION.md), [Copilot CLI Integration](docs/COPILOT_CLI_INTEGRATION.md), and [Example Prompts](docs/MCP_EXAMPLE_PROMPTS.md) for details.

---

## Commands

### Core
| Command | Description |
|---------|-------------|
| `scan` | Build the knowledge graph from your codebase |
| `health` | Health report with complexity distribution and hotspots |
| `status` | Show graph freshness and stats |
| `init` | Interactive project setup |
| `init-hooks` | Install git hooks (Husky, simple, or pre-commit) |
| `doctor` | Run environment diagnostics |
| `clean` | Remove cached graph |
| `demo` | Guided feature showcase with typewriter effects |

### Analysis
| Command | Description |
|---------|-------------|
| `hotspots` | Complexity x churn scatter plot with quadrant analysis |
| `coupling` | Hidden couplings between files that change together |
| `cycles` | Circular dependency detection |
| `bus-factor` | Knowledge concentration risks |
| `dora` | DORA metrics for delivery performance |
| `cost` | Tech debt estimated in dollars |
| `drift` | Detect diverged duplicate patterns |
| `velocity` | Team velocity and productivity |
| `trajectory` | Project future health from trends |
| `trends` | Historical health trends with sparklines |
| `risk` | Risk analysis for staged changes |
| `vitals` | Codebase vital signs at a glance |
| `report` | Comprehensive markdown report |
| `diagram` | Architecture diagrams (ASCII, Mermaid, D2) |
| `knowledge-map` | Team expertise heatmap |

### Fun & Shareable
| Command | Description |
|---------|-------------|
| `roast` | Comedic codebase roast with animated glitch intro |
| `tinder` | Dating profile for your code (green/red flags) |
| `horoscope` | Daily code horoscope based on commit patterns |
| `fortune` | Tarot-style three-card spread |
| `wrapped` | Spotify Wrapped-style year in review |
| `dna` | Visual DNA double helix fingerprint |
| `anthem` | Generate a theme song (8 genres, stats-driven lyrics) |
| `fame` | Compare your codebase to famous open-source projects |
| `origin` | AI-generated origin story |
| `confess <file>` | Have a file confess its sins |
| `obituary <file>` | Memorial for a file about to be deleted |
| `seance` | Summon spirits of deleted code from git history |
| `meme` | Generate a meme from your codebase metrics |
| `blame-game` | Gamified blame awards ceremony |

### Daily Workflow
| Command | Description |
|---------|-------------|
| `morning` | Daily standup briefing with health and alerts |
| `standup` | Generate standup notes from recent activity |
| `precommit` | Quick risk check before committing |
| `predict` | PR impact prediction |
| `compare` | Branch health comparison |
| `review <pr>` | AI-powered PR review (requires GITHUB_TOKEN) |
| `reviewers` | Suggest optimal PR reviewers |
| `who <file>` | Find the experts for any file |
| `why <file>` | Explain why code exists from git history |
| `safe` | Find safe zones for new contributors |
| `danger` | Find high-risk danger zones |
| `watch` | Real-time file monitoring with live analysis |
| `tour` | Guided walkthrough for new developers |
| `fix [file]` | Actionable fix suggestions with interactive mode |

### Engagement
| Command | Description |
|---------|-------------|
| `achievements` | Gamified badges (18 unlockable) |
| `streaks` | Daily usage streaks with daily challenges |
| `leaderboard` | Team gamification stats |

### Search & AI
| Command | Description |
|---------|-------------|
| `search <query>` | Semantic code search |
| `ask <question>` | Natural language Q&A with personality |
| `index` | Build TF-IDF embedding index |
| `ai-ask` | AI-powered Q&A via GitHub Copilot CLI |
| `ai-commit` | AI-generated commit messages |
| `explain-hotspot` | AI explanation of complexity hotspots |
| `suggest-refactor` | AI-powered refactoring suggestions |

### Other
| Command | Description |
|---------|-------------|
| `changelog` | Generate changelog from git commits |
| `breaking-changes` | Detect potential breaking changes vs a branch |
| `dashboard` | Launch interactive web visualization |

---

## Personality Modes

Add `--personality <mode>` to any command:

| Mode | Style |
|------|-------|
| `default` | Balanced, professional |
| `mentor` | Educational, explains why |
| `critic` | Harsh, points out flaws |
| `historian` | Focuses on evolution |
| `cheerleader` | Positive, encouraging |
| `minimalist` | Brief, data-only |
| `noir` | Detective mystery voice |
| `therapist` | Gentle, understanding |
| `roast` | Brutal comedy |
| `dramatic` | Epic narrator |
| `ghost` | Deleted code voice |
| `executive` | Business-focused, ROI-driven |

---

## CI/CD Integration

### JSON Output

All analysis commands support `--json` for machine-readable output:

```bash
specter health --json
specter scan --json
specter hotspots --json
specter dora --json
```

```json
{
  "command": "health",
  "timestamp": "2026-02-13T10:30:00.000Z",
  "success": true,
  "data": {
    "healthScore": 78,
    "totalFiles": 142,
    "complexityDistribution": { "low": 120, "medium": 15, "high": 5, "veryHigh": 2 }
  }
}
```

### Health Gate

```bash
specter health --exit-code --threshold 70  # Exit 1 if health < 70
specter cycles --exit-code                 # Exit 1 if cycles found
```

### GitHub Actions

```yaml
name: Specter Analysis
on: [pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - run: npx @purplegumdropz/specter scan --json
      - run: npx @purplegumdropz/specter health --json --exit-code --threshold 60
```

---

## Accessibility

Specter supports colorblind-friendly output:

```bash
specter health --accessible
# or
SPECTER_ACCESSIBLE=true specter health
```

See the [Accessibility Guide](docs/ACCESSIBILITY.md) for details.

---

## Storage

Specter stores data in `.specter/` (auto-added to `.gitignore`):

```
.specter/
  graph.json        # Knowledge graph
  metadata.json     # Quick-access metadata
  streaks.json      # Usage streaks
  history/          # Health snapshots
```

---

## Requirements

- Node.js 20+
- TypeScript/JavaScript codebase (for full analysis)
- Git repository (optional, for history features)

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Copilot CLI Integration](docs/COPILOT_CLI_INTEGRATION.md) | ⭐ Using Specter with GitHub Copilot CLI |
| [MCP Integration](docs/MCP_INTEGRATION.md) | Complete guide to all 14 MCP tools |
| [MCP Prompts](docs/MCP_EXAMPLE_PROMPTS.md) | Real-world prompts for AI assistants |
| [Accessibility](docs/ACCESSIBILITY.md) | Colorblind mode and inclusive design |
| [Comparison](docs/COMPARISON.md) | How Specter compares to other tools |
| [Contributing](CONTRIBUTING.md) | Development setup and guidelines |
| [Security](SECURITY.md) | Security policy and reporting |

---

## License

MIT

---

<p align="center">
  Built by <a href="https://github.com/elizabethsiegle">Liz Stein</a><br/>
  <em>"I am the ghost in your git history."</em>
</p>
