#!/bin/sh
# Change-risk brief before Claude edits a file. A no-op when specter is not installed
# or the repo has no graph, so the plugin is safe to enable everywhere.
command -v specter-hook >/dev/null 2>&1 || exit 0
exec specter-hook
