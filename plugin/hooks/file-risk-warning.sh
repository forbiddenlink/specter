#!/bin/bash
set -e
cd "$(dirname "$0")"
cat | npx tsx file-risk-warning.ts
