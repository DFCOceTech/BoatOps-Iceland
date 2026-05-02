# Project Conventions

**Last Updated**: 2026-05-01
**Status**: Active

This file defines project-wide conventions that all agents and contributors must follow. It is the authoritative source for naming, file organization, coding standards, and tooling decisions.

## Project Identity

- **Name**: BoatOps
- **Language**: Python 3.11
- **Primary libraries**: requests, httpx, xarray, rasterio, shapely, pyproj, numpy, pandas, matplotlib, cartopy, python-dotenv, pyyaml, suncalc, fastapi, uvicorn, pytest, nbmake
- **Package manager**: conda (Miniforge/Mambaforge preferred)
- **Conda environment**: `boatops` — see `environment.yml`

## File Organization

```
boatops/
  _bmad/                  # Strategic documents (PRD, architecture)
  openspec/               # Specifications
    capabilities/         # Capability specs and designs
    change-proposals/     # Spec change proposals
  epics/                  # Epics and stories
    stories/              # Individual story files
  ops/                    # Operational documents (status, changelog, known issues)
  .harness/               # Agentic harness
    config.yaml           # Harness configuration
    prompts/              # Agent role prompts
    contracts/            # Sprint contracts
    handoffs/             # Agent handoff files
    evaluations/          # Evaluation reports
  notebooks/              # Jupyter notebooks (numbered, ordered)
  src/                    # Reusable Python modules and packages
    boatops/
  tests/                  # Unit and integration tests
    fixtures/             # Small representative datasets and expected outputs
      expected/           # Known-good reference outputs for E2E comparison
  data/                   # Data files (gitignored except fixtures)
    raw/                  # Immutable original inputs — never modified
    external/             # Third-party reference data
    interim/              # Intermediate transformed data
    processed/            # Analysis-ready outputs
  figures/                # Generated figures and maps (gitignored or selectively committed)
  scripts/                # One-off utility scripts, pipeline entry points
  environment.yml         # Conda environment specification
  requirements.txt        # pip freeze export
```

## Naming Conventions

### Notebooks
- Prefix with a two-digit sequence number: `01_weather.ipynb`, `02_waves.ipynb`
- Use kebab-case after the prefix
- Name reflects the capability being prototyped

### Python Files and Directories
- Files and directories: `snake_case`
- Test files: `test_{module_name}.py`

### Code

#### Variables and Functions
- `snake_case`
- Boolean variables: `is_`, `has_`, `should_` prefixes
- Functions that return data: descriptive noun phrases (`get_wind_forecast()`, `fetch_wave_height()`)

#### Classes
- `PascalCase`

#### Constants
- `UPPER_SNAKE_CASE`

### Spec Identifiers
- Requirements: `REQ-{CAP}-{NNN}` (e.g., REQ-MAP-001, REQ-WX-003)
- Scenarios: `SCENARIO-{CAP}-{FLOW}-{NNN}` (e.g., SCENARIO-WX-WIND-001)
- Change Proposals: `CP-{NNN}`
- ADRs: `ADR-{NNN}`
- Stories: `STORY-{EPIC}-{NNN}`
- Epics: `EPIC-{NNN}`

Capability abbreviations:
- `MAP` — base map and GIS layers
- `WX` — weather forecasts and advisories
- `SOL` — solar geometry
- `WAVE` — wave height and direction
- `SAT` — satellite overpass and imagery
- `AI` — AI Go/No-Go synthesis

## Coding Standards

### General
- Max line length: 100 characters (configured in `pyproject.toml`)
- Indentation: 4 spaces
- Trailing newline: required
- Import order: standard library → third-party → local (enforced by ruff/isort)

### Reproducibility (MANDATORY)
- Any analysis involving randomness MUST fix the random seed explicitly
- Pin dependency versions in `environment.yml` and `requirements.txt`

### Docstrings
- Format: **NumPy style** for all public functions and classes
- One-line docstring acceptable for private helpers
- Notebooks: use Markdown cells to document intent and methodology

### Data / CRS Handling
- Project CRS: **EPSG:4326** (WGS84 geographic) for all data exchange; reproject as needed for display
- Always document units (meters, degrees, knots, m/s) in variable names or docstrings
- Never mutate a `raw/` input file
- Prefer `pathlib.Path` over string paths

### Error Handling
- Validate API responses at pipeline boundaries (status codes, expected fields)
- Use `assert` for internal invariants; raise `ValueError` with a message for user-facing errors
- Log warnings via the standard `logging` module — never `print()` in library code
- API failures must be handled gracefully: failed layers display an error state without blocking others (NFR-06)

## Build and Run Commands

```bash
# Activate environment
conda activate boatops

# Install / update deps
pip install -e ".[dev]"
# or:
pip install -r requirements.txt

# Unit tests
pytest tests/ -v --tb=short

# Notebook E2E (requires nbmake)
pytest --nbmake notebooks/ -v

# Lint
ruff check .

# Format
ruff format .

# Type check
mypy src/boatops/

# Coverage
pytest tests/ --cov=src/boatops --cov-report=term-missing

# Execute a single notebook to verify
jupyter nbconvert --to notebook --execute notebooks/<name>.ipynb \
  --output /tmp/<name>_executed.ipynb

# Run FastAPI dev server
uvicorn boatops.main:app --host 0.0.0.0 --port 8000 --reload
```

## Dependencies Policy

- All packages installed inside the `boatops` conda environment — never base or system Python
- Add new packages to `environment.yml` and export `requirements.txt` after install
- Prefer conda-forge channel for geospatial packages (GDAL, PROJ, rasterio, cartopy)
- Security scan: `pip-audit` or `safety check`

## Git Conventions

### Branch Naming
- `feature/{story-id}-{short-description}`
- `fix/{story-id}-{short-description}`
- `analysis/{short-description}` (for exploratory branches not tied to a story)

### Commit Messages
- Conventional Commits: `feat:`, `fix:`, `data:`, `analysis:`, `docs:`, `test:`, `refactor:`, `chore:`
- Reference the story ID in the body when applicable

### Pull Requests
- PR description must state: what changed, what API/data was used, how results were verified
- CI must pass (lint, unit tests, notebook execution on sample data)

## Environment and Configuration

- Secrets (API keys, CDSE credentials, CMEMS tokens) loaded from `.env` — never committed
- `.env.example` contains placeholder variable names; document every variable
- Configuration that varies by environment goes in a YAML config file, not hardcoded

## Data Gitignore Rules

Large data files are gitignored. Only commit:
- `data/` — nothing (all data downloaded via scripts or fetched at runtime)
- `tests/fixtures/` — small synthetic or publicly licensed sample data only
- `figures/` — selectively commit publication-ready figures; ignore intermediate ones

See `.gitignore` for the full ruleset.
