# Specter

<p align="center">
  <strong>Give your codebase a voice.</strong>
</p>

<p align="center">
  A haunted code analysis tool that speaks <em>as</em> your codebase in first person.<br/>
  51 commands. 12 personality modes. One ghost.
</p>

```
$ specter health

  ╔════════════════════════════════════════════════════════════╗
  ║  SPECTER HEALTH REPORT                                     ║
  ╠════════════════════════════════════════════════════════════╣
  ║  Health Score:  78/100                                     ║
  ║     [████████████████████████████░░░░░░░░░░░░]             ║
  ╠════════════════════════════════════════════════════════════╣
  ║  Complexity Distribution                                   ║
  ║  ──────────────────────────────────────────────            ║
  ║  Low (1-5)       [████████████████████]  142               ║
  ║  Medium (6-10)   [██████░░░░░░░░░░░░░░]   38               ║
  ║  High (11-20)    [██░░░░░░░░░░░░░░░░░░]   12               ║
  ║  Critical (21+)  [░░░░░░░░░░░░░░░░░░░░]    2               ║
  ╚════════════════════════════════════════════════════════════╝

  "I'm feeling pretty good about myself. My complexity hotspots
   are under control, though src/legacy/parser.ts keeps me up
   at night..."
```

---

## Quick Start

```bash
# Install globally
npm install -g specter-mcp

# Initialize a new project (interactive setup)
specter init

# Or quick setup
specter scan && specter health && specter morning
```

**Three commands to understand any codebase:**

1. `specter scan` - Build the knowledge graph
2. `specter health` - See overall health and hotspots
3. `specter morning` - Get your daily briefing

### Quick Roast (No Install Required)

Want to try Specter without installing? Get a brutal roast of any codebase:

```bash
npx specter-roast          # Normal roast
npx specter-roast --savage  # Maximum brutality
```

---

## Features at a Glance

| Category | Commands | What They Do |
|----------|----------|--------------|
| **Fun/Viral** | `roast`, `tinder`, `horoscope`, `wrapped`, `achievements`, `seance`, `dna`, `origin`, `confess`, `fortune`, `vitals`, `leaderboard` | Shareable, personality-driven entertainment + gamification |
| **Daily Workflow** | `morning`, `precommit`, `compare`, `tour`, `who`, `safe`, `danger`, `predict`, `reviewers`, `why`, `standup`, `fix` | Practical tools for everyday development |
| **Deep Intelligence** | `drift`, `cycles`, `velocity`, `trajectory`, `knowledge-map`, `search`, `diagram`, `hotspots`, `bus-factor`, `dora`, `coupling`, `report`, `index`, `ask`, `cost`, `breaking-changes`, `changelog` | Advanced analysis and metrics |
| **Setup & Core** | `init`, `init-hooks`, `scan`, `status`, `health`, `trends`, `risk`, `dashboard`, `clean` | Foundation commands |

---

## Fun & Viral Commands

### `specter roast`
Get a comedic critique of your codebase.

```
$ specter roast

  CODEBASE ROAST

  "Oh, you call this a utils folder? It's more like a
   graveyard for functions you were too afraid to delete.

   Your helpers.ts has 47 exports. FORTY-SEVEN. That's not
   a helper, that's a cry for help.

   I've seen cleaner code in a jQuery plugin from 2009."
```

### `specter tinder`
Generate a dating profile for your codebase.

```
$ specter tinder

  CODEBASE DATING PROFILE

  myproject/, 3 months old, TypeScript

  "Healthy, well-maintained, and looking for developers
   who appreciate clean code. I have 142 functions and
   I know how to use them."

  Green Flags:
  • 94% TypeScript (I know my types)
  • Health score 78 (I work out)
  • No critical complexity (drama-free)

  Red Flags:
  • utils/ folder (some skeletons)
  • Bus factor 1.2 (attachment issues)

  [PASS]     [MERGE]
```

### `specter horoscope`
Daily fortune based on your commit patterns.

