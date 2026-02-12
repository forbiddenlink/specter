# Specter Demo Video Script (3 Minutes)

**Target**: GitHub Copilot CLI Challenge judges
**Tone**: Confident, slightly irreverent, developer-to-developer
**Goal**: Show personality + utility + depth

---

## INTRO (0:00 - 0:15)

**[Terminal open, specter repo visible]**

> "Most code analysis tools give you charts and numbers.
> Specter gives your codebase a voice."

```bash
specter health
```

**[Show health output with first-person commentary]**

---

## ACT 1: THE HOOK (0:15 - 0:45)

**[Quick cuts, high energy]**

> "But first, let's have some fun."

```bash
specter roast
```

**[Show roast output - pause on funny lines]**

> "Want brutal honesty without installing anything?"

```bash
npx specter-roast --savage
```

**[Quick flash of output]**

> "It also does dating apps for your code."

```bash
specter tinder
```

**[Swipe on 2-3 files]**

---

## ACT 2: DAILY VALUE (0:45 - 1:30)

**[Slower pace, practical demonstration]**

> "But this isn't just for laughs. Specter solves real problems."

### Morning Briefing
```bash
specter morning
```
> "Start every day knowing what needs attention."

### Before You Commit
```bash
specter precommit
```
> "Catch problems before they become PR comments."

### Who Knows This Code?
```bash
specter who src/cli.ts
```
> "Find the expert for any file."

### Predict PR Impact
```bash
specter predict
```
> "Know the risk before you push."

---

## ACT 3: DEEP INTELLIGENCE (1:30 - 2:15)

**[Technical showcase]**

> "Under the hood, Specter builds a full knowledge graph."

### Architecture Diagram
```bash
specter diagram
```
> "Visualize your architecture instantly."

### Bus Factor Risk
```bash
specter bus-factor
```
> "See who owns what - and where that's dangerous."

### DORA Metrics
```bash
specter dora
```
> "Industry-standard engineering metrics."

### Tech Debt in Dollars
```bash
specter cost
```
> "Turn complexity into dollar amounts."

---

## ACT 4: COPILOT CLI INTEGRATION (2:15 - 2:45)

**[Show Copilot CLI in action]**

> "Here's the magic - Specter works directly with GitHub Copilot CLI."

```bash
copilot -p "Use specter to find the complexity hotspots" --allow-all-tools
```

**[Show Copilot using Specter MCP tools]**

> "14 tools exposed via Model Context Protocol. Ask questions naturally."

```bash
copilot -p "What's the bus factor risk in this codebase?" --allow-all-tools
```

> "AI-powered analysis with full codebase context."

```bash
specter ai-ask "Why is src/cli.ts so complex?"
```

**[Show GitHub Action]**

```yaml
- uses: forbiddenlink/specter@v1
  with:
    personality: noir
```

> "Every PR analyzed automatically. 12 personality modes."

---

## CLOSE (2:45 - 3:00)

> "63 commands. 14 MCP tools. 12 personalities. One ghost."

```bash
specter achievements
```

**[Show achievements unlocking]**

> "Give your codebase a voice."

**[Show logo/URL]**

```
github.com/forbiddenlink/specter
npm install -g @purplegumdropz/specter
npx @purplegumdropz/specter-roast
```

---

## RECORDING TIPS

1. **Terminal setup**: Use a clean theme, large font (18pt+), dark background
2. **Pre-scan**: Run `specter scan` before recording so commands are instant
3. **Use `specter demo`**: Auto-runs showcase with typing effects (perfect for recordings)
   ```bash
   specter demo              # Normal speed
   specter demo --speed slow # Slower for dramatic effect
   ```
4. **Cut the waits**: Edit out any loading time
5. **Music**: Upbeat but not distracting (optional)
6. **Screen recording**: QuickTime or OBS at 1080p

## KEY MESSAGES TO HIT

- "Give your codebase a voice" (tagline)
- First-person perspective is unique
- Fun AND useful (not just a toy)
- 63 commands, 12 personalities
- Works in CI/CD (GitHub Action)
- `npx specter-roast` - zero install

## COMMANDS TO DEFINITELY SHOW

Must-show (viral):
- `roast`
- `tinder`
- `health` with personality

Must-show (utility):
- `morning`
- `precommit`
- `who`

Must-show (depth):
- `diagram`
- `dora`
- `cost`
