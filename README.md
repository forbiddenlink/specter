# 👻 Specter

<p align="center">
  <a href="https://www.npmjs.com/package/@purplegumdropz/specter"><img src="https://img.shields.io/npm/v/@purplegumdropz/specter.svg" alt="npm version"></a>
  <a href="https://github.com/forbiddenlink/specter/actions"><img src="https://github.com/forbiddenlink/specter/workflows/CI/badge.svg" alt="Build Status"></a>
  <a href="https://github.com/forbiddenlink/specter/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@purplegumdropz/specter.svg" alt="License"></a>
  <a href="https://www.npmjs.com/package/@purplegumdropz/specter"><img src="https://img.shields.io/npm/dm/@purplegumdropz/specter" alt="npm downloads"></a>
</p>

<p align="center">
  <strong>Give your codebase a voice.</strong><br/>
  A code intelligence CLI that speaks <em>as</em> your codebase in first person.<br/>
  <strong>65 commands. 14 MCP tools. 12 personality modes. 1 ghost in your git history.</strong>
</p>

---

## What Makes Specter Different?

Traditional analysis tools show metrics without meaning. Specter **connects the dots**:

| The Problem | Specter's Answer |
|-------------|------------------|
| "Cyclomatic complexity: 45" | **Where** the hotspots are + **why** they matter |
| "Tech debt exists" | **$510k** annual maintenance burden (your hourly rate) |
| "Bus factor: 1" | **Who** owns what + **what breaks** if they leave |
| Numbers without context | AI-powered explanations in 12 personality modes |

```bash
# Install and get started in 30 seconds
npm install -g @purplegumdropz/specter
specter scan && specter health

# Or try without installing
npx @purplegumdropz/specter-roast
```

---

## Real-World Examples

### Find the code that's slowing your team down
```bash
specter hotspots              # Complexity × Churn = Refactoring Priority
specter cost                  # Tech debt in dollars ($510k/year)
specter bus-factor            # Who leaves = what breaks?
```

### Understand why code exists
```bash
specter why src/utils/api.ts  # Git history + patterns + context
specter ask "What are the main architectural patterns?"
specter ask "What would break if I changed this file?"
```

### Get insights with personality
```bash
specter health --personality mentor   # Educational explanations
specter health --personality critic   # Brutal honesty
specter roast                         # Comedic codebase roast
```

---

## GitHub Copilot CLI Integration

Let AI assistants analyze your codebase directly:

```bash
# Add to Copilot CLI
copilot mcp add specter -- npx @purplegumdropz/specter-mcp

# Then use natural language
copilot -p "Use specter to find complexity hotspots"
copilot -p "Use specter to suggest refactoring for the most complex file"
```

**14 MCP tools** for file relationships, complexity hotspots, dead code detection, impact analysis, bus factor, code archaeology, and more.

**6 prompt templates**: `specter:introduce`, `specter:review`, `specter:onboard`, `specter:refactor-plan`, `specter:standup-summary`, `specter:health-check`

See [Copilot CLI Integration](docs/COPILOT_CLI_INTEGRATION.md) | [MCP Integration](docs/MCP_INTEGRATION.md) | [Example Prompts](docs/MCP_EXAMPLE_PROMPTS.md)

---

## Command Reference

### Health & Diagnostics

| Command | What it tells you |
|---------|-------------------|
| `health` | Overall codebase health (0-100) with complexity distribution |
| `scan` | Build the knowledge graph (run this first!) |
| `doctor` | Environmental diagnostics |
| `status` | Graph freshness and stats |
| `vitals` | Real-time vital signs |

### Hotspots & Risk Analysis

| Command | What it reveals |
|---------|-----------------|
| `hotspots` | Complexity × Churn heatmap |
| `bus-factor` | Who owns critical code? Replacement risk? |
| `coupling` | Hidden dependencies that change together |
| `cycles` | Circular dependencies |
| `drift` | Duplicate/diverged patterns |
| `cost` | Tech debt in dollars |
| `risk` | Risk analysis for staged changes |
| `knowledge-map` | Team expertise heatmap |

### Metrics & Trends

| Command | Measures |
|---------|----------|
| `velocity` | Complexity growth per week |
| `trajectory` | Project health trends |
| `trends` | Historical health with sparklines |
| `dora` | DORA metrics |
| `predict` | PR impact prediction |

### Intelligent Search & Q&A

| Command | Use case |
|---------|----------|
| `ask <question>` | Natural language Q&A |
| `search <query>` | Semantic code search |
| `who <file>` | Find experts for any file |
| `why <file>` | Explain why code exists |
| `explain-hotspot` | Deep dive on hotspots |
| `suggest-refactor` | AI refactoring suggestions |

### Team & Workflow