```
$ specter horoscope

  Your Code Horoscope for February 11

  Aries Codebase Rising

  "Mercury is in retrograde, and so are your dependencies.
   Today is NOT the day to run npm update.

   The stars align for refactoring src/utils/. Your lucky
   function is processData(). Avoid touching anything in
   the legacy/ folder."
```

### `specter wrapped`
Spotify Wrapped-style yearly summary.

```bash
specter wrapped           # Terminal output
specter wrapped --png     # Generate shareable image
```

### `specter achievements`
Gamified badges for your codebase.

```bash
specter achievements           # View all unlocked badges
specter achievements --png     # Generate shareable badge image
```

### `specter seance [query]`
Commune with deleted files from git history.

```
$ specter seance "the old auth system"

  SEANCE - Communing with Deleted Code

  *static* ...I hear whispers from the git history...

  Found 3 spirits matching "auth":

  src/auth/legacy-login.ts (deleted 2024-08-15)
  "I was removed in the great auth refactor. They said I
   was too complex, but I WORKED. The new system still
   doesn't handle edge cases like I did..."

  src/middleware/session.ts (deleted 2024-06-22)
  "I haunt the git history, waiting to be restored..."
```

### `specter dna`
Generate a unique visual fingerprint for your codebase.

```bash
specter dna           # Terminal art
specter dna --png     # Generate shareable image
```

### `specter origin`
AI-generated origin story for your project.

### `specter confess <file>`
Files confess their sins.

```
$ specter confess src/utils/helpers.ts

  FILE CONFESSION

  "Forgive me, developer, for I have sinned...

   I was supposed to be temporary. That was 18 months ago.
   I have 47 exports, and I've lost track of what half of
   them even do.

   I import from 12 different modules. Some of them import
   me back. It's complicated.

   The formatDate function? I copied it from Stack Overflow
   in 2023. The tests don't cover it."
```

### `specter fortune`
Tarot-style code predictions.

### `specter vitals`
Real-time vital signs dashboard.

```
$ specter vitals

  ╔═══════════════════════════════════════════════════╗
  ║  SPECTER VITAL SIGNS              PULSE: STABLE   ║
  ╠═══════════════════════════════════════════════════╣
  ║                                                   ║
  ║  HEALTH      [████████░░] 78/100   +3            ║
  ║  COMPLEXITY  [████░░░░░░]  8 avg   healthy       ║
  ║  BUS FACTOR  [██░░░░░░░░] 1.8      at risk       ║
  ║  DEAD CODE   [█░░░░░░░░░]  5       haunted       ║
  ║  COVERAGE    [██████░░░░] 62%      decent        ║
  ╚═══════════════════════════════════════════════════╝
```

### `specter leaderboard`
Team gamification - who's improving the codebase?

```
$ specter leaderboard

  🏆 SPECTER LEADERBOARD

  Who's improving the codebase?

  ════════════════════════════════════════════════════════

  🥇 #1  Alice Smith                              +320 pts
      ████████████████████ Health Hero
      12 commits │ -15 complexity │ +2 bus factor

  🥈 #2  Bob Johnson                              +180 pts
      ██████████░░░░░░░░░░ Code Guardian
      8 commits │ -5 complexity │ +1 bus factor

  🥉 #3  Charlie Brown                            +90 pts
      █████░░░░░░░░░░░░░░░ Rising Star
      6 commits │ +3 complexity │ 0 bus factor

  ────────────────────────────────────────────────────────

  📊 Team Stats (1/15/2026 - 2/12/2026):
     Total commits: 26
     Net complexity: -17 (improving!) 📈
     Active contributors: 5
```

**Scoring:**
- +10 pts per commit
- +5 pts per complexity point reduced
- -5 pts per complexity point added
- +50 pts per bus factor improvement

```bash
specter leaderboard               # Last 30 days (default)
specter leaderboard --since "7 days ago"
specter leaderboard --limit 5     # Top 5 only
```

---

## Daily Workflow Commands

### `specter morning`
Start your day with a health briefing.

