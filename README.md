# 👻 Specter

**Give your codebase a voice.**

Specter is a GitHub Copilot CLI plugin that builds a knowledge graph of your codebase and exposes it through an MCP server. The unique twist: a custom agent that speaks *as* your codebase in first person.

> "I'm a TypeScript project with 47 files. My heart lives in `src/graph/` where the knowledge graph is built. I have 12 complexity hotspots that keep me up at night—want me to show you?"

## Features

- 📊 **Knowledge Graph** — Maps every file, function, class, and import relationship
- 🔍 **Complexity Analysis** — Identifies hotspots using cyclomatic complexity
- 📜 **Git History** — Tracks file churn, contributors, and modification patterns
- 💀 **Dead Code Detection** — Finds unused exports
- 🔗 **Dependency Chains** — Traces how files connect to each other
- 🏗️ **Architecture Diagrams** — ASCII visualizations of your codebase structure
- 🗣️ **Codebase Persona** — A custom agent that speaks as your code
- 🪝 **Copilot CLI Hooks** — Proactive awareness of graph staleness
- 📡 **MCP Resources** — Live data endpoints for real-time codebase state

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

This builds a knowledge graph and saves it to `.specter/`.

### 2. Check Health

```bash
specter health
```

See complexity hotspots, dead code, and an overall health score.

### 3. Talk to Your Code

With the Copilot CLI plugin installed, invoke the specter agent:

```
@specter Tell me about yourself
```

Or ask specific questions:

```
@specter What's my most complex function?
@specter What imports src/auth/login.ts?
@specter Find all functions named "handle"
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `specter scan` | Build the knowledge graph |
| `specter status` | Show graph status and freshness |
| `specter health` | Generate health report |
| `specter clean` | Remove cached graph |

### Scan Options

```bash
specter scan --dir ./src     # Scan specific directory
specter scan --no-git        # Skip git history (faster)
specter scan --force         # Force rescan
```

## MCP Tools

When connected via MCP, Specter exposes 8 tools:

| Tool | Description |
|------|-------------|
| `get_file_relationships` | Get imports, exports, and dependencies for a file |
| `get_complexity_hotspots` | Find most complex functions |
| `get_codebase_summary` | Get overall statistics |
| `get_file_history` | Git history for a file |
| `get_dead_code` | Find unused exports |
| `search_symbols` | Search for functions/classes by name |
| `get_call_chain` | Trace dependency path between files |
| `get_architecture` | Generate ASCII architecture diagrams |

## MCP Resources

Live data endpoints that update automatically:

| Resource | Description |
|----------|-------------|
| `specter://summary` | Current codebase statistics |
| `specter://health` | Health score and metrics |
| `specter://hotspots` | Complexity hotspots |
| `specter://architecture` | Directory structure overview |

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

Specter provides prompt templates for common interactions:

| Prompt | Description |
|--------|-------------|
| `specter:introduce` | Have the codebase introduce itself in first person |
| `specter:review` | Review files with deep codebase knowledge |

Use prompts in your MCP client:

```
/prompt specter:introduce
```

## How It Works

1. **AST Parsing** — Uses ts-morph to parse TypeScript/JavaScript files
2. **Graph Building** — Creates nodes for files/functions/classes and edges for imports
3. **Complexity Scoring** — Calculates cyclomatic complexity per function
4. **Git Analysis** — Extracts history, contributors, and churn patterns
5. **MCP Server** — Exposes the graph through Model Context Protocol
6. **Agent Persona** — Custom prompts make Copilot speak as the codebase

## Architecture

```
specter/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── index.ts            # MCP server
│   ├── graph/
│   │   ├── builder.ts      # Graph construction
│   │   ├── types.ts        # Type definitions
│   │   └── persistence.ts  # Save/load graph
│   ├── analyzers/
│   │   ├── ast.ts          # ts-morph AST parsing
│   │   ├── imports.ts      # Import relationship tracking
│   │   ├── complexity.ts   # Cyclomatic complexity
│   │   └── git.ts          # Git history analysis
│   └── tools/
│       ├── get-file-relationships.ts
│       ├── get-complexity-hotspots.ts
│       ├── get-codebase-summary.ts
│       ├── get-file-history.ts
│       ├── get-dead-code.ts
│       ├── search-symbols.ts
│       ├── get-call-chain.ts
│       └── get-architecture.ts
└── plugin/
    ├── plugin.json         # Plugin metadata
    ├── mcp-config.json     # MCP server config
    ├── hooks.json          # Hook configuration
    ├── hooks/
    │   └── session-start.sh
    ├── agents/
    │   └── specter.agent.md
    └── skills/
        ├── specter-scan/
        ├── specter-health/
        ├── specter-review/
        └── specter-onboard/
```

## Contributing

Pull requests welcome! Please run `npm test` before submitting.

## License

MIT

---

Built for the [GitHub Copilot CLI Challenge](https://dev.to/challenges/github-2026-01-21) by Liz Stein.
