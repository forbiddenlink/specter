---
name: specter-scan
description: Scan and index the current codebase into Specter's knowledge graph
---

# Specter Scan

Build or rebuild the knowledge graph for the current codebase.

## When to Use

- First time using Specter on a project
- After major refactoring or adding many files
- When specter tools return stale or missing data
- Before asking the specter agent questions about the codebase

## How to Run

Execute the specter scan command:

```bash
npx specter-mcp scan
```

Or with options:

```bash
# Skip git history analysis (faster)
npx specter-mcp scan --no-git

# Force rescan even if graph exists
npx specter-mcp scan --force

# Scan a specific directory
npx specter-mcp scan --dir ./packages/core
```

## What It Does

1. Parses all TypeScript/JavaScript files using AST analysis
2. Extracts functions, classes, interfaces, types, and exports
3. Maps import relationships between files
4. Calculates cyclomatic complexity for each function
5. Analyzes git history for modification patterns (unless --no-git)
6. Saves the knowledge graph to `.specter/graph.json`

## Output

After scanning, you'll see:
- File count and total lines
- Symbol count (functions, classes, etc.)
- Relationship count (imports)
- Complexity metrics
- Language breakdown

The `.specter/` directory will contain:
- `graph.json` — The full knowledge graph
- `metadata.json` — Quick-access scan statistics

## Performance

- ~1000 files per minute on typical hardware
- Git history adds ~30% scan time
- Use `--no-git` for faster iteration during development

## Notes

- Only TypeScript and JavaScript files are analyzed
- `node_modules`, `dist`, and `build` directories are excluded
- Test files (`*.test.ts`, `*.spec.ts`) are excluded
- The `.specter/` directory is automatically added to `.gitignore`
