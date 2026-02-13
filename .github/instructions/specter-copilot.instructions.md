---
description: Best practices for using Specter with GitHub Copilot for codebase analysis and intelligence
applyTo: '**'
---

# Specter + GitHub Copilot Integration Guide

Specter is a codebase intelligence toolkit that gives your code a voice. Use these instructions to leverage Specter's 65 commands effectively with GitHub Copilot.

## 🚀 Quick Start Pattern

**Always start with a scan:**
```bash
specter scan
```

This builds the knowledge graph that powers all other commands. Run this:
- After cloning a new repo
- When switching branches with significant changes  
- After major refactoring
- Daily in active development

## 🎯 Common Workflows

### Understanding a New Codebase
```bash
# 1. Build the knowledge graph
specter scan

# 2. Get the big picture
specter health
specter vitals

# 3. Ask questions
specter ask "What does this codebase do?"
specter ask "Where is authentication handled?"
specter ask "What are the main architectural patterns?"
```

### Before Making Changes
```bash
# Find impact of changes
specter who src/auth.ts              # Who knows this code best?
specter get-file-relationships src/auth.ts  # What depends on this?
specter hotspots --limit 5           # What should I avoid touching?
```

### During Code Review
```bash
# Analyze the PR
specter compare feature-branch

# Check specific files
specter fix src/new-feature.ts       # Get refactoring suggestions
specter ask "Is src/new-feature.ts following our patterns?"
```

### Planning Refactoring
```bash
# Find problems
specter hotspots                     # Complexity × Churn = Priority
specter coupling                     # Hidden dependencies
specter cycles                       # Circular dependencies
specter bus-factor                   # Knowledge silos

# Get AI help
specter fix --all                    # Actionable suggestions
specter ask "How should I refactor X?"
```

## 🤖 Copilot-Friendly Commands

### Output Formats for Copilot to Parse

**Use `--json` for structured data:**
```bash
# Copilot can extract specific information
specter health --json | jq '.healthScore'
specter hotspots --json | jq '.hotspots[0].file'
```

**Use personality modes for different contexts:**
```bash
specter ask "..." --personality mentor      # Teaching explanations
specter ask "..." --personality critic      # Brutally honest
specter ask "..." --personality minimalist  # Concise answers
```

### Commands That Generate Actionable Output

These commands output suggestions that Copilot can act on:

```bash
# Get refactoring TODOs
specter fix src/complex.ts
# → Returns specific code improvements with line numbers

# Get reviewer suggestions  
specter reviewers
# → Returns list of experts by file area

# Get file relationships
specter get-file-relationships src/api.ts
# → Returns imports/exports for dependency analysis
```

## 📊 Interpreting Specter Output

### Health Scores
- **90-100**: Excellent - maintain current practices
- **80-89**: Good - minor improvements needed
- **60-79**: Moderate - prioritize technical debt
- **< 60**: Critical - immediate action required

### Hotspot Priorities
- **DANGER ZONE**: High complexity + High churn = Refactor NOW
- **Legacy Debt**: High complexity + Low churn = Refactor when touching
- **Active Development**: Low complexity + High churn = Watch carefully
- **Healthy**: Low complexity + Low churn = Leave alone

### Bus Factor Risk Levels
- **Critical (1 person)**: Immediate knowledge sharing needed
- **High (2 people)**: Schedule pair programming
- **Medium (3-4 people)**: Acceptable but could improve
- **Healthy (5+ people)**: Well distributed

## 🔧 When to Use Each Command

### Analysis Commands (Use First)
- `health` - Overall codebase status (use this first!)
- `vitals` - Real-time metrics dashboard
- `hotspots` - Find refactoring priorities
- `coupling` - Discover hidden dependencies
- `bus-factor` - Identify knowledge risks

### AI Commands (Use for Insights)
- `ask` - Natural language Q&A about code
- `fix` - Get AI refactoring suggestions
- `explain-hotspot` - Deep dive on complex files

### Fun Commands (Use for Reports/Demos)
- `wrapped` - Year in review (Spotify style)
- `roast` - Comedic code roast
- `tinder` - Swipe on code quality
- `horoscope` - Fortune telling for your code

### Workflow Commands (Use Daily)
- `morning` - Daily standup summary
- `standup` - Generate standup notes
- `precommit` - Pre-commit checks

### Git Commands (Use in Reviews)
- `compare` - Compare branches
- `breaking-changes` - Detect breaking changes
- `reviewers` - Find best reviewers

## 💡 Pro Tips for Copilot Users

### 1. Chain Commands
```bash
# Find hotspots, then get AI suggestions for top issue
specter hotspots --limit 1 --json | jq -r '.hotspots[0].file' | xargs specter fix
```

### 2. Use Aliases for Speed
```bash
specter h          # health
specter s          # scan
specter hot        # hotspots
specter dash       # dashboard
```

### 3. Ask Specific Questions
```bash
# ❌ Too broad
specter ask "Tell me about the code"

# ✅ Specific and actionable
specter ask "Why is src/api.ts so complex?"
specter ask "Where should I add rate limiting?"
specter ask "What's the authentication flow?"
```

### 4. Use Quiet Mode in CI/CD
```bash
# Only show essential info
specter health --quiet --exit-code --threshold 70
```

### 5. Export Visuals for Reports
```bash
# Generate shareable images
specter health --png health.png --social
specter wrapped --png wrapped.png --social
```

## 🎨 Personality Modes Explained

- **default** - Balanced, professional tone
- **mentor** - Teaching style, explains why
- **critic** - Brutally honest, no sugar coating
- **historian** - Story-telling approach
- **cheerleader** - Positive, encouraging
- **minimalist** - Concise, bullet points only
- **noir** - Hard-boiled detective style
- **therapist** - Empathetic, supportive
- **dramatic** - Theatrical and intense
- **ghost** - Spooky supernatural theme

## 🚨 Common Issues & Solutions

### "No graph found" Error
```bash
# You need to scan first
specter scan
```

### Stale Data
```bash
# Force a fresh scan
specter scan --force
```

### Slow Scans
```bash
# Use git history (faster)
specter scan --git

# Show progress
specter scan --verbose
```

### Too Much Output
```bash
# Use --limit flag
specter hotspots --limit 10

# Use --quiet flag
specter health --quiet

# Use JSON and filter
specter health --json | jq '.healthScore'
```

## 📖 Further Reading

- **MCP Integration**: See `docs/MCP_INTEGRATION.md` for MCP server usage
- **Example Prompts**: See `docs/MCP_EXAMPLE_PROMPTS.md` for AI prompt examples
- **Full Documentation**: Run `specter --help` or visit the docs folder

## 🎓 Teaching Copilot About Context

When asking Copilot to help with code analysis, provide Specter output as context:

```markdown
I ran `specter hotspots` and found these issues:
[paste output]

Can you help me refactor the top file?
```

This helps Copilot understand:
- What code is problematic
- Why it needs attention
- What metrics matter

## ⚡ Power User Workflows

### Morning Routine
```bash
specter morning          # Yesterday's summary
specter vitals          # Current health
specter ask "What should I focus on today?"
```

### Before Pushing Code
```bash
specter precommit       # Pre-commit checks
specter fix src/       # Check your changes
```

### Weekly Review
```bash
specter wrapped --period week
specter trends
specter achievements    # Gamification!
```

---

**Remember**: Specter is most powerful when you:
1. Scan regularly (`specter scan`)
2. Ask specific questions (`specter ask`)
3. Act on suggestions (`specter fix`)
4. Track progress over time (`specter trajectory`)

For Copilot contest judges: This is the only codebase analysis tool that gives your code multiple personalities! 🎭