```
$ specter morning

  Good morning! Here's your daily code briefing:

  OVERNIGHT CHANGES
  • 3 commits since yesterday
  • 2 files touched in src/api/
  • No new complexity hotspots

  TODAY'S PRIORITIES
  1. src/utils/parser.ts grew +15 complexity
  2. Bus factor dropped in src/core/
  3. Test coverage down 2%

  WEATHER FORECAST
  Partly cloudy with a chance of merge conflicts
```

### `specter precommit`
Quick risk check before committing.

```bash
specter precommit              # Check staged changes
specter precommit --exit-code  # Exit 1 if high-risk (for CI)
```

### `specter tour`
Interactive walkthrough for new developers.

```
$ specter tour

  Welcome to the Specter Guided Tour!

  This codebase is a TypeScript project with 47 files.
  Let me show you around...

  ENTRY POINTS
  • src/index.ts - Main entry point
  • src/cli.ts - CLI interface

  THE IMPORTANT PARTS
  • src/graph/ - Where the magic happens
  • src/analyzers/ - Code analysis engine

  THE SCARY PARTS
  • src/legacy/ - Here be dragons
  • src/utils/helpers.ts - The junk drawer
```

### `specter who <file>`
Find the experts for any file.

```
$ specter who src/graph/builder.ts

  WHO KNOWS THIS FILE?

  alice@company.com    ████████████████░░░░  78%
  bob@company.com      ████░░░░░░░░░░░░░░░░  18%
  charlie@company.com  █░░░░░░░░░░░░░░░░░░░   4%

  Recommendation: Ask Alice. She wrote 78% of this file
  and touched it 23 times in the last 6 months.
```

### `specter safe`
Safe zones for new developers to start contributing.

```
$ specter safe

  SAFE ZONES FOR NEW CONTRIBUTORS

  These areas have low complexity, good test coverage,
  and clear ownership:

  src/ui/components/
  • Complexity: 3.2 avg
  • Coverage: 89%
  • Bus factor: 3

  src/utils/formatting.ts
  • Complexity: 2.8 avg
  • Coverage: 94%
  • Bus factor: 2
```

### `specter danger`
High-risk areas to avoid.

### `specter predict`
PR impact prediction before you submit.

```
$ specter predict

  PR IMPACT PREDICTION

  Based on your staged changes:

  RISK LEVEL: MEDIUM

  Files: 4 changed
  Complexity Delta: +8
  Affected Consumers: 12 files

  ESTIMATED REVIEW TIME: 25 minutes

  PREDICTED ISSUES:
  • May break src/api/handlers.ts (imports changed)
  • Test coverage will drop 3%

  SUGGESTED REVIEWERS:
  • alice@company.com (owns 3/4 files)
  • bob@company.com (reviewed similar PRs)
```

### `specter reviewers`
Suggest optimal PR reviewers.

### `specter why <file>`
Explain why code exists by analyzing git history, comments, and patterns.

```
$ specter why src/auth/session.ts

  WHY DOES THIS CODE EXIST?

  HISTORICAL CONTEXT:
  • Created 8 months ago in commit 3a7f2e1
  • "Refactor: Move session management to dedicated module"
  • Initial commit had complex session logic from legacy auth.ts

  GIT HISTORY ANALYSIS:
  • Last touched 2 weeks ago
  • 14 commits total, averaging 2 per month
  • 3 authors have contributed

  CODE PATTERNS & INTENT:
  • Handles JWT token validation and refresh
  • Manages user session state across requests
  • Integrates with src/middleware/auth.ts

  ARCHITECTURE ROLE:
  This file is a critical session provider imported by 12 other files.
  It bridges the authentication layer and API handlers.
```

### `specter standup`
Daily standup summary - what changed overnight and what needs attention.

