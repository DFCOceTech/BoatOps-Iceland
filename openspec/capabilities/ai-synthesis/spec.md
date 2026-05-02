# AI Synthesis — Specification

> Version: 1.0 | Status: Draft | Last updated: 2026-05-01
> **Priority: MAY (nice-to-have)**

## Purpose

Provide an AI-generated Go/No-Go assessment for the planned Blue Boat survey, drawing on the active data layers (wind, waves, cloud cover, advisories, satellite overpass windows, solar geometry). Uses the Claude API with prompt caching for the static system prompt. Returns a plain-language verdict with risk factors, optimal time windows, and PDF export.

## Functional Requirements

### REQ-AI-001: Go/No-Go Assessment Request
Users SHALL be able to request an AI-generated Go/No-Go assessment after loading data for the AOI and planning window. The system SHALL assemble a structured summary of all active data layers and submit it to the Claude API.

### REQ-AI-002: Assessment Content
The Claude API response SHALL include:
- An overall verdict: **Go**, **Caution**, or **No-Go**
- Key risk factors identified (e.g., wind speed exceeds threshold, wave height marginal, cloud cover prevents optical survey)
- Suggested optimal time windows within the planning period
- Caveats or data gaps noted

### REQ-AI-003: PDF Export
The assessment response SHALL be exportable as a PDF document including the verdict, risk factors, optimal windows, metadata (AOI, date range, model used), and a timestamp.

### REQ-AI-004: Configurable System Prompt
The system prompt submitted to the Claude API SHALL be configurable by operators to tune thresholds (e.g., max acceptable wave height, minimum solar elevation for optical surveys, wind speed Go/No-Go boundary).

### REQ-AI-005: Prompt Caching
The static system prompt SHALL use Anthropic prompt caching to reduce cost and latency on repeated requests.

### REQ-AI-006: Display Constraint
The AI response SHALL be displayed in a dedicated panel and SHALL NOT modify any map layers.

### REQ-AI-007: Graceful Failure
If the Claude API is unavailable, the system SHALL display a user-friendly error without disrupting other layers.

## Acceptance Scenarios

### SCENARIO-AI-VERDICT-001: Go verdict for favorable conditions
**GIVEN** wind speed < 5 m/s, Hs < 0.3 m, no active advisories, cloud cover < 20%, and a Sentinel-2 pass within the planning window  
**WHEN** the AI synthesis endpoint is called  
**THEN** the response contains `verdict: "Go"` and references at least the Sentinel-2 overpass as an optimal window

### SCENARIO-AI-NOGO-001: No-Go verdict for unsafe conditions
**GIVEN** wind speed > 12 m/s or Hs > 1.0 m or an active gale warning in the AOI  
**WHEN** the AI synthesis endpoint is called  
**THEN** the response contains `verdict: "No-Go"` with the relevant risk factor(s) identified

### SCENARIO-AI-CACHE-001: Prompt caching reduces latency on repeat
**GIVEN** two successive AI synthesis calls with the same system prompt but different user data  
**WHEN** both calls are made  
**THEN** the second call is ≥50% faster (cache hit on system prompt tokens)

### SCENARIO-AI-PDF-001: PDF export contains all required fields
**GIVEN** an AI assessment has been generated  
**WHEN** the user requests a PDF export  
**THEN** the PDF contains: verdict, risk factors, optimal windows, AOI coordinates, planning window dates, timestamp, and model name

## Data Contracts

### Inputs
| Name | Source | Format |
|------|--------|--------|
| Active layer summary | Assembled by backend from live data | Structured JSON / prompt text |
| System prompt | `config/ai_system_prompt.yaml` (configurable) | YAML → string |

### Outputs
| Name | Format | Key Fields |
|------|--------|------------|
| Assessment | JSON | verdict (Go/Caution/No-Go), risk_factors[], optimal_windows[], caveats[], model, timestamp |
| PDF | Binary (application/pdf) | Full assessment document |

## Implementation Status (2026-05-01)

**Status**: Not Started (deferred — implement after core capabilities)

### What's Built
- Nothing yet

### Reproducibility
- **Seed**: Not applicable (LLM responses are non-deterministic)
- **Re-run verified**: No

### Deviations from Spec
- None

### Deferred
- Full implementation deferred until core capabilities (MAP, WX, WAVE, SOL, SAT) are functional
- PDF generation library selection TBD (reportlab, weasyprint, or pdfkit)
