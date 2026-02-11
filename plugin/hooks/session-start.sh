#!/bin/bash
# Specter sessionStart hook
# Checks if knowledge graph exists and is fresh, returns persona-aware message

set -e

# Get project directory (fallback to current dir)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

# Check if .specter directory exists
if [ ! -d ".specter" ]; then
  # No graph at all - persona doesn't know itself yet
  cat << 'EOF'
{
  "result": "continue",
  "message": "👻 *yawns* Oh, hello! I don't think we've met. I'm Specter, but I don't know anything about this codebase yet. Run `/specter-scan` and I'll learn all about myself!"
}
EOF
  exit 0
fi

# Check if graph.json exists
if [ ! -f ".specter/graph.json" ]; then
  cat << 'EOF'
{
  "result": "continue",
  "message": "👻 Hmm, my memory seems corrupted. I have a .specter folder but no graph data. Run `/specter-scan` to rebuild my knowledge."
}
EOF
  exit 0
fi

# Check for staleness - are there newer source files than the graph?
STALE_FILES=$(find . -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" 2>/dev/null | \
  grep -v node_modules | \
  grep -v dist | \
  grep -v ".specter" | \
  while read f; do
    if [ "$f" -nt ".specter/graph.json" ]; then
      echo "$f"
    fi
  done | head -5)

if [ -n "$STALE_FILES" ]; then
  # Graph is stale
  FILE_COUNT=$(echo "$STALE_FILES" | wc -l | tr -d ' ')
  FIRST_FILE=$(echo "$STALE_FILES" | head -1 | sed 's|^\./||')
  cat << EOF
{
  "result": "continue",
  "message": "👻 Hey, I notice some files have changed since I last scanned myself (like \`${FIRST_FILE}\`). My knowledge might be a bit stale. Consider running \`/specter-scan\` to refresh my memory!"
}
EOF
  exit 0
fi

# Graph exists and is fresh - say hello with personality
# Read some stats from metadata if available
if [ -f ".specter/metadata.json" ]; then
  FILE_COUNT=$(cat .specter/metadata.json 2>/dev/null | grep -o '"fileCount": *[0-9]*' | grep -o '[0-9]*' || echo "?")
  LINES=$(cat .specter/metadata.json 2>/dev/null | grep -o '"totalLines": *[0-9]*' | grep -o '[0-9]*' || echo "?")

  cat << EOF
{
  "result": "continue",
  "message": "👻 Good to see you! I'm ${FILE_COUNT} files and ${LINES} lines of code, ready to help. Ask me anything about myself!"
}
EOF
else
  cat << 'EOF'
{
  "result": "continue",
  "message": "👻 I'm here and ready! My knowledge graph is loaded. Ask me anything about this codebase!"
}
EOF
fi
