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

## ACT 4: INTEGRATION (2:15 - 2:45)

**[Show PR comment or CI output]**

> "Specter integrates everywhere."

**[Show GitHub Action comment]**

```yaml
- uses: forbiddenlink/specter@v1
  with:
    personality: noir
```

> "Every PR gets analyzed. 12 personality modes. Your pick."

**[Quick flash of personalities]**

```bash
specter health --personality roast
specter health --personality therapist
specter health --personality noir
```

---

## CLOSE (2:45 - 3:00)

> "51 commands. 12 personalities. One ghost."

```bash
specter achievements
```

**[Show achievements unlocking]**

> "Give your codebase a voice."

**[Show logo/URL]**

```
github.com/forbiddenlink/specter
npm install -g specter-mcp
npx specter-roast
```

---

## RECORDING TIPS

1. **Terminal setup**: Use a clean theme, large font (18pt+), dark background
2. **Pre-scan**: Run `specter scan` before recording so commands are instant
3. **Cut the waits**: Edit out any loading time
4. **Music**: Upbeat but not distracting (optional)
5. **Screen recording**: QuickTime or OBS at 1080p

## KEY MESSAGES TO HIT

- "Give your codebase a voice" (tagline)
- First-person perspective is unique
- Fun AND useful (not just a toy)
- 51 commands, 12 personalities
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
