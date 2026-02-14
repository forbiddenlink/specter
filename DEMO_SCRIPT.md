# Specter Video Demo Script

**Duration:** ~3-5 minutes
**Target:** Show Specter's unique value proposition - codebase analysis with personality

---

## Setup Before Recording

```bash
# Use a real project (Mythos or ComponentCompass work well)
cd /path/to/your/project

# Pre-scan so commands are instant
specter scan
```

---

## Demo Flow

### 1. Opening Hook (30 sec)
> "What if your codebase could talk? Let me show you Specter."

```bash
# Show the banner
specter --version
```

### 2. First Scan & Health Check (45 sec)
> "First, let's give the codebase a voice."

```bash
specter scan
specter health
```
**What to highlight:** Health score, complexity distribution, hotspots list

### 3. Vital Signs Dashboard (30 sec)
> "Real-time vital signs - like a heart monitor for your code."

```bash
specter vitals
```
**What to highlight:** The ASCII dashboard with pulse status, bus factor, dead code

### 4. Find the Pain Points (45 sec)
> "Where should you actually spend your time?"

```bash
specter hotspots
```
**What to highlight:** The scatter plot, complexity × churn = priority

```bash
specter cost
```
**What to highlight:** Tech debt in DOLLARS - makes it real for stakeholders

### 5. Understand Why Code Exists (30 sec)
> "Ever wonder why a file exists? Ask it."

```bash
specter why src/components/ChatInterface.tsx
```
**What to highlight:** Origin story, connections, major changes

### 6. The Fun Stuff (45 sec)
> "Analysis doesn't have to be boring."

```bash
specter roast
```
**What to highlight:** The comedic roast - complexity crimes, naming sins

```bash
specter tinder
```
**What to highlight:** Dating profile format - green flags, red flags

### 7. Team Insights (30 sec)
> "Who knows what? And what's at risk?"

```bash
specter bus-factor
```
**What to highlight:** Single-owner files, knowledge concentration risks

```bash
specter knowledge-map
```
**What to highlight:** Expertise heatmap by contributor

### 8. Daily Workflow (30 sec)
> "Start every day knowing what matters."

```bash
specter morning
```
**What to highlight:** Yesterday's activity, hot files, today's focus

### 9. Closing - The Wrapped (30 sec)
> "And at the end of the year..."

```bash
specter wrapped
```
**What to highlight:** Spotify Wrapped-style summary - top tracks, streaks, fun facts

---

## Key Talking Points

1. **Not just metrics - context and meaning**
   - "Complexity 45" → "This file costs $73k/year to maintain"

2. **Personality modes**
   - Same data, different voice: mentor, critic, roast, executive

3. **No external services**
   - Everything runs locally, no telemetry, your data stays yours

4. **MCP Integration**
   - Works with GitHub Copilot CLI for AI-powered analysis

---

## Commands to Avoid (Too Slow/Complex for Demo)

- `dashboard` - Takes time to load browser
- `interactive` - Requires keyboard input
- `review` - Needs GitHub token
- `ai-commit` - Needs Copilot CLI

---

## Quick Wins if Time Permits

```bash
# Funny one-liners
specter horoscope          # Daily code horoscope
specter meme               # Generate meme from metrics
specter anthem             # Theme song for your codebase
specter blame-game         # Gamified blame awards
specter confess <file>     # File confesses its sins
```

---

## Sample Narration

> "Traditional tools give you numbers. Specter gives you stories.
>
> Instead of 'cyclomatic complexity: 45', you get 'This function is so complex, it's basically an escape room.'
>
> Instead of 'tech debt exists', you get '$510,000 annual maintenance burden.'
>
> 66 commands. 12 personality modes. Zero external services.
>
> Give your codebase a voice. Try Specter."

---

## Call to Action

```bash
npm install -g @purplegumdropz/specter
specter scan && specter health

# Or try the roast without installing
npx @purplegumdropz/specter-roast
```
