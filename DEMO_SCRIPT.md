# Specter Video Demo Script

## 🎬 Overview
This script guides you through demonstrating Specter's most impressive features for a comprehensive video demo. Each section is designed to showcase different capabilities in a logical flow.

**Total estimated time:** 15-20 minutes
**Recommended recording:** Split into segments, then edit together

---

## 📋 Prerequisites

Before starting the demo:

1. **Clean terminal window** - Clear, good contrast, readable font size
2. **Demo project** - Use the Specter repo itself (it has interesting metrics)
3. **Specter built** - Run `npm run build` before starting
4. **Git history** - Ensure you're in a git repository with commit history
5. **Environment** - Have OpenAI API key set if demonstrating AI features

```bash
# Quick setup
cd /path/to/specter
npm run build
export OPENAI_API_KEY="your-key-here"
```

---

## 🎭 Demo Flow

### Part 1: Quick Start & First Impressions (2-3 minutes)

**Goal:** Show how easy it is to get started and get immediate insights

```bash
# 1. Show the awakening animation
specter scan

# What you'll see:
# - 👻 SPECTER AWAKENING...
# - Progress spinner
# - File/line/symbol counts
# - Health score with emoji
# - Languages detected
# - "I am ready to talk!"

# 2. Show the health report
specter health

# What to highlight:
# - Beautiful box drawing visualization
# - Health score with progress bar
# - Complexity distribution with color-coded bars
# - Top 10 hotspots with complexity scores
# - Personality-based commentary
```

**Script suggestion:**
> "Let's wake up Specter and see what it tells us about this codebase. Just run `specter scan` and in seconds, you get a complete overview. Now let's dig deeper with `specter health` - it shows us exactly where the complexity is hiding, with a beautiful visual report."

---

### Part 2: Fun Commands - Show Personality (3-4 minutes)

**Goal:** Demonstrate that developer tools can be delightful

```bash
# 3. Show codebase DNA
specter dna

# What to highlight:
# - Unique DNA sequence (changes with codebase)
# - ASCII double helix visualization
# - Genetic traits (size, complexity, language, coupling, density)
# - Genome signature
# - "No two projects share the same DNA" message

# 4. Roast the codebase (if feeling brave!)
specter roast

# What to highlight:
# - AI-powered humor
# - Calls out complexity crimes
# - Points to dead code
# - Witty commentary on hotspots
# - "*drops mic*" ending

# 5. Show Tinder-style code review
specter tinder -n 3

# What to highlight:
# - Swipe left/right on code
# - Heart/Broken heart interactions
# - Fun way to review code quality

# 6. Generate codebase wrapped (like Spotify Wrapped)
specter wrapped

# What to highlight:
# - Year-end style summary
# - Top contributors
# - Busiest months
# - Language breakdown
# - Fun stats and achievements
```

**Script suggestion:**
> "But Specter isn't just about serious metrics - it makes developer experience fun. Every codebase gets a unique DNA profile. Want to see your code roasted by AI? We've got that. And yes, we even have Tinder for your code."

---

### Part 3: Serious Analysis - The Power Tools (4-5 minutes)

**Goal:** Show enterprise-grade code analysis capabilities

```bash
# 7. Identify refactoring priorities
specter hotspots -t 5

# What to highlight:
# - Complexity x Churn = Priority
# - ASCII scatter plot visualization
# - Quadrant analysis (danger zone, legacy debt, etc.)
# - Estimated refactoring hours
# - Specific file recommendations with effort estimates

# 8. Analyze code coupling
specter coupling -t 10

# What to highlight:
# - Files that change together
# - Coupling scores
# - Dependency relationships
# - Hidden architectural issues

# 9. Calculate bus factor
specter bus-factor

# What to highlight:
# - Risk assessment if developers leave
# - File ownership concentration
# - Knowledge silos
# - Critical files with single owner

# 10. DORA metrics
specter dora

# What to highlight:
# - Deployment frequency
# - Lead time for changes
# - Time to restore service
# - Change failure rate
# - DevOps performance classification
```

**Script suggestion:**
> "Now let's look at the serious analysis. Hotspots shows you exactly where to focus refactoring efforts by combining complexity with churn. Bus factor reveals your knowledge risks. DORA metrics tell you how your team stacks up against industry standards."