| Command | Purpose |
|---------|---------|
| `morning` | Daily standup briefing |
| `standup` | Generate standup notes |
| `precommit` | Risk check before committing |
| `compare` | Health between branches |
| `review <pr>` | AI-powered PR review |
| `reviewers` | Suggest PR reviewers |
| `safe` | Safe zones for new contributors |
| `danger` | High-risk danger zones |
| `report` | Comprehensive markdown report |

### Fun & Shareable

| Command | Vibe |
|---------|------|
| `roast` | Comedic codebase roast |
| `tinder` | Dating profile (green/red flags) |
| `horoscope` | Daily code horoscope |
| `wrapped` | Spotify Wrapped-style review |
| `fortune` | Tarot-style three-card spread |
| `dna` | Visual DNA fingerprint |
| `anthem` | AI-generated theme song |
| `fame` | Compare to famous projects |
| `origin` | AI-generated origin story |
| `confess <file>` | File confesses its sins |
| `obituary <file>` | Memorial for deleted files |
| `seance` | Summon deleted code spirits |
| `meme` | Generate meme from metrics |
| `blame-game` | Gamified blame awards |

### Utilities

| Command | Purpose |
|---------|---------|
| `init` | Interactive project setup |
| `init-hooks` | Install git hooks |
| `dashboard` | Interactive web visualization |
| `diagram` | Architecture diagrams (ASCII, Mermaid, D2) |
| `changelog` | Generate changelog |
| `breaking-changes` | Detect breaking changes |
| `achievements` | Unlock 18 badges |
| `streaks` | Daily usage streaks |
| `leaderboard` | Team gamification |
| `watch` | Real-time file monitoring |
| `tour` | Guided walkthrough |
| `fix [file]` | Actionable fix suggestions |

### Output Formats

All analysis commands support structured output:

```bash
specter health --json              # Machine-readable
specter hotspots --json            # Parse in scripts/CI
specter dora --json | jq '.score'  # Extract specific fields
```

---

## 12 Personality Modes

Add `--personality <mode>` to any command:

| Mode | Tone | Best for |
|------|------|----------|
| `default` | Balanced, professional | Daily use |
| `mentor` | Educational, explains why | Learning |
| `critic` | Harsh, points out flaws | Honest feedback |
| `historian` | Focuses on evolution | Understanding decisions |
| `cheerleader` | Positive, encouraging | Team morale |
| `minimalist` | Brief, data-only | Automation |
| `noir` | Hard-boiled detective | Fun presentations |
| `therapist` | Gentle, understanding | Sensitive topics |
| `roast` | Brutal comedy | Entertainment |
| `dramatic` | Epic narrator | Presentations |
| `ghost` | Deleted code voice | Historical analysis |
| `executive` | Business-focused, ROI | Leadership reports |

---

## CI/CD Integration

```bash
# Fail build if health drops
specter health --exit-code --threshold 70

# Fail on circular dependencies
specter cycles --exit-code

# Check PR impact
specter predict --branch feature/my-change
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
      - run: npx @purplegumdropz/specter predict --branch ${{ github.head_ref }}
```

---

## Accessibility

Specter supports colorblind-friendly mode:

```bash
specter health --accessible
# or
SPECTER_ACCESSIBLE=true specter health
```

See the [Accessibility Guide](docs/ACCESSIBILITY.md) for details.

---

## Data Storage

Specter creates a `.specter/` directory (auto-added to `.gitignore`):

```
.specter/
  graph.json      # Knowledge graph
  metadata.json   # Quick-access metadata
  streaks.json    # Usage streaks and achievements
  history/        # Health snapshots over time
```

---

## Requirements

- **Node.js 20+**
- **Git repository** (optional, for history features)
- **~50MB disk** for typical projects

No external services. No telemetry. Your data stays on your machine.

---

## Documentation

| Guide | Topic |
|-------|-------|
| [**Copilot CLI Integration**](docs/COPILOT_CLI_INTEGRATION.md) | GitHub Copilot CLI setup |
| [**MCP Integration**](docs/MCP_INTEGRATION.md) | All 14 MCP tools |
| [**Example Prompts**](docs/MCP_EXAMPLE_PROMPTS.md) | Real-world AI prompts |
| [**Accessibility**](docs/ACCESSIBILITY.md) | Colorblind-friendly mode |
| [**Comparison**](docs/COMPARISON.md) | vs SonarQube, CodeClimate, etc |
| [**Troubleshooting**](docs/TROUBLESHOOTING.md) | Common issues & solutions |
| [**Contributing**](CONTRIBUTING.md) | How to contribute |
| [**Security**](SECURITY.md) | Security policy |

---

## License

MIT

---

<p align="center">
  Built with 👻 by <a href="https://github.com/elizabethsiegle">Liz Stein</a><br/>
  <em>"I am the ghost in your git history."</em>
</p>
