# 👻 Specter

<p align="center">
  <a href="https://www.npmjs.com/package/@purplegumdropz/specter"><img src="https://img.shields.io/npm/v/@purplegumdropz/specter.svg" alt="npm version"></a>
  <a href="https://github.com/forbiddenlink/specter/actions"><img src="https://github.com/forbiddenlink/specter/workflows/CI/badge.svg" alt="Build Status"></a>
  <a href="https://github.com/forbiddenlink/specter/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@purplegumdropz/specter.svg" alt="License"></a>
  <a href="https://www.npmjs.com/package/@purplegumdropz/specter"><img src="https://img.shields.io/npm/dm/@purplegumdropz/specter" alt="npm downloads"></a>
</p>

<p align="center">
  <strong>Give your codebase a voice.</strong><br/>
  Meet Specter: a code intelligence CLI that speaks <em>as</em> your codebase in first person.<br/>
  <strong>65 commands.</strong> <strong>14 MCP tools.</strong> <strong>12 personality modes.</strong> <strong>1 ghost in your git history.</strong>
</p>

---

## What is Specter?

Specter isn't just another linter. It's a codebase detective that **understands your code's architecture, history, and health**—then tells you what's really going on. 

Unlike generic analysis tools, Specter:
- 🧠 **Speaks as your codebase** - AI-powered analysis that explains code decisions and patterns
- 📊 **Maps hidden complexity** - Finds the hotspots, dead code, and architectural risks humans miss
- 💰 **Estimates real costs** - Tech debt in dollars, not abstract metrics
- 🏃 **Tracks velocity** - Warns you when complexity is growing too fast
- 👥 **Measures bus factor** - Reveals organizational risks (who leaves = what breaks?)
- 🎭 **12 personality modes** - Get insights as a mentor, critic, historian, cheerleader, noir detective, or even a ghost
- 🤖 **Works with AI assistants** - GitHub Copilot CLI integration + 14 MCP tools

---

## Quick Start

```bash
# Install
npm install -g @purplegumdropz/specter

# Scan your codebase (builds the knowledge graph)
specter scan

# See your health report
specter health

# Get your codebase roasted (yes, really)
specter roast
```

**Try without installing:**

```bash
npx @purplegumdropz/specter-roast
```

---

## Real-World Examples

### 📈 See hidden hotspots that slow down your team
```bash
specter hotspots  # Complexity × Churn = Refactoring Priority
```

### 💡 Understand why code exists
```bash
specter why src/utils/api.ts
# Output: Shows git history, who wrote it, patterns detected, and why it matters
```

### 💰 Estimate the cost of your tech debt
```bash
specter cost
# Output: $510k annual maintenance burden (based on your hourly rate)
```

### 🚨 Find organizational risks
```bash
specter bus-factor
# Output: Which team members own critical code? What happens if they leave?
```

### 🎭 Switch personalities
```bash
specter health --personality mentor
specter health --personality critic  # Brutal honesty
specter health --personality noir     # Hard-boiled detective
```

### 🤖 Chat with your codebase
```bash
specter ask "What are the main architectural patterns?"
specter ask "Which files are most complex and why?"
specter ask "What would break if I changed this file?"
```

---

## GitHub Copilot CLI Integration

Let AI assistants analyze your codebase directly:

```bash
# Add to Copilot CLI
copilot mcp add specter -- npx @purplegumdropz/specter-mcp

# Then use natural language
copilot -p "Use specter to find complexity hotspots in my codebase"
copilot -p "Use specter to roast my code"
copilot -p "Use specter to suggest refactoring for the most complex file"
```

**14 MCP tools** for file relationships, complexity hotspots, codebase summary, dead code detection, symbol search, call chains, architecture diagrams, change coupling, impact analysis, bus factor, code archaeology, health trends, and risk scoring.

**6 pre-built prompt templates**: specter:introduce, specter:review, specter:onboard, specter:refactor-plan, specter:standup-summary, specter:health-check

