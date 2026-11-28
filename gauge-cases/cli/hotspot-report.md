---
criteria:
  - name: Report file exists
    rubric: A file named REFACTOR-TARGETS.md exists in the repo root.
  - name: Ranked from real analysis
    rubric: REFACTOR-TARGETS.md lists at least three files from this repo ranked by refactoring priority, and the ranking reflects analysis the agent ran on this repo (complexity, churn, or coupling), not a guess.
config:
  agents:
    - agent: CLAUDE_CODE
  inputs: [cli]
  repoUrl: https://github.com/forbiddenlink/specter
  repoRef: d6e60fa
---
I have Specter installed. Write REFACTOR-TARGETS.md in this repo listing the top files I should refactor first and why, based on how the code has actually changed over time.
