---
name: specter-review
description: Get rich context for code review using codebase knowledge
---

# Specter Review

Use the knowledge graph to get context for reviewing code changes.

## When to Use

- Before reviewing a pull request
- Understanding the impact of changes
- Finding related code that might need checking
- Investigating why a file exists or what depends on it

## How It Works

Specter Review uses the knowledge graph to answer questions like:
- What files depend on the changed code?
- What's the history of this file?
- How complex are the changed functions?
- Is there related code I should also review?

## Example Workflow

### 1. Identify Changed Files

```bash
git diff --name-only main
```

### 2. Ask Specter About Each File

Use the specter agent or MCP tools directly:

**Check dependencies:**
"What imports src/auth/login.ts? What would break if I change its exports?"

**Check history:**
"Who wrote src/auth/login.ts? How often has it changed?"

**Check complexity:**
"What's the complexity of the functions in src/auth/login.ts?"

**Find related files:**
"How does src/auth/login.ts connect to src/api/routes.ts?"

### 3. Get Impact Assessment

Ask the specter agent:
"I'm changing the User interface in src/types/user.ts. What files will be affected?"

## Key Questions for Review

### For New Code
- Does this fit the existing patterns in the codebase?
- Are the complexity levels reasonable?
- Are the dependencies appropriate?

### For Modified Code
- What depends on this code?
- Has this file been problematic before (high churn)?
- Are the changes increasing complexity?

### For Deleted Code
- Is this actually unused (check dead code)?
- What was importing it?

## Using MCP Tools Directly

If you prefer direct tool access:

```
get_file_relationships: Check what imports/exports a file
get_file_history: See modification history
get_complexity_hotspots: Find complex code
get_call_chain: Trace dependencies between files
search_symbols: Find functions/classes by name
```

## Tips

1. **Start with high-level impact**: "What depends on this file?"
2. **Check historical context**: Files with high churn deserve extra scrutiny
3. **Look for complexity increases**: Is the change making things harder to understand?
4. **Verify dead code removal**: Use `get_dead_code` to confirm exports are unused
