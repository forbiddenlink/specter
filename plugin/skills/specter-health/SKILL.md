---
name: specter-health
description: Generate a codebase health report showing complexity hotspots, dead code, and overall metrics
---

# Specter Health

Get a comprehensive health report for your codebase.

## When to Use

- Starting work on an unfamiliar codebase
- Planning refactoring priorities
- Before a code review or architecture discussion
- Regular health check-ins on long-running projects

## How to Run

```bash
npx specter-mcp health
```

Or with options:

```bash
# Show more hotspots
npx specter-mcp health --limit 20
```

## What It Shows

### Health Score (0-100)
- 🟢 80-100: Healthy codebase
- 🟡 60-79: Some attention needed
- 🔴 0-59: Significant technical debt

### Complexity Distribution
Breaks down functions by complexity level:
- **Low (1-5)**: Simple, easy to understand
- **Medium (6-10)**: Reasonable complexity
- **High (11-20)**: Consider refactoring
- **Very High (21+)**: Should be broken down

### Complexity Hotspots
Lists the most complex functions/methods with:
- File path and line number
- Function/method name
- Cyclomatic complexity score

## Understanding Complexity

Cyclomatic complexity counts decision points:
- Each `if`, `else`, `switch case`, `for`, `while` adds 1
- Ternary operators (`? :`) add 1
- Logical operators (`&&`, `||`) add 1
- `catch` blocks add 1

**Rule of thumb:**
- 1-5: Simple function
- 6-10: Moderate complexity
- 11-20: High complexity, hard to test
- 21+: Very high, should be refactored

## Recommendations

If you have many high-complexity functions:
1. Extract helper functions
2. Use early returns to reduce nesting
3. Replace complex conditionals with lookup tables
4. Split god functions into focused modules

## Using with Specter Agent

After running health, ask the specter agent:
- "Tell me about my complexity hotspots"
- "What should I refactor first?"
- "Which functions are hardest to maintain?"
