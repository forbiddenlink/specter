#!/bin/bash
# Specter post-commit health delta
# Shows a 1-line health change after each commit.
# Non-blocking: runs silently if specter is not installed or scan fails.

# Find specter - check global, local, then npx
SPECTER=$(command -v specter 2>/dev/null)
if [ -z "$SPECTER" ]; then
  if npx --yes specter --version >/dev/null 2>&1; then
    SPECTER="npx --yes specter"
  else
    exit 0
  fi
fi

# Get health score as JSON (fast - reads cached graph)
HEALTH_JSON=$($SPECTER health --json 2>/dev/null)
if [ $? -ne 0 ] || [ -z "$HEALTH_JSON" ]; then
  exit 0
fi

# Extract current health score
CURRENT=$(echo "$HEALTH_JSON" | node -e "
  let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    try { console.log(JSON.parse(d).data.healthScore); }
    catch(e) { process.exit(1); }
  });
" 2>/dev/null)

if [ -z "$CURRENT" ]; then
  exit 0
fi

# Read previous health score from .specter/last-health.txt
PREV_FILE=".specter/last-health.txt"
PREV=""
if [ -f "$PREV_FILE" ]; then
  PREV=$(cat "$PREV_FILE")
fi

# Save current for next time
mkdir -p .specter
echo "$CURRENT" > "$PREV_FILE"

# If no previous score, just show current
if [ -z "$PREV" ]; then
  echo "Specter: Health $CURRENT/100"
  exit 0
fi

# Calculate delta
DELTA=$((CURRENT - PREV))
if [ "$DELTA" -gt 0 ]; then
  echo "Specter: Health $PREV -> $CURRENT (+$DELTA) ok"
elif [ "$DELTA" -lt 0 ]; then
  echo "Specter: Health $PREV -> $CURRENT ($DELTA) warning"
fi
# If delta is 0, say nothing
