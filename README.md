# Specter

**Give your codebase a voice.**

Specter is a GitHub Copilot CLI plugin that builds a knowledge graph of your codebase and exposes it through an MCP server. The unique twist: a custom agent that speaks *as* your codebase in first person.

> "I'm a TypeScript project with 47 files. My heart lives in `src/graph/` where the knowledge graph is built. I have 12 complexity hotspots that keep me up at night—want me to show you?"

## Features

### Core Analysis
- **Knowledge Graph** — Maps every file, function, class, and import relationship
- **Complexity Analysis** — Identifies hotspots using cyclomatic complexity
- **Git History** — Tracks file churn, contributors, and modification patterns
- **Dead Code Detection** — Finds unused exports
- **Dependency Chains** — Traces how files connect to each other
- **Architecture Diagrams** — ASCII visualizations of your codebase structure

### Health & Trends
- **Health Scoring** — Overall codebase health grade (A-F) based on complexity metrics
- **Historical Trends** — Track health over time with automatic snapshots
- **Trend Analysis** — See if your codebase is improving, stable, or declining

### Risk Analysis
- **Commit Risk Scoring** — Analyze staged changes before committing
- **Multi-factor Assessment** — Evaluates file count, complexity, dependencies, bus factor, and test coverage
- **Actionable Recommendations** — Specific guidance on reducing risk

### Visualization
- **Web Dashboard** — Interactive Cytoscape.js graph visualization
- **ASCII Reports** — Rich terminal output with progress bars and box drawing
- **Sparkline Trends** — Compact visual history of health over time

### Personality
- **Codebase Persona** — A custom agent that speaks as your code
- **Personality Modes** — Choose from mentor, critic, historian, cheerleader, or minimalist
- **First-Person Voice** — Natural, contextual communication style

## Installation

```bash
npm install -g specter-mcp
```

Or use with npx:

```bash
npx specter-mcp scan
```

## Quick Start

### 1. Scan Your Codebase

```bash
cd your-project
specter scan
```

This builds a knowledge graph and saves it to `.specter/`. A health snapshot is automatically created for trend tracking.

### 2. Check Health

```bash
specter health
```

See complexity hotspots, distribution, and an overall health score with visual progress bars.

### 3. View Trends

```bash
specter trends
```

See how your codebase health has changed over time with sparkline visualizations.

### 4. Analyze Risk

```bash
git add .
specter risk
```

Get a risk score for your staged changes before committing.

### 5. Launch Dashboard

```bash
specter dashboard
```

Opens an interactive web dashboard with a force-directed dependency graph.

### 6. Talk to Your Code

With the Copilot CLI plugin installed:

```
@specter Tell me about yourself
@specter What's my most complex function?
@specter What imports src/auth/login.ts?
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `specter scan` | Build the knowledge graph |
| `specter status` | Show graph status and freshness |
| `specter health` | Generate health report |
| `specter trends` | Show health trends over time |
| `specter risk` | Analyze risk of staged changes |
| `specter dashboard` | Launch interactive web dashboard |
| `specter clean` | Remove cached graph |

### Command Options

```bash
# Scan
specter scan --dir ./src       # Scan specific directory
specter scan --no-git          # Skip git history (faster)
specter scan --force           # Force rescan
specter scan --quiet           # Minimal output

# Health
specter health --limit 20      # Show more hotspots
specter health --personality critic  # Use critic personality

# Trends
specter trends --period month  # Show monthly trends
specter trends --personality historian  # Historical perspective

# Risk
specter risk --staged          # Analyze staged changes (default)
specter risk --branch main     # Compare against main branch
specter risk --commit abc123   # Analyze specific commit

# Dashboard
specter dashboard --port 8080  # Custom port
specter dashboard --no-open    # Don't auto-open browser
```

### Personality Modes

Add `--personality <mode>` to health, trends, or risk commands:

| Mode | Style |
|------|-------|
| `default` | Balanced, professional, friendly |
| `mentor` | Educational, explains why things matter |
| `critic` | Direct, points out flaws |
| `historian` | Focuses on evolution and context |
| `cheerleader` | Positive and encouraging |
| `minimalist` | Brief, data-only |

```bash
specter health --personality cheerleader
# "Woohoo! Your codebase is doing great!"
```

## MCP Tools

When connected via MCP, Specter exposes 14 tools:

| Tool | Description |
|------|-------------|
| `get_file_relationships` | Get imports, exports, and dependencies for a file |
| `get_complexity_hotspots` | Find most complex functions |
| `get_codebase_summary` | Get overall statistics with personality |
| `get_file_history` | Git history for a file |
| `get_dead_code` | Find unused exports |
| `search_symbols` | Search for functions/classes by name |
| `get_call_chain` | Trace dependency path between files |
| `get_architecture` | Generate ASCII architecture diagrams |
| `get_change_coupling` | Find files that change together |
| `get_impact_analysis` | Analyze ripple effect of changes |
| `get_bus_factor` | Identify knowledge concentration risks |
| `get_archaeology` | Tell the story of how a file evolved |
| `get_health_trends` | Analyze health trends over time |
| `get_risk_score` | Calculate commit/PR risk score |

## MCP Resources

Live data endpoints that update automatically:

| Resource | Description |
|----------|-------------|
| `specter://summary` | Current codebase statistics |
| `specter://health` | Health score and metrics |
| `specter://hotspots` | Complexity hotspots |
| `specter://architecture` | Directory structure overview |