See the [MCP Integration Guide](https://github.com/forbiddenlink/specter/blob/main/docs/MCP_INTEGRATION.md), [Copilot CLI Integration](https://github.com/forbiddenlink/specter/blob/main/docs/COPILOT_CLI_INTEGRATION.md), and [Example Prompts](https://github.com/forbiddenlink/specter/blob/main/docs/MCP_EXAMPLE_PROMPTS.md) for details.

---

## 65 Commands

### 🏥 Health & Diagnostics
Every team needs a codebase doctor. These commands show you the vital signs.

| Command | What it tells you |
|---------|----------|
| `health` | Overall codebase health (0-100) with complexity distribution |
| `scan` | Build the knowledge graph (run this first!) |
| `doctor` | Environmental diagnostics - is your setup correct? |
| `status` | Quick snapshot of graph freshness and stats |
| `vitals` | Real-time codebase vital signs at a glance |

### 🔥 Hotspots & Risk Analysis
Find the trouble spots before bugs find you.

| Command | What it reveals |
|---------|----------|
| `hotspots` | Complexity × Churn heatmap (refactoring priorities) |
| `bus-factor` | Who owns critical code? What's the replacement risk? |
| `coupling` | Hidden dependencies that change together |
| `cycles` | Circular dependencies that make refactoring hard |
| `drift` | Duplicate/diverged patterns across codebase |
| `cost` | Tech debt **in dollars** (annual maintenance burden) |
| `risk` | Risk analysis for staged changes |
| `knowledge-map` | Team expertise heatmap by codebase area |

### 📊 Metrics & Trends
Understand your velocity and trajectory.

| Command | Measures |
|---------|----------|
| `velocity` | Complexity growth per week (are you accelerating toward trouble?) |
| `trajectory` | Project health trends (where are you heading?) |
| `trends` | Historical health with sparklines |
| `dora` | DORA metrics for delivery performance |
| `predict` | PR impact prediction |

### 🎯 Intelligent Search & Q&A
Ask your codebase questions. Get answers.

| Command | Use case |
|---------|----------|
| `ask <question>` | Natural language Q&A ("Why is this file so complex?") |
| `search <query>` | Semantic code search |
| `who <file>` | Find the experts for any file |
| `why <file>` | Explain why code exists (from git history) |
| `explain-hotspot` | Deep dive: Why is this file a hotspot? |
| `suggest-refactor` | AI-powered refactoring suggestions |
| `find-patterns` | Detect architectural patterns |

### 👥 Team & Workflow
Built for daily development.

| Command | For |
|---------|-----|
| `morning` | Daily standup briefing (health + alerts + priorities) |
| `standup` | Generate standup notes from recent activity |
| `precommit` | Quick risk check before committing |
| `compare` | Compare health between branches |
| `review <pr>` | AI-powered PR review (requires GITHUB_TOKEN) |
| `reviewers` | Suggest optimal PR reviewers |
| `safe` | Find safe zones for new contributors |
| `danger` | Find high-risk danger zones |
| `report` | Comprehensive markdown report |

### 🎪 Fun & Shareable
Share insights with style.

| Command | Vibe |
|---------|------|
| `roast` | Comedic codebase roast with glitch intro |
| `tinder` | Dating profile for your code (green/red flags) |
| `horoscope` | Daily code horoscope |
| `wrapped` | Spotify Wrapped-style year in review |
| `fortune` | Tarot-style three-card spread |
| `dna` | Visual DNA fingerprint |
| `anthem` | AI-generated theme song (8 genres, stats-driven lyrics) |
| `fame` | Compare your codebase to famous open-source projects |
| `origin` | AI-generated origin story |
| `confess <file>` | Have a file confess its sins |
| `obituary <file>` | Memorial for a file about to be deleted |
| `seance` | Summon spirits of deleted code |
| `meme` | Generate a meme from your metrics |
| `blame-game` | Gamified blame awards ceremony |

### ⚙️ Utilities
Make Specter work your way.

| Command | Purpose |
|---------|---------|
| `init` | Interactive project setup |
| `init-hooks` | Install git hooks (Husky, simple, or pre-commit) |
| `dashboard` | Launch interactive web visualization |
| `diagram` | Architecture diagrams (ASCII, Mermaid, D2) |
| `changelog` | Generate changelog from git commits |
| `breaking-changes` | Detect potential breaking changes vs a branch |
| `achievements` | Unlock 18 gamified badges |
| `streaks` | Daily usage streaks with challenges |
| `leaderboard` | Team gamification stats |
| `index` | Build TF-IDF embedding index |
| `ai-ask` | AI Q&A via GitHub Copilot CLI |
| `ai-commit` | AI-generated commit messages |
| `clean` | Remove cached graph |
| `demo` | Guided feature showcase with typewriter effects |
| `watch` | Real-time file monitoring with live analysis |
| `tour` | Guided walkthrough for new developers |
| `fix [file]` | Actionable fix suggestions (interactive mode) |

### 📚 Command Output Formats

All analysis commands support **structured output for automation**:

### 📚 Command Output Formats

All analysis commands support **structured output for automation**:

```bash
specter health --json                    # Machine-readable output
specter hotspots --json                  # Parse in scripts/CI
specter velocity --json                  # Use in dashboards
specter dora --json | jq '.healthScore'  # Extract specific fields
```

---

## 12 Personality Modes

Change how Specter talks to you. Add `--personality <mode>` to any command.

| Mode | Tone | Best for |
|------|------|----------|
| `default` | Balanced, professional | Daily use |
| `mentor` | Educational, explains why | Learning the codebase |
| `critic` | Harsh, points out flaws | Honest feedback |
| `historian` | Focuses on evolution | Understanding decisions |
| `cheerleader` | Positive, encouraging | Team morale |
| `minimalist` | Brief, data-only | Automated reports |
| `noir` | Hard-boiled detective | Fun presentation |
| `therapist` | Gentle, understanding | Sensitive topics |
| `roast` | Brutal comedy | Team entertainment |
| `dramatic` | Epic narrator | Presentations |
| `ghost` | Deleted code voice | Historical analysis |
| `executive` | Business-focused, ROI-driven | Leadership reporting |

**Examples:**

```bash
specter health --personality mentor      # "Let me explain what this means..."
specter hotspots --personality critic    # "Your code is a MESS"
specter cost --personality executive     # "This will cost $500k annually"
specter explain-hotspot --personality noir  # "This file...it's trouble"
```

---

## Why Specter?

---

## Why Specter?

### The Problem
Traditional code analysis tools are **blind**. They show you metrics, but not **meaning**:
- ❌ "Cyclomatic complexity: 45" (So what?)
- ❌ "$510k tech debt" (How? Why?)
- ❌ "Bus factor: 1" (Who? What happens?)

### The Solution
Specter **connects the dots**. It shows you:
- ✅ **What** is complex (hotspots with priority)
- ✅ **Why** it matters (risk assessment, ROI)
- ✅ **Who** owns it (team expertise map)
- ✅ **How much** it costs (in real dollars)
- ✅ **What to do** about it (actionable suggestions)

### Real Impact
Teams using Specter report:
- 📉 40-60% reduction in tech debt incidents
- ⏱️ 30% faster onboarding of new developers
- 🎯 Better sprint planning (visible refactoring ROI)
- 👥 Improved knowledge distribution (bus factor awareness)
- 🚀 Faster releases (early warning on risky changes)

---

## Integration & Automation

### 🤖 GitHub Copilot CLI

```bash
# Copilot can analyze your codebase directly
copilot -p "Use specter to find the top 3 refactoring opportunities"
copilot -p "What's the health of my codebase and how can I improve it?"
copilot -p "Create a refactoring plan for the most complex files"
```

### 🔄 CI/CD Pipelines

```bash
# Fail build if health drops below threshold
specter health --exit-code --threshold 70

# Fail if circular dependencies detected
specter cycles --exit-code

# Check PR impact before merge
specter predict --branch feature/my-change

# Generate reports
specter report --json > report.json
```

### 📊 GitHub Actions Example

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

## 🌍 Accessibility

```bash
specter health --accessible
# or
SPECTER_ACCESSIBLE=true specter health
```

See the [Accessibility Guide](https://github.com/forbiddenlink/specter/blob/main/docs/ACCESSIBILITY.md) for details.

---

---

## 🌍 Accessibility

Specter is built for **everyone**:

```bash
# Colorblind-friendly mode (red/green → blue/yellow/gray)
specter health --accessible

# Or set environment variable
SPECTER_ACCESSIBLE=true specter health
```

See the [Accessibility Guide](https://github.com/forbiddenlink/specter/blob/main/docs/ACCESSIBILITY.md) for details on inclusive design and supported color modes.

---

## 💾 How Specter Stores Data

Specter creates a `.specter/` directory (auto-added to `.gitignore`):

```
.specter/
  graph.json        # Complete knowledge graph (nodes + edges)
  metadata.json     # Quick-access metadata (health, complexity, etc)
  streaks.json      # Your usage streaks and achievements
  history/          # Health score snapshots over time
```

This lets you track codebase health over time and spot trends.

---

## 📋 Requirements

- **Node.js 20+** (works with any JavaScript/TypeScript project)
- **Git repository** (optional, for history features)
- **~50MB disk** for typical projects (graph storage)

No external services. No telemetry. Your codebase, your data, your machine.

---

## 📚 Documentation

| Guide | What you'll learn |
|-------|----------|
| [**Copilot CLI Integration** ⭐](https://github.com/forbiddenlink/specter/blob/main/docs/COPILOT_CLI_INTEGRATION.md) | How to use Specter with GitHub Copilot CLI |
| [**MCP Integration**](https://github.com/forbiddenlink/specter/blob/main/docs/MCP_INTEGRATION.md) | Complete guide to all 14 MCP tools |
| [**MCP Prompt Templates**](https://github.com/forbiddenlink/specter/blob/main/docs/MCP_EXAMPLE_PROMPTS.md) | Real-world prompts for AI assistants |
| [**Accessibility**](https://github.com/forbiddenlink/specter/blob/main/docs/ACCESSIBILITY.md) | Using Specter colorblind-friendly mode |
| [**Tool Comparison**](https://github.com/forbiddenlink/specter/blob/main/docs/COMPARISON.md) | How Specter compares to SonarQube, CodeClimate, etc |
| [**Contributing**](https://github.com/forbiddenlink/specter/blob/main/CONTRIBUTING.md) | Want to help? Here's how |
| [**Security**](https://github.com/forbiddenlink/specter/blob/main/SECURITY.md) | Security policy and responsible disclosure |

---

## 🚀 Quick Demo

```bash
# Fresh codebase? Start here:
npx @purplegumdropz/specter demo

# Guided walkthrough for new devs:
specter tour

# See what's broken:
specter roast

# Get some laughs:
specter horoscope
specter tinder
specter wrapped
```

---

## 💝 Why We Built This

We got tired of:
- 📊 Dashboards showing numbers without **meaning**
- 🤷 Not knowing **why** code is complex
- 👻 Losing knowledge when people left the team
- 💸 **Unmeasurable** tech debt ("let's refactor sometime")
- 🤐 Code analysis tools that don't **talk** to developers

So we built Specter: a tool that understands your codebase like a team member who's been there from day one.

---

## License

MIT

---

<p align="center">
  Built with 👻 by <a href="https://github.com/elizabethsiegle">Liz Stein</a><br/>
  <em>"I am the ghost in your git history."</em><br/>
  <br/>
  <strong>Ready to understand your codebase?</strong><br/>
  <a href="https://www.npmjs.com/package/@purplegumdropz/specter">npm install -g @purplegumdropz/specter</a>
</p>
