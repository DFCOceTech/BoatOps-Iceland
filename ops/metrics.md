# Session Metrics — BoatOps

## How Metrics Are Collected

- **Wall-clock time**: `date -u` at start/end of each turn
- **Main conversation tokens**: Extracted from session JSONL via `python3 scripts/session-metrics.py`
  - Source: `~/.claude/projects/-Users-carlson-Documents-myRepos-BoatOps/{session-id}.jsonl`
  - Every assistant message contains a `usage` object with: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`
- **Subagent tokens**: From agent result metadata (`total_tokens`, `duration_ms`)
- **Cost**: Computed using current model pricing (see `scripts/session-metrics.py`)

## Turn Log

| Turn | Start (UTC) | End (UTC) | Duration | Description |
|------|-------------|-----------|----------|-------------|
| 1 | | | | Bootstrap: copy template, populate all docs |
| 2 | 2026-05-11T10:11:42Z | 2026-05-11T11:23:23Z | ~72 min | All 8 improvements.md items + README.md; 66 tests pass |
| 3 | 2026-05-17T12:10:29Z | 2026-05-17T12:38:11Z | ~28 min | Pre-push security review; fixed SSRF, bbox DoS, added *.bsp to .gitignore |

## Subagent Token Usage

| Agent | Tokens | Duration | Task |
|-------|--------|----------|------|
| | | | |

## Session Summary

Run `python3 scripts/session-metrics.py` to fill this section.

| Category | Tokens | Cost |
|----------|--------|------|
| Input | | |
| Output | | |
| Cache Write | | |
| Cache Read | | |
| **TOTAL** | | |