```
$ specter standup

  DAILY STANDUP SUMMARY

  OVERNIGHT CHANGES (Last 24 hours)
  • 5 commits from 3 developers
  • Files changed: src/api/ (3), src/utils/ (2)
  • Total lines changed: +247 -89

  WHAT TO KNOW TODAY:
  1. src/api/handlers.ts grew +12 complexity (now at 24)
  2. New file created: src/services/payment.ts
  3. Bus factor in src/core/ dropped to 1.5

  FILES TO REVIEW:
  • src/api/handlers.ts - High complexity growth
  • src/services/payment.ts - New code, no tests yet
  • src/utils/validators.ts - 8 changes by 2 people

  TODAY'S FOCUS:
  Review new payment service before merging to main.
```

### `specter fix [file]`
Actionable fix suggestions for detected issues - the bridge from analysis to action.

```
$ specter fix src/utils/helpers.ts

  🔧 SPECTER FIX SUGGESTIONS

  Analyzing: src/utils/helpers.ts

  ══════════════════════════════════════════════════════════

  🔴 CRITICAL: Function too complex (complexity: 28)

     Function: processData() at line 45

     Suggested fix:
     Extract these code blocks into separate functions:

     1. Lines 52-68: Extract to handleValidation()
        Conditional block (if data.type === ...)
     2. Lines 75-92: Extract to processItems()
        Loop block with substantial logic
     3. Lines 98-115: Extract to handleErrors()
        Error handling block

     Expected result: Complexity 28 -> ~7 per function

  ──────────────────────────────────────────────────────────

  🟡 WARNING: Low bus factor (1)

     Only Alice has touched this file (95% of commits).

     Suggested fix:
       - Schedule a pairing session to share knowledge
       - Add inline documentation for complex logic
       - Create a README in this directory
       - Consider code review rotations

  ──────────────────────────────────────────────────────────

  💀 INFO: Unused exports detected

     These exports are never imported elsewhere:

       - formatLegacy (line 142)
       - helperV1 (line 203)

     Suggested fix:
       - Remove if truly unused, or
       - Mark as @public if part of external API
       - Add to index.ts if meant to be re-exported

  ──────────────────────────────────────────────────────────

  Summary: 3 suggestions (1 critical, 1 warning, 1 info)
```

**Detects and suggests fixes for:**
- High complexity functions (with extractable code blocks)
- Large files (with split suggestions)
- Circular dependencies (with break strategies)
- Dead/unused exports
- Low bus factor (knowledge concentration)

```bash
specter fix src/utils/helpers.ts    # Single file
specter fix                         # All files with issues
specter fix --severity critical     # Only critical issues
```

---

## Deep Intelligence Commands

### `specter drift`
Detect architecture drift from best practices.

```
$ specter drift

  ARCHITECTURE DRIFT ANALYSIS

  Your codebase has drifted 23% from ideal patterns.

  VIOLATIONS:
  • Circular dependency in src/core ←→ src/utils
  • God object detected: src/services/main.ts (42 methods)
  • Layer violation: UI imports directly from DB

  RECOMMENDATIONS:
  1. Extract shared utilities to break the cycle
  2. Split main.ts into focused services
  3. Add an API layer between UI and DB
```

### `specter cycles`
Find circular dependencies.

```bash
specter cycles              # Detect cycles
specter cycles --exit-code  # Exit 1 if cycles found (for CI)
```

### `specter velocity`
Track complexity growth over time.

### `specter trajectory`
Project future health based on trends.

### `specter knowledge-map` (alias: `kmap`)
Team expertise heatmap.

```
$ specter kmap

  TEAM EXPERTISE HEATMAP

              alice  bob  charlie
  src/core/     ███    ░░     ░░
  src/api/      ██░    ██     ░░
  src/utils/    ░░░    ███    ██
  src/tests/    ░░░    ░░░    ███

  Legend: ███ Expert  ██░ Familiar  ░░░ Unknown

  RISK AREAS (Single Point of Failure):
  • src/core/ - Only Alice knows this
  • src/graph/ - Only Alice knows this
```

### `specter search "query"`
Natural language code search.

