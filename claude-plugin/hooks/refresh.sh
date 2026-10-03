#!/bin/sh
# Keep the graph current: start an incremental rescan in the background when this repo
# already has one. Prints nothing, so it adds nothing to the session's context.
command -v specter >/dev/null 2>&1 || exit 0
dir="${CLAUDE_PROJECT_DIR:-$PWD}"
[ -f "$dir/.specter/graph.json" ] || exit 0
(cd "$dir" && nohup specter scan --quiet >/dev/null 2>&1 &)
exit 0