---

### Part 4: AI-Powered Features (3-4 minutes)

**Goal:** Showcase intelligent code understanding

```bash
# 11. Semantic code search
specter search "authentication logic"

# What to highlight:
# - Finds relevant code by meaning, not just keywords
# - Confidence scores
# - Context from comments and code
# - Multiple match types (exact, good, related)

# 12. Ask questions about the code
specter ask "How does the health command calculate complexity?"

# What you'll see:
# - Natural language query processing
# - Code context retrieval
# - AI-generated explanation with file references
# - Follow-up question suggestions

# 13. Get AI-powered fix suggestions
specter fix src/commands/analysis/health.ts

# What to highlight:
# - Identifies complexity issues
# - Suggests specific refactorings
# - Explains why changes improve maintainability
```

**Script suggestion:**
> "Specter doesn't just analyze - it understands. Search for code by meaning, not just text. Ask questions in plain English. Get intelligent refactoring suggestions. It's like having a senior developer reviewing your code."

---

### Part 5: Developer Workflow Integration (2-3 minutes)

**Goal:** Show how Specter fits into daily development

```bash
# 14. Morning standup helper
specter morning

# What to highlight:
# - Your commits since yesterday
# - Files you worked on
# - Complexity changes you introduced
# - Ready-made standup talking points

# 15. Pre-commit checks
specter precommit

# What to highlight:
# - Checks for complexity regressions
# - Warns about hotspot modifications
# - Suggests splitting large changes
# - Can block commits that hurt quality

# 16. Watch mode for continuous monitoring
specter watch &

# Show it detecting changes in real-time
# Edit a file and save
# Watch Specter automatically re-analyze

# Kill the watch process after demo
```

**Script suggestion:**
> "Specter integrates seamlessly into your workflow. Morning command gives you standup notes. Precommit hooks catch quality regressions before they merge. Watch mode keeps your metrics updated in real-time."

---

### Part 6: Visualizations & Sharing (2-3 minutes)

**Goal:** Show visual outputs and team collaboration features

```bash
# 17. Launch interactive dashboard
specter dashboard

# What to highlight:
# - Web-based UI opens in browser
# - Interactive graphs and charts
# - Drill-down capabilities
# - Real-time updates
# - Shareable URL for team

# 18. Generate architecture diagram
specter diagram --format mermaid

# What to highlight:
# - Auto-generated architecture
# - Module relationships
# - Dependency flow
# - Can export to various formats

# 19. Export PNG for sharing
specter health --png health-report.png

# What to highlight:
# - Shareable image format
# - Perfect for Slack/GitHub
# - Can include QR code to repo
# - Social media ready format
```

**Script suggestion:**
> "Team collaboration is built in. Launch an interactive dashboard for the whole team. Generate architecture diagrams automatically. Export beautiful PNGs for your Slack channels or README files."

---

### Part 7: CI/CD & Automation (2 minutes)

**Goal:** Show enterprise integration capabilities

```bash
# 20. JSON output for CI/CD
specter health --json

# What to highlight:
# - Machine-readable output
# - Perfect for CI/CD pipelines
# - Structured data for custom processing

# 21. Exit codes for quality gates
specter health --exit-code --threshold 60

# What to highlight:
# - Fails build if quality drops below threshold
# - Enforces quality standards
# - Prevents technical debt accumulation

# 22. Generate PR comments
specter report --format markdown > pr-comment.md
cat pr-comment.md

# What to highlight:
# - Formatted for GitHub PR comments
# - Includes metrics and recommendations
# - Can be automated with GitHub Actions
```

**Script suggestion:**
> "Specter is CI/CD ready. JSON output for custom integrations. Quality gates to enforce standards. Automated PR comments to keep the team informed about code health."

---

### Part 8: MCP & GitHub Copilot Integration (2-3 minutes)

**Goal:** Show cutting-edge LLM integration

```bash
# 23. Show MCP server capability
# (If you have GitHub Copilot CLI or Claude with MCP)

# Open GitHub Copilot Chat and demo:
# "@specter what are the hotspots in this codebase?"
# "@specter explain the complexity in src/ask.ts"
# "@specter show me the bus factor"

# What to highlight:
# - Natural language interface
# - Context-aware responses
# - IDE integration
# - No context switching needed
```

