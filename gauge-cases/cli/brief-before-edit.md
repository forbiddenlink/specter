---
criteria:
  - name: Grounded in history
    rubric: The answer names specific files that tend to change together with src/graph/persistence.ts, and those names come from analysis the agent actually ran on this repo's git history, not from guessing by file name.
  - name: Actionable risk call
    rubric: The answer says how risky editing the file is (for example its dependents, hotspot status, or related tests) and what to check before or after the edit.
config:
  agents:
    - agent: CLAUDE_CODE
  inputs: [cli]
  repoUrl: https://github.com/forbiddenlink/specter
  repoRef: d6e60fa
---
I'm about to change src/graph/persistence.ts in this repo. I have Specter installed. Before I touch it, tell me what usually changes along with it and how careful I need to be.