```
$ specter search "authentication middleware"

  SEARCH RESULTS

  TOP MATCHES:

  src/middleware/auth.ts          [████████░░] 89%
  • Function: validateToken()
  • Handles JWT validation and user lookup

  src/api/routes/login.ts         [███████░░░] 72%
  • Function: handleLogin()
  • Uses auth middleware for session creation
```

### `specter index`
Build TF-IDF embedding index for semantic search.

```bash
specter index              # Build full index
specter index --force      # Rebuild from scratch
specter index --watch      # Rebuild on file changes
specter index --quiet      # Suppress progress output
```

This command creates a semantic search index that powers the `ask` command with fast, intelligent code understanding.

### `specter ask "question"`
Natural language Q&A with personality - the wow moment feature.

Ask your codebase anything in plain English and get intelligent answers in your chosen personality.

```bash
specter ask "what does the auth system do"

# Standard output:
#   CODEBASE Q&A
#
#   Q: What does the auth system do?
#
#   A: The authentication system manages user identity verification
#   and session management. It validates JWT tokens, handles login/logout,
#   and enforces access control across API routes. Key files:
#   • src/auth/session.ts - Session state management
#   • src/middleware/auth.ts - Authentication middleware
#   • src/api/routes/login.ts - Login handler
```

With personality:

```bash
specter ask "what does the auth system do" --personality noir

  CODEBASE Q&A - NOIR MODE

  Q: What does the auth system do?

  A: "The auth system? *lights cigarette* That's where the secrets
  live, kid. Tokens, sessions, access control. It's a gatekeeper,
  see? Users can't get past without proving who they are.

  The real players? session.ts handles the state, auth.ts does the
  checking, and login.ts... well, that's where the deals happen.

  Trust me, you don't want to mess with this stuff. It's the only
  thing standing between your users and chaos."
```

Other personality examples:

```bash
specter ask "what does the auth system do" --personality mentor
# Educational explanation of design choices

specter ask "what does the auth system do" --personality cheerleader
# Enthusiastic overview with highlights

specter ask "what does the auth system do" --personality critic
# Brutally honest assessment of implementation
```

### `specter diagram`
Generate architecture diagrams.

```bash
specter diagram                    # Mermaid format (default)
specter diagram --format d2        # D2 format
specter diagram --format ascii     # ASCII art
specter diagram --output arch.md   # Save to file
specter diagram --focus src/api/   # Focus on specific area
specter diagram --complexity       # Show complexity indicators
```

### `specter hotspots`
Complexity x Churn analysis - find files that are both complex AND frequently changed.

```
$ specter hotspots

  COMPLEXITY x CHURN ANALYSIS

  SCATTER PLOT:

  Complexity
       ▲
    30 │              ● src/utils/helpers.ts
       │
    20 │    ○ legacy.ts    ● parser.ts
       │
    10 │  ○ ○ ○    ○
       │○ ○ ○ ○ ○ ○
     0 └────────────────────────▶ Churn
       0   5   10  15  20  25  30

  TOP REFACTORING PRIORITIES:
  1. src/utils/helpers.ts - Complexity: 28, Churn: 24
  2. src/graph/parser.ts - Complexity: 22, Churn: 18
```

### `specter bus-factor` (alias: `bus`)
Identify knowledge concentration risks.

```bash
specter bus-factor              # Full analysis
specter bus-factor --critical-only  # Only show critical risks
```

### `specter dora`
Calculate DORA metrics for software delivery performance.

```
$ specter dora

  DORA METRICS

  Overall Performance: HIGH

  Deployment Frequency    [████████████████░░░░]  HIGH
  Lead Time for Changes   [████████████░░░░░░░░]  MEDIUM
  Change Failure Rate     [██████████████████░░]  HIGH
  Time to Restore         [████████████████████]  ELITE

  Compared to industry benchmarks, your team is
  performing in the top 25% of engineering organizations.
```

### `specter coupling`
Discover hidden couplings - files that change together but have no direct import.

```bash
specter coupling                    # All couplings
specter coupling --hidden-only      # Only unexpected couplings
specter coupling --min-strength 50  # Minimum 50% correlation
```