## Web Dashboard

The interactive dashboard provides:

- **Force-directed graph** — Visualize file dependencies with Cytoscape.js
- **Complexity heatmap** — Node colors indicate complexity (green to red)
- **Click-to-inspect** — View details for any file or symbol
- **Search and filter** — Find specific files or filter by type
- **Health timeline** — Sparkline chart of health over time
- **Hotspot list** — Quick navigation to complex areas

```bash
specter dashboard
# Opens http://localhost:3333
```

## Copilot CLI Plugin

### Install the Plugin

```bash
# From GitHub
copilot /plugin install forbiddenlink/specter

# Or from local path
copilot /plugin install ./path/to/specter/plugin
```

### Use the Agent

The specter agent speaks as your codebase:

```
@specter What should I refactor first?
```

> "I'd focus on `src/utils/helpers.ts`. It's a single point of failure—23 files depend on me, but I'm really just a grab-bag of unrelated functions. My complexity isn't terrible (8), but I'm a maintenance nightmare waiting to happen."

### Use the Skills

```
/specter-scan     # Build knowledge graph
/specter-health   # Health report
/specter-review   # Context for code review
/specter-onboard  # New to the project? Get oriented
```

## MCP Prompts

| Prompt | Description |
|--------|-------------|
| `specter:introduce` | Have the codebase introduce itself in first person |
| `specter:review` | Review files with deep codebase knowledge |

## How It Works

1. **AST Parsing** — Uses ts-morph to parse TypeScript/JavaScript files
2. **Graph Building** — Creates nodes for files/functions/classes and edges for imports
3. **Complexity Scoring** — Calculates cyclomatic complexity per function
4. **Git Analysis** — Extracts history, contributors, and churn patterns
5. **Snapshot Creation** — Saves health snapshots for trend tracking
6. **MCP Server** — Exposes the graph through Model Context Protocol
7. **Agent Persona** — Custom prompts make Copilot speak as the codebase

## Architecture

```
specter/
├── src/
│   ├── cli.ts                 # CLI entry point
│   ├── index.ts               # MCP server
│   ├── graph/
│   │   ├── builder.ts         # Graph construction
│   │   ├── types.ts           # Type definitions
│   │   └── persistence.ts     # Save/load graph
│   ├── analyzers/
│   │   ├── ast.ts             # ts-morph AST parsing
│   │   ├── imports.ts         # Import relationship tracking
│   │   ├── complexity.ts      # Cyclomatic complexity
│   │   └── git.ts             # Git history analysis
│   ├── history/
│   │   ├── types.ts           # Snapshot types
│   │   ├── snapshot.ts        # Create health snapshots
│   │   ├── storage.ts         # Persist snapshots
│   │   └── trends.ts          # Trend calculation
│   ├── risk/
│   │   ├── types.ts           # Risk score types
│   │   ├── diff-analyzer.ts   # Git diff parsing
│   │   └── scorer.ts          # Risk calculation
│   ├── personality/
│   │   ├── types.ts           # Personality types
│   │   ├── modes.ts           # Mode definitions
│   │   └── formatter.ts       # Output formatting
│   ├── dashboard/
│   │   ├── server.ts          # Fastify HTTP server
│   │   ├── api.ts             # REST API routes
│   │   └── static/            # HTML/CSS/JS assets
│   ├── ui/
│   │   ├── colors.ts          # Color scheme
│   │   ├── progress.ts        # Progress bars
│   │   └── boxes.ts           # Box drawing
│   └── tools/                 # MCP tool implementations
└── plugin/
    ├── plugin.json            # Plugin metadata
    ├── mcp-config.json        # MCP server config
    ├── hooks.json             # Hook configuration
    ├── hooks/                 # Shell hooks
    ├── agents/
    │   └── specter.agent.md   # Agent persona
    └── skills/                # Copilot skills
```

## Storage

Specter stores data in the `.specter/` directory:

```
.specter/
├── graph.json        # Knowledge graph
├── metadata.json     # Quick-access metadata
└── history/          # Health snapshots
    ├── 2024-02-01T10-00-00Z.json
    └── 2024-02-08T10-00-00Z.json
```

This directory is automatically added to `.gitignore`.

## Requirements

- Node.js 20+
- TypeScript/JavaScript codebase (for full analysis)
- Git repository (optional, for history analysis)

## Contributing

Pull requests welcome! Please ensure:

1. Code compiles: `npm run build`
2. Tests pass: `npm test`
3. Follow existing code patterns

## License

MIT

---

Built for the [GitHub Copilot CLI Challenge](https://dev.to/challenges/github-2026-01-21) by Liz Stein.
