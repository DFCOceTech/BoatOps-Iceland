# AI Synthesis — Design

> Version: 1.0 | Status: Draft | Last updated: 2026-05-01
> **Priority: MAY (nice-to-have) — implement after core capabilities**

## Implementation Approach

Phase 2: `src/boatops/services/claude_client.py` — Claude API client with prompt caching; `src/boatops/routers/ai_synthesis.py` — FastAPI router. System prompt stored in `config/ai_system_prompt.yaml` and loaded at startup. PDF export via `reportlab` or `weasyprint`.

No Phase 1 notebook required — Claude API integration is straightforward once the data layer services exist.

## Pipeline / Analysis Flow

```
Phase 2 (FastAPI):
  POST /api/ai/assess
    → Assemble structured data summary from active layers:
        weather_summary: {max_wind_ms, max_wave_hs, cloud_cover_pct, active_advisories}
        solar_summary:   {sunrise_utc, sunset_utc, solar_noon_utc}
        satellite_summary: {overpasses: [{platform, time, cloud_cover, solar_elev}]}
        aoi: {bbox, planning_window}
    → Build user message from summary
    → claude_client.assess(system_prompt, user_message)
        → anthropic.messages.create(
            model="claude-sonnet-4-6",
            system=[{"type": "text", "text": system_prompt,
                     "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user_message}]
          )
        → parse response → {verdict, risk_factors, optimal_windows, caveats}
    → return JSON assessment

  GET /api/ai/assess/{assessment_id}/pdf
    → render assessment as PDF → return binary
```

## Key Functions / Modules

| Module | Responsibility | Key Functions |
|--------|----------------|---------------|
| `src/boatops/services/claude_client.py` | Claude API with prompt caching | `assess(system_prompt, data_summary)` |
| `src/boatops/routers/ai_synthesis.py` | FastAPI endpoints | `/assess`, `/assess/{id}/pdf` |
| `config/ai_system_prompt.yaml` | Configurable operator thresholds | Loaded at startup |

## Data Contracts

### Architect Constraints

- **MUST**: Use Anthropic prompt caching for the static system prompt (cache_control: ephemeral)
- **MUST**: ANTHROPIC_API_KEY loaded from `.env`; never returned to client
- **MUST NOT**: Modify any map layer state in response to AI assessment
- **MUST**: Model selection configurable via `.env` (`AI_MODEL` default: `claude-sonnet-4-6`)
- **SHOULD**: Store assessment in memory with a short-lived ID for PDF export without recomputing

### Configuration

```yaml
# Environment variables
ANTHROPIC_API_KEY: ""                           # loaded from .env
AI_MODEL: "claude-sonnet-4-6"                   # or claude-opus-4-7 for higher quality
AI_MAX_TOKENS: 1024
# config/ai_system_prompt.yaml (editable by operators):
thresholds:
  max_wind_go_ms: 7.0        # m/s — above this is Caution
  max_wind_nogo_ms: 12.0     # m/s — above this is No-Go
  max_wave_go_m: 0.4         # m
  max_wave_nogo_m: 0.8       # m
  min_solar_elev_optical_deg: 20.0   # degrees — for optical satellite surveys
  max_cloud_go_pct: 30       # %
```

## Error Handling

| Error Condition | Response | Recovery |
|-----------------|----------|----------|
| Claude API unavailable | Return `{"status": "error", "message": "AI synthesis unavailable"}` | Display error in AI panel; other layers unaffected |
| API key invalid | Return structured error; log warning (not the key) | Check `.env` |
| Response parsing fails | Return raw text with `{"verdict": "unknown"}` | Log for debugging |

## Dependencies

- `anthropic>=0.40` — Anthropic Python SDK with prompt caching support
- `reportlab>=4.0` or `weasyprint>=62` — PDF generation (TBD)
- `pyyaml>=6.0` — system prompt config loading
- `python-dotenv>=1.0`
