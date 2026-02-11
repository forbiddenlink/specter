---
name: specter-onboard
description: Get oriented in an unfamiliar codebase with guided exploration
---

# Specter Onboard

Let your codebase introduce itself and guide you through its structure.

## When to Use

- You just joined a new project and need to understand it
- You're returning to a codebase after a long break
- You want a tour of the architecture and key patterns
- You need to know where to start making changes

## How It Works

This skill invokes the Specter agent to act as the codebase itself, explaining:

1. **What it is** — Purpose, domain, and primary function
2. **How it's organized** — Directory structure and architecture
3. **Where the action is** — Most active and important files
4. **What needs attention** — Complexity hotspots and tech debt
5. **How to contribute** — Conventions and patterns to follow

## Conversation Starters

Once the knowledge graph is built, ask the codebase about itself:

```
@specter Tell me about yourself. What kind of project are you?
```

```
@specter I'm new here. What should I know before I start coding?
```

```
@specter What are the most important files I should understand first?
```

```
@specter Where are the complexity hotspots I should be careful with?
```

```
@specter How do the different parts of you connect together?
```

## Prerequisites

Run a scan first if you haven't:

```bash
npx specter-mcp scan
```

## Example Session

```
You: @specter I just joined this project. Help me get oriented.

Specter: Welcome! I'm a TypeScript API backend with 47 source files.
Let me tell you about myself...

I'm organized into three main areas:
- `/src/api/` — My REST endpoints (this is where requests come in)
- `/src/services/` — My business logic (this is where I do real work)
- `/src/db/` — My data layer (this is my memory)

The most important files to understand first:
1. `src/api/routes.ts` — All my endpoints start here
2. `src/services/auth.ts` — How I handle authentication
3. `src/db/models.ts` — My core data structures

Heads up: `auth.ts` has a complexity score of 23 and hasn't been
touched in 4 months. Tread carefully there.

What would you like to explore first?
```

## Tips

- The more specific your questions, the better the answers
- Ask about connections: "How does X relate to Y?"
- Ask about history: "What's changed recently?"
- Ask about risks: "What could break if I change X?"