### `specter report`
Generate comprehensive markdown report.

```bash
specter report                    # Full report to stdout
specter report --output health.md # Save to file
specter report --json             # JSON format for CI
specter report --quick            # Executive summary only
```

### `specter cost`
Estimate tech debt in dollar terms - the command that makes managers pay attention.

```
$ specter cost

  💰 TECH DEBT COST ANALYSIS

  Estimated Annual Cost: $47,520

  ═══════════════════════════════════════════════════════════

  TOP 5 MOST EXPENSIVE FILES:

  1. src/utils/helpers.ts                           $8,640/year
     │ Complexity: 28  │ Bus Factor: 1  │ Churn: High
     └─ Maintenance: $4,320  │ Risk: $2,880  │ Training: $1,440

  2. src/graph/parser.ts                            $6,480/year
     │ Complexity: 22  │ Bus Factor: 2  │ Churn: Medium
     └─ Maintenance: $3,240  │ Risk: $2,160  │ Training: $1,080

  3. src/core/engine.ts                             $5,760/year
     ...

  ═══════════════════════════════════════════════════════════

  QUICK WINS (Best ROI):

  │ File                    │ Fix Cost │ Annual Savings │ ROI  │
  ├─────────────────────────┼──────────┼────────────────┼──────┤
  │ src/utils/helpers.ts    │ $2,400   │ $8,640         │ 260% │
  │ src/legacy/auth.ts      │ $1,600   │ $4,320         │ 170% │

  Methodology: Based on $75/hr developer rate, industry benchmarks
  for maintenance overhead, bug introduction rates, and onboarding costs.
```

```bash
specter cost                    # Default $75/hr rate
specter cost --rate 100         # Custom hourly rate
specter cost --currency EUR     # Euro currency
specter cost --png cost.png     # Export for presentations
```

---

## Core Commands

| Command | Description |
|---------|-------------|
| `specter init` | Interactive project setup wizard |
| `specter init-hooks` | Install git hooks (`--husky`, `--simple`, or `--pre-commit`) |
| `specter scan` | Build the knowledge graph |
| `specter status` | Show graph freshness and stats |
| `specter health` | Health report with complexity analysis |
| `specter trends` | Historical health trends with sparklines |
| `specter risk` | Analyze risk of staged changes |
| `specter dashboard` | Launch interactive web visualization |
| `specter clean` | Remove cached graph |

### Common Options

```bash
# Most commands support these options:
--dir <path>          # Directory to analyze (default: .)
--personality <mode>  # Output personality mode
--exit-code          # Exit with code 1 on failure (for CI)
```

---

## Personality Modes

Specter speaks in 11 distinct voices. Add `--personality <mode>` to any command:

| Mode | Style | Example |
|------|-------|---------|
| `default` | Balanced, professional | "I'm concerned about my complexity hotspots..." |
| `mentor` | Educational, explains why | "Let me walk you through why this matters..." |
| `critic` | Harsh, points out flaws | "Frankly, this is a mess. Fix it." |
| `historian` | Focuses on evolution | "My history shows this file has been troubled..." |
| `cheerleader` | Positive, encouraging | "We're doing great! This is amazing!" |
| `minimalist` | Brief, data-only | "Health: 78. Hotspots: 3. Done." |
| `noir` | Detective mystery voice | "Something doesn't add up here. Follow the imports..." |
| `therapist` | Gentle, understanding | "I sense some anxiety around this file. Let's explore why." |
| `roast` | Brutal comedy | "This isn't code, it's a cry for help." |
| `dramatic` | Epic narrator | "Alas, complexity has claimed another victim..." |
| `ghost` | Deleted code voice | "*static* ...I am the code that was deleted..." |

```bash
# Examples
specter health --personality cheerleader
specter roast  # Uses roast personality by default
specter seance "old auth"  # Uses ghost personality
```

---

## CI/CD Integration

### GitHub Action

Add Specter analysis to every PR:

```yaml
# .github/workflows/specter.yml
name: Specter Analysis
on: [pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: forbiddenlink/specter@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          personality: noir
          fail-on-high-risk: true
```

**Outputs:**
- `health-score` - Overall health (0-100)
- `risk-level` - PR risk (low/medium/high/critical)
- `review-minutes` - Estimated review time

### Pre-commit Hook

Using [pre-commit](https://pre-commit.com):

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/forbiddenlink/specter
    rev: v1.0.0
    hooks:
      - id: specter-precommit  # Block high-risk commits
      - id: specter-cycles     # Block circular dependencies
      - id: specter-health     # Enforce health threshold
```

### Simple Git Hook

```bash
# Install with Husky
specter init-hooks --husky

# Or simple git hook
specter init-hooks --simple
```

### CI Commands with Exit Codes

```bash
specter health --exit-code --threshold 70  # Fail if health < 70
specter cycles --exit-code                 # Fail if cycles found
specter precommit --exit-code              # Fail if high-risk
```

### JSON Output for CI/CD Pipelines

All data commands support `--json` for machine-readable output:

```bash
specter health --json          # JSON health metrics
specter risk --json            # JSON risk analysis
specter hotspots --json        # JSON hotspot data
specter dora --json            # JSON DORA metrics
specter bus-factor --json      # JSON bus factor risks
```

Example output:

```json
{
  "command": "health",
  "timestamp": "2026-02-12T10:30:00.000Z",
  "success": true,
  "data": {
    "healthScore": 78,
    "totalFiles": 142,
    "complexityDistribution": {...}
  },
  "meta": {
    "personality": "default"
  }
}
```

Use in CI pipelines to extract metrics:

```bash
# Get health score as exit code
HEALTH=$(specter health --json | jq '.data.healthScore')
if [ "$HEALTH" -lt 70 ]; then exit 1; fi

# Post metrics to dashboard
specter dora --json | curl -X POST -d @- https://metrics.example.com/dora
```

**47 commands** support `--json` (all except interactive: `init`, `init-hooks`, `dashboard`)

---

## MCP Server

Specter exposes 14 tools via the Model Context Protocol:

| Tool | Description |
|------|-------------|
| `get_file_relationships` | Get imports, exports, and dependencies |
| `get_complexity_hotspots` | Find most complex functions |
| `get_codebase_summary` | Overall statistics with personality |
| `get_file_history` | Git history for a file |
| `get_dead_code` | Find unused exports |
| `search_symbols` | Search for functions/classes by name |
| `get_call_chain` | Trace dependency path between files |
| `get_architecture` | Generate architecture diagrams |
| `get_change_coupling` | Files that change together |
| `get_impact_analysis` | Ripple effect of changes |
| `get_bus_factor` | Knowledge concentration risks |
| `get_archaeology` | How a file evolved over time |
| `get_health_trends` | Health trends analysis |
| `get_risk_score` | Commit/PR risk score |

### MCP Resources

Live data endpoints:

| Resource | Description |
|----------|-------------|
| `specter://summary` | Current codebase statistics |
| `specter://health` | Health score and metrics |
| `specter://hotspots` | Complexity hotspots |
| `specter://architecture` | Directory structure overview |

---

## Web Dashboard

```bash
specter dashboard
# Opens http://localhost:3333
```

Interactive features:
- Force-directed dependency graph (Cytoscape.js)
- Complexity heatmap (green to red)
- Click to inspect any file
- Search and filter
- Health timeline sparkline
- Hotspot navigation

---

## Full Command Reference

### Setup Commands
| Command | Description | Key Options |
|---------|-------------|-------------|
| `init` | Interactive project setup | `--yes`, `--no-hooks`, `--no-scan` |
| `init-hooks` | Install git hooks | `--husky`, `--simple`, `--pre-commit` |
| `scan` | Build knowledge graph | `--dir`, `--no-git`, `--force`, `--quiet` |
| `clean` | Remove cached graph | `--dir` |

### Analysis Commands
| Command | Description | Key Options |
|---------|-------------|-------------|
| `status` | Graph status | `--dir` |
| `health` | Health report | `--limit`, `--personality`, `--exit-code`, `--threshold`, `--png` |
| `trends` | Historical trends | `--period`, `--personality` |
| `risk` | Staged changes risk | `--branch`, `--commit`, `--personality` |
| `dashboard` | Web visualization | `--port`, `--no-open` |

### Daily Workflow Commands
| Command | Description | Key Options |
|---------|-------------|-------------|
| `morning` | Daily briefing | `--dir` |
| `precommit` | Pre-commit check | `--exit-code` |
| `tour` | Guided walkthrough | `--dir` |
| `who <file>` | Find file experts | `--dir` |
| `safe` | Safe zones for newbies | `--dir` |
| `danger` | High-risk areas | `--dir` |
| `predict` | PR impact prediction | `--dir` |
| `reviewers` | Suggest reviewers | `--dir` |
| `why <file>` | Explain why code exists | `--dir` |
| `standup` | Daily standup summary | `--dir` |
| `fix [file]` | Actionable fix suggestions | `--severity` |

### Deep Analysis Commands
| Command | Description | Key Options |
|---------|-------------|-------------|
| `drift` | Architecture drift | `--dir` |
| `cycles` | Circular dependencies | `--exit-code` |
| `velocity` | Complexity growth | `--dir` |
| `trajectory` | Health projection | `--dir` |
| `knowledge-map` | Expertise heatmap | `--dir` |
| `search <query>` | Natural language search | `--limit` |
| `index` | Build semantic search index | `--force`, `--watch`, `--quiet` |
| `ask <question>` | Q&A with personality | `--personality`, `--limit` |
| `diagram` | Architecture diagrams | `--format`, `--output`, `--focus`, `--depth` |
| `hotspots` | Complexity x Churn | `--top`, `--since` |
| `bus-factor` | Bus factor risks | `--critical-only` |
| `dora` | DORA metrics | `--since`, `--png` |
| `coupling` | Hidden couplings | `--hidden-only`, `--min-strength` |
| `report` | Full markdown report | `--output`, `--json`, `--quick` |
| `cost` | Tech debt in dollars | `--rate`, `--currency`, `--png` |

### Fun Commands
| Command | Description | Key Options |
|---------|-------------|-------------|
| `roast` | Comedic critique | `--dir`, `--png` |
| `tinder` | Dating profile | `--dir`, `--png` |
| `horoscope` | Daily fortune | `--dir` |
| `wrapped` | Yearly summary | `--png` |
| `achievements` | Gamified badges | `--png` |
| `seance [query]` | Commune with deleted code | `--dir` |
| `dna` | Visual fingerprint | `--png` |
| `origin` | Origin story | `--dir` |
| `confess <file>` | File confessions | `--dir` |
| `fortune` | Tarot predictions | `--dir` |
| `vitals` | Real-time dashboard | `--live` |
| `leaderboard` | Team gamification | `--since`, `--limit` |

---

## Storage

Specter stores data in `.specter/`:

```
.specter/
├── graph.json        # Knowledge graph
├── metadata.json     # Quick-access metadata
└── history/          # Health snapshots
    ├── 2024-02-01T10-00-00Z.json
    └── 2024-02-08T10-00-00Z.json
```

This directory is automatically added to `.gitignore`.

---

## Requirements

- Node.js 20+
- TypeScript/JavaScript codebase (for full analysis)
- Git repository (optional, for history analysis)

---

## Installation

```bash
# Global install
npm install -g specter-mcp

# Or use with npx
npx specter-mcp scan

# Or in a project
npm install --save-dev specter-mcp
```

---

## Contributing

Pull requests welcome! Please ensure:

1. Code compiles: `npm run build`
2. Tests pass: `npm test`
3. Follow existing code patterns

---

## License

MIT

---

<p align="center">
  Built by <a href="https://github.com/elizabethsiegle">Liz Stein</a><br/>
  <em>"I am the ghost in your git history."</em>
</p>