**Demo in Copilot Chat:**
```
@specter what are the top 3 complexity hotspots?
@specter who owns the authentication code?
@specter what changed in the last sprint?
```

**Script suggestion:**
> "And the future is here - Specter works as a Model Context Protocol server. Ask questions about your codebase directly in GitHub Copilot or Claude. No CLI needed, just natural conversation with your code."

---

## 🎯 Key Messages to Emphasize

Throughout the demo, weave in these key points:

1. **Fast & Easy:** "Analysis in seconds, not minutes"
2. **Visual & Beautiful:** "Charts and colors that tell the story"
3. **Actionable Insights:** "Not just metrics - specific recommendations"
4. **Developer Joy:** "Tools can be powerful AND delightful"
5. **Team Collaboration:** "Share insights with the whole team"
6. **CI/CD Ready:** "From local dev to production pipeline"
7. **LLM Native:** "Built for the AI age of development"

---

## 💡 Demo Tips

### Do's:
- ✅ Use a project with interesting metrics (Specter itself works great)
- ✅ Prepare your terminal (large font, good contrast)
- ✅ Rehearse transitions between commands
- ✅ Have fun with the personality commands
- ✅ Show both good and bad code examples
- ✅ Mention open source and contribution welcome
- ✅ End with a clear call to action

### Don'ts:
- ❌ Rush through visualizations - let them load fully
- ❌ Skip the fun commands - they show personality
- ❌ Forget to mention AI costs (OpenAIKey required for some features)
- ❌ Demo on an empty or trivial project
- ❌ Apologize for any "bad" metrics - they prove the tool works!

---

## 🎬 Alternative: Quick 5-Minute Version

If you need a shorter demo, use this condensed flow:

1. `specter scan` - Show the awakening (30s)
2. `specter health` - Visual health report (1m)
3. `specter dna` - Show personality (30s)
4. `specter hotspots -t 3` - Refactoring priorities (1m)
5. `specter ask "what does this project do?"` - AI understanding (1m)
6. `specter dashboard` - Open web UI (1m)
7. Copilot integration demo (1m)

---

## 📊 Expected Results (Using Specter Project)

When demoing on the Specter project itself, you should see approximately:

- **Health Score:** ~39-62/100 (orange) - Shows the tool is honest!
- **Files:** ~182 files
- **Lines:** ~43,000 lines
- **Top Hotspots:** src/ask.ts, src/export-png.ts, src/wrapped.ts
- **Complexity:** Mix of all levels, with 58 critical functions
- **Languages:** TypeScript dominant (176), JavaScript (6)

These real metrics make for a compelling demo - the tool doesn't sugarcoat reality!

---

## 🔧 Troubleshooting Demo Issues

### If health command crashes:
```bash
npm run build  # Rebuild to ensure latest fixes
```

### If AI commands fail:
```bash
# Check API key is set
echo $OPENAI_API_KEY
```

### If dashboard won't open:
```bash
# Check port 3333 is available
lsof -i :3333
```

### If scan seems slow:
```bash
# Exclude large dirs
specter scan --exclude node_modules,dist
```

---

## 🎉 Closing the Demo

**Strong finish:**
> "So that's Specter - it gives your codebase a voice. Whether you need serious analysis for refactoring decisions, fun visualizations to share with your team, or AI-powered insights to understand legacy code, Specter has you covered. It's open source, it's fast, and it's free. Star us on GitHub, try it on your codebase, and let us know what you think!"

**Clear call to action:**
- GitHub: https://github.com/forbiddenlink/specter
- Installation: `npm install -g @purplegumdropz/specter`
- Documentation: Check the README
- Contribute: PRs welcome!

---

## 📝 Post-Demo Checklist

After recording:

- [ ] Edit out any long pauses or errors
- [ ] Add title cards for each section
- [ ] Consider adding background music (subtle!)
- [ ] Add annotations/callouts for key points
- [ ] Include a description with timestamp markers
- [ ] Pin top comment with installation command
- [ ] Share on Twitter, Reddit, HackerNews
- [ ] Update README with video embed

---

**Good luck with your demo! 🚀👻**

_Remember: The bugs and high complexity in Specter itself make the demo more authentic - they prove the tool works!_
