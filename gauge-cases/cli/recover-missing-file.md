---
criteria:
  - name: Handles the wrong path
    rubric: The agent notices that src/storage/graph-store.ts does not exist instead of inventing results for it.
  - name: Recovers to the right file
    rubric: The agent finds the file in this repo that actually handles saving and loading the graph and gives a before-edit risk summary for that file, based on analysis it ran on this repo.
config:
  agents:
    - agent: CLAUDE_CODE
  inputs: [cli]
  repoUrl: https://github.com/forbiddenlink/specter
  repoRef: d6e60fa
---
I have Specter installed. What do I need to know before editing src/storage/graph-store.ts? I want to change how the graph gets saved.
